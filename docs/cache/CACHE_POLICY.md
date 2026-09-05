# Chính sách cache phía Frontend

Tài liệu này là bản giải thích cho mã nguồn ở `src/shared/cache/`. Nguồn sự thật
là mã, không phải file này; nếu hai bên lệch nhau thì mã đúng và file này sai.

---

## 1. Vì sao cần lớp này

Trước đợt thay đổi:

- **Một** mặc định `staleTime 60s / gcTime 5 phút` áp cho toàn bộ 112 query.
- ~60/112 call site không khai gì; **0** call site khai `gcTime`.
- Danh mục kho (đổi vài tháng một lần) và số tồn kho (đổi từng phút) được đối xử
  y hệt nhau.
- **9 queryKey khác nhau** cùng gọi `fetchWarehouses` → 9 request cho một danh mục.
- Access token chỉ nằm trong RAM ⇒ mỗi lần F5 mất sạch cache ⇒ mọi dropdown hỏi
  lại VPS.
- Mutation chỉ vô hiệu cache **của module mình**: ghi sổ phiếu nhập không hề làm
  mới tồn kho, bảng điều khiển hay báo cáo.

---

## 2. Kiến trúc nhiều tầng

| Tầng | Ở đâu | Giữ gì |
|---|---|---|
| L1 | State của component | Trạng thái giao diện tức thời |
| L2 | RAM của TanStack Query | Mọi query, theo `staleTime`/`gcTime` của nhóm |
| L3 | IndexedDB (`src/shared/cache/query-persister.ts`) | `master`/`reference`/`static`, và `report`/`dashboard` kèm hai chốt chặn |
| L4 | CacheStorage của service worker | Vỏ ứng dụng + tài nguyên tĩnh, **không** dữ liệu API |
| L5 | HTTP cache của trình duyệt | Tài nguyên tĩnh có hash. API luôn `no-store` (BE `NoStoreApiResponses`) |
| L6 | Valkey ở BE | `config/wms_cache.php` |
| L7 | PostgreSQL | Nguồn sự thật |

---

## 3. Nhóm chính sách

Khai ở `src/shared/cache/cache-policy.ts`. Mỗi query key root phải thuộc đúng một
nhóm; guard `yarn cache:policy` fail nếu có root chưa khai.

| Nhóm | staleTime | gcTime | Ghi IndexedDB | Áp cho root |
|---|---|---|---|---|
| `static` | 12 giờ | 24 giờ | có, 7 ngày | — |
| `reference` | 30 phút | 4 giờ | có, 24 giờ | `ref`, `sku-import-constraints` |
| `master` | 10 phút | 2 giờ | có, 12 giờ | `mvp-master`, `catalog-master`, `warehouse` |
| `rbac` | 5 phút | 30 phút | **không** | `auth` |
| `search` | 2 phút | 10 phút | không | `autocomplete` |
| `list` | 30 giây | 15 phút | không | `inbound`, `mvp-outbound`, `warranty`, `reversal`, `putaway`, `scan`, `audit-logs`, `iam`, `pv` |
| `detail` | 30 giây | 15 phút | không | `document-attachments`, `sku-import-report` |
| `report` | 5 phút | 30 phút | **có, 10 phút** (+ bắt buộc gọi lại) | `reports`, `rpt-*` |
| `dashboard` | 60 giây | 15 phút | **có, 10 phút** (+ bắt buộc gọi lại) | `dashboard` |
| `inventory` | 15 giây | 5 phút | **không** | `inventory` |
| `realtime` | 30 giây | 5 phút | không | `notifications` |
| `volatile` | 0 | 30 giây | không | — |

### Ràng buộc độ tươi

```
staleness tối đa người dùng thấy = staleTime (FE) + TTL (BE)
```

Nhóm `inventory`: 15s + 20s (`ttl.stock_short`) = **35s < 60s** — trần của
NFR-SRS-016. Có test chốt ràng buộc này (`cache-policy.test.ts`); nới staleTime
mà không nới NFR sẽ làm test đỏ.

Với `master`/`reference`, TTL chỉ là trần cho thay đổi do **người khác** tạo ra.
Thay đổi do chính người dùng thực hiện phản ánh tức thì qua invalidation.

---

## 4. Persist xuống máy người dùng

### Được ghi

**Nhóm `master`/`reference`/`static`** — danh mục kho, SKU, đại lý, danh mục lỗi,
nhóm hàng, máy in, catalog. Ghi thẳng, không cần gọi lại sau khi nạp.

**Nhóm `report`/`dashboard`** — mở theo quyết định vận hành, kèm **hai chốt chặn
bắt buộc**:

1. `revalidateOnRestore: true` — nạp từ đĩa xong là gọi lại máy chủ **ngay**. Bản
   trên đĩa chỉ để lấp chỗ màn hình chờ, không bao giờ là câu trả lời cuối cùng.
   Kỹ thuật: đặt `dataUpdatedAt = 0` lúc hydrate nên React Query vẫn render dữ
   liệu đó nhưng coi là cũ và refetch ngay khi màn hình mount.
2. **Trần dung lượng theo TỪNG query** (256 KB). Đo trên dữ liệu thật:
   `movement-trace` 2,1 MB và `document-history` 461 KB — hai cái này tự động bị
   loại; còn bảng điều khiển 5–20 KB và `inventory-xnt` 159 KB thì được giữ. Quy
   tắc: giữ cái nhỏ-và-hay-mở, bỏ cái khổng-lồ-và-thỉnh-thoảng.

### Không bao giờ ghi
Token, dữ liệu auth, hồ sơ/quyền (`rbac`), **tồn kho**, chứng từ (`list`/`detail`),
kết quả tìm kiếm, chuông thông báo.

> `rpt-ops/user-directory` bị chặn riêng bằng `PERSIST_DENYLIST`, **thắng cả chính
> sách nhóm**: tuy nó thuộc nhóm `report` (đã được phép ghi), nội dung lại là danh
> bạ người dùng (tên, email, phòng ban) — dữ liệu cá nhân không được nằm trên đĩa
> máy kho dùng chung.

### Namespace — chống rò dữ liệu chéo

Máy trong kho là máy **dùng chung** giữa các ca. Khoá lưu trữ:

```
s{schema}:{env}:{build}:{userId}:{hash(scope)}:{hash(permissions)}
```

- `userId` để **nguyên văn** → hai tài khoản không thể va khoá.
- `permissions` được băm vào khoá → quyền đổi là cache cũ hết hiệu lực **ngay**,
  không chờ TTL.
- `build` đổi mỗi lần deploy → không hydrate dữ liệu có shape của API cũ.

### Vòng đời
- Nạp **sau** khi máy chủ xác nhận danh tính (hồ sơ đến từ `/auth/refresh`, xem
  mục 5), không dùng gợi ý user trong cookie.
- Ghi có debounce 2 giây; mỗi lần ghi dọn sạch mọi namespace khác.
- Trần 256 KB mỗi query, 4 MB cả bản ghi, 120 query; vượt thì bỏ query nặng nhất trước.
- Đăng xuất → xoá toàn bộ IndexedDB.
- IndexedDB lỗi/hết quota/bị chặn → tắt persist cho phiên, app chạy bằng mạng.

---

## 5. Bootstrap sau F5 — bỏ một vòng mạng

`POST /auth/refresh` trả kèm `user` với **đúng shape** mà `GET /auth/me` trả (đối
chiếu trên runtime thật: cùng roles, cùng permission, cùng `warehouse_scope_ids`).
Trước đây FE gọi refresh rồi **chờ** nó xong mới gọi tiếp `/auth/me` — hai vòng
mạng nối tiếp nằm trên đường tới hạn của mọi lần tải trang.

Nay `bootstrap-auth.ts` dựng hồ sơ ngay từ payload của refresh
(`meResponseFromRefreshUser`) và gieo vào React Query bằng đúng queryKey của
`useMe()`, nên `useMe()` thấy dữ liệu còn tươi và không bắn thêm request.

Fail-closed **không đổi**: hồ sơ vẫn do máy chủ phát ra, trong chính response vừa
cấp token. Payload thiếu `permissions` → trả `null` → rơi về đường cũ (`/auth/me`)
thay vì đoán quyền. Có test chốt (`refresh-profile.test.ts`).

---

## 6. Invalidation

`src/shared/cache/invalidation.ts`.

| Loại mutation | Làm mới những root nào |
|---|---|
| Đổi tồn kho (ghi sổ nhập/xuất, đảo bút toán, xuất linh kiện bảo hành, cất hàng, phát mã) | `inventory`, `dashboard`, `putaway`, và **mọi** root nhóm `report` |
| Đổi master/danh mục (SKU, kho, đại lý, danh mục lỗi, catalog) | `ref`, `mvp-master`, `catalog-master`, `warehouse`, và mọi root `report` |
| Đổi vai trò/quyền (IAM) | `iam`, `auth`, `ref` |

Danh sách root nhóm `report` được **suy ra** từ `QUERY_CACHE_REGISTRY`, không chép
tay — thêm một báo cáo mới là nó tự nằm trong diện làm mới.

Cố ý làm rộng tay: `invalidateQueries` chỉ refetch ngay những query **đang hiển
thị**; query không mount chỉ bị đánh dấu cũ. Bỏ sót một màn hình đang hiện số sai
đắt hơn nhiều so với một request thừa.

---

## 7. Service worker

- Tên CacheStorage gắn `build id` (`/service-worker.js?v=<build>`), thay cho hằng
  số `v1` cũ. Deploy mới ⇒ SW mới ⇒ nhánh `activate` xoá cache build cũ.
  Trước đây chunk có hash của mọi build cũ nằm lại vĩnh viễn.
- Tài nguyên có hash nội dung (`/assets/name-<hash>.js`): cache-first.
- Tài nguyên không hash (icon, manifest): stale-while-revalidate.
- `index.html`: network-first, có bản dự phòng ngoại tuyến.
- `/api/*`, cross-origin, request có `Authorization`: **không đụng tới**.

---

## 8. Guard

```bash
yarn cache:policy            # fail nếu có query root chưa khai chính sách
yarn cache:policy:self-test  # chứng minh guard thật sự bắt được vi phạm
```

Guard cũng fail khi registry khai trùng root, hoặc khai một root không còn ai dùng.

---

## 9. Ngân sách tải trang — số đo thật

Đo trên bản production (`vite preview`), Chrome, BE chạy Docker Desktop trên
Windows. Mốc "xong" = request API cuối cùng của màn hình kết thúc.

| | Đầu đợt | Sau đợt |
|---|---|---|
| JS tải ngay mỗi lần F5 | 2.104 KB / 15 file | **1.365 KB / 33 file** |
| JS tải qua mạng (F5 lần 2 trở đi) | — | **0 byte** (service worker phục vụ hết) |
| Request API mỗi lần F5 (Dashboard) | 8 | **7** |
| F5 Dashboard | 2.832 ms | **~1.100–1.400 ms** |
| F5 màn báo cáo nặng nhất | 4.936 ms | **~1.200–2.000 ms** |

### Bốn thứ đã gỡ khỏi đường tới hạn

1. **Barrel `@/shared/ui` không tree-shake được** — thiếu khai báo `sideEffects`
   trong package.json nên rollup phải giữ mọi re-export. Một khối `ui-*.js`
   1.271 KB nằm trong đồ thị tải-ngay. Khai `"sideEffects": ["**/*.css"]` là khối
   đó biến mất.
2. **`LoginPage` import tĩnh** trong router — người đã đăng nhập vẫn tải màn hình
   họ không bao giờ thấy. Chuyển `lazy()` như 37 route còn lại.
3. **Vòng mạng `/auth/me` nối tiếp sau `/auth/refresh`** — xem mục 8.
4. **Từ điển EN 217 KB** trong đồ thị tải-ngay dù người dùng đang xem tiếng Việt.
   Tách sang `messages.en.ts` + nạp động (`english-messages.ts`). Đã kiểm chứng:
   phiên tiếng Việt tải **0 byte** từ điển EN.

### Waterfall phân trang — lỗi lặp ở 7 chỗ

Bảy hàm tải dữ liệu chạy `for (page) { await fetchPage(page) }`, khiến trang sau
xếp hàng sau trang trước. Nặng nhất là danh mục SKU: 818 dòng ÷ 100 (trần cứng
của `BaseRepository::paginate`) = **9 vòng mạng nối tiếp ≈ 2,1 giây**.

Tất cả nay dùng `fetchAllPages()` (`@/shared/api/paginate-all`): trang 1 tuần tự
để đọc `last_page`, phần còn lại song song, trần 6 request đồng thời để không dội
vào VPS khi nhiều người cùng mở.
