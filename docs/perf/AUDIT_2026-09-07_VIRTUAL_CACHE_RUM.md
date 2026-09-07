# Audit hiệu năng WMS Hoà Nam — 07/09/2026

**Phạm vi:** FE (`HoaNam_FE`) + BE (`HoaNam_BE`).
**Nguyên tắc:** mọi kết luận đều đứng sau một phép đo lặp lại được. Chỗ nào chưa
đo được thì nói rõ là chưa đo, không suy đoán thành kết quả.

---

## 1. Bottleneck đã tìm thấy

| # | Bottleneck | Loại | Mức |
|---|---|---|---|
| B1 | Cuộn hết bảng báo cáo lớn chỉ tới được **60/5.956 dòng** | **Sai chức năng** | Nghiêm trọng |
| B2 | Khoá cache `movement-trace` bỏ `page/per_page` ⇒ **trả 5/3.434 dòng** | **Sai dữ liệu** | Nghiêm trọng |
| B3 | Một cú gõ ô lọc trên bảng 5.956 dòng: **long task 160 ms, INP 184 ms** | Hiệu năng | Cao |
| B4 | `movement-trace` không phân trang: **4,3 MB giải nén / 590 KB trên dây** mỗi lượt | Hiệu năng | Cao |
| B5 | **Chưa có RUM** — mọi số hiệu năng là phòng thí nghiệm, một máy | Mù thông tin | Cao |
| B6 | Ước lượng chiều cao dòng sai 39 % ⇒ **long task 1.128 ms** khi cuộn tới đáy | Hiệu năng | Trung bình |
| B7 | ETag/304 **không áp dụng được** vì chính sách `Cache-Control: no-store` | Đã đánh giá, giữ nguyên | — |

Ba thứ **không** phải bottleneck (đã đo và loại trừ):

- **CSDL.** `EXPLAIN (ANALYZE)` truy vấn ledger cả năm, 3 join: **6,762 ms** —
  khoảng 0,2 % thời gian phản hồi. Không thiếu index nào trên đường này.
- **Nén HTTP.** gzip của nginx đang bật, 4.544.336 B → 604.079 B (7,5×).
- **Chi phí framework mỗi request.** `/health` 0,24 s, `/auth/me` 0,22 s — cao vì
  bind mount Windows, nhưng ổn định và không phải thứ tạo ra khoảng cách 3–6 giây.

---

## 2. Root cause

**B1 — sentinel nằm ngoài khung cuộn.** `ResponsiveDataTable` render
`<WindowedMore>` (chứa sentinel `IntersectionObserver`) làm phần tử **anh em
đứng sau** hộp `overflowY: auto` do `maxBodyHeight` sinh ra. Sentinel vì thế
nhìn thấy được ngay từ lúc mount ⇒ observer bắn **đúng một lần** (60 → 120
dòng) rồi giữ nguyên trạng thái giao nhau, không bao giờ bắn lần hai. Cuộn
trong khung bảng không đổi trạng thái đó. Tệ hơn: gõ rồi xoá bộ lọc làm `rows`
đổi tham chiếu ⇒ `useRenderWindow` đặt lại về 60 dòng, nhưng effect của sentinel
có deps `[hasMore, showMore]` không đổi nên **không chạy lại** ⇒ bảng kẹt ở
60/5.956.

**B2 — hai tầng phân trang mâu thuẫn nhau.** `buildMovementTrace()` dựng khoá
cache bằng `reportFiltersWithoutPaging()` với lý do ghi trong comment là
"paginateReport() cắt trang trong bộ nhớ nên một entry phục vụ mọi trang". Lý do
đó không đúng với chính báo cáo này: `buildMovementTraceUncached()` gọi
`$query->forPage()` cắt **ngay ở tầng SQL** khi có `per_page`, rồi tự đặt
`$report['pagination']` để `paginateReport()` return sớm. Mỗi trang là một
payload khác nhau nhưng dùng chung một khoá ⇒ request nào nạp cache trước quyết
định số dòng cho mọi request sau trong suốt TTL.

Lớp lỗi này **đã được biết**: `StockCacheInvalidationTest::test_sql_paginated_report_separates_pages_in_cache`
chặn đúng nó cho nhóm BaM1. `movement-trace` cắt trang theo cách khác nên lọt lưới.

**B3 — vẽ toàn bộ tập đã lọc.** 120 dòng × 9 cột × (`Box` + `sx` + `TruncatedText`)
dựng lại mỗi lần `rows` đổi tham chiếu.

**B6 — ước lượng chiều cao cứng.** `estimateSize: () => 44` trong khi dòng thật
cao **61 px**. `getTotalSize()` phồng dần khi các dòng được đo thật
(5.956 × 44 = 262.064 px → 5.956 × 61 = 363.316 px), nên người kéo thanh cuộn
xuống đáy đuổi theo một cái đáy đang chạy.

**B7 — chính sách bảo mật, không phải thiếu sót.** `NoStoreApiResponses` đặt
`Cache-Control: no-store, private` cho **mọi** response `/api/*` (WWHN-325:
payload chứa PII/dữ liệu tồn kho, không được lưu ở HTTP cache trình duyệt hay
cache trung gian). `no-store` cấm trình duyệt **lưu** response, nên không bao giờ
có `If-None-Match` để mà trả 304. ETag chỉ khả thi nếu nới `no-store` → `no-cache`
cho một nhóm endpoint cụ thể — đó là quyết định bảo mật, không phải quyết định
hiệu năng, nên **không tự sửa**.

---

## 3. File đã sửa

**FE** (nhánh `perf/virtual-and-be-opt`, tách từ `884c1c5`):

| File | Việc |
|---|---|
| `src/shared/components/data-display/useVirtualRows.ts` | **Mới** — adapter cuộn ảo dùng chung |
| `src/shared/components/data-display/ResponsiveDataTable.tsx` | Nhánh cuộn ảo + dòng đệm + ref khung cuộn |
| `src/shared/components/data-display/ResponsiveDataTable.virtual.test.tsx` | **Mới** — 7 test hàng rào |
| `src/shared/perf/rum.ts` | **Mới** — thu LCP/INP/CLS |
| `src/shared/perf/rum.test.ts` | **Mới** — 11 test |
| `src/main.tsx` | Gọi `initWebVitals()` |
| `scripts/perf/bench/*` | **Mới** — bàn đo lặp lại được |
| `.env.example`, `package.json`, `yarn.lock` | `VITE_RUM_SAMPLE_RATE`, `@tanstack/react-virtual` |

**BE** (nhánh `dev`):

| File | Việc |
|---|---|
| `Modules/Warehouse/app/Http/Controllers/OperationalReportController.php` | Khoá cache mang paging |
| `tests/Feature/Cache/MovementTracePagingCacheTest.php` | **Mới** — 4 test |
| `app/Http/Controllers/TelemetryController.php` | **Mới** — nhận RUM |
| `routes/api.php` | Route `telemetry/vitals` + throttle |
| `load/report-endpoints-load.mjs` | **Mới** — bộ đo tải nhóm báo cáo |
| `docs/perf/REPORT_ENDPOINTS_LOAD_2026-09-07.md` | **Mới** — số liệu tải |

---

## 4. Kiến trúc trước / sau

**Bảng dữ liệu lớn**

```
TRƯỚC  rows (5.956) -> useRenderWindow (cắt 60) -> <tbody> 60-120 dòng
                                                -> WindowedMore (sentinel NGOÀI khung cuộn)  ← hỏng
SAU    rows (5.956) -> useVirtualRows (adapter DUY NHẤT)
                          ├─ đủ điều kiện? (desktop + maxBodyHeight + >150 dòng)
                          ├─ khung cuộn đã có chiều cao? ── chưa ─> trả về đường useRenderWindow cũ
                          └─ có ─> <tr đệm trên> + ~17 dòng thật + <tr đệm dưới>
```

Không màn nào gọi `useVirtualizer` trực tiếp. Ba đường vào bảng (desktop nhỏ,
desktop lớn, mobile card) đi qua **một** component; nơi gọi không đổi một dòng nào.

**Khoá cache báo cáo**

```
TRƯỚC  movement-trace ──> khoá {filters}                (nhưng cắt trang ở SQL)  ← sai
SAU    movement-trace ──> có per_page?  ─ có ─> khoá {filters, page, per_page}
                                        └ không ─> khoá {filters}   (entry toàn kỳ, giữ nguyên)
```

**Đo hiệu năng**

```
TRƯỚC  chỉ có lab: scripts/perf/measure-reload.mjs (một máy)
SAU    lab:  scripts/perf/bench            (bảng lớn, CPU x4, lặp lại được)
       lab:  load/report-endpoints-load.mjs (tải nhiều vai)
       RUM:  rum.ts ──beacon──> POST /telemetry/vitals ──> bộ đếm Valkey
       Hai nguồn KHÔNG được trộn số với nhau.
```

---

## 5. Benchmark trước / sau

### 5.1 Bàn đo bảng lớn (5.956 dòng, 1440×900, CPU ×4, trung vị 3 lượt)

| Chỉ số | Trước | Sau | Đổi |
|---|---:|---:|---|
| **Dòng tới được bằng cuộn** | **60 / 5.956** | **5.956 / 5.956** | sửa lỗi |
| **INP một cú gõ ô lọc** | 184 ms | **40 ms** | −78 % |
| Long task của cú gõ đó | 160 ms | **0 ms** | hết |
| DOM node lúc mở | 2.819 | **448** | −84 % |
| DOM node sau khi cuộn hết | 1.439 | **425** | −70 % |
| Dựng xong bảng | 1.366 ms | **895 ms** | −34 % |
| Sắp xếp một cột | 24 ms | **16 ms** | −33 % |
| JS heap | 15,5 MB | **10,9 MB** | −30 % |
| Long task lớn nhất khi cuộn | 0 ms\* | 529 ms | ↑ |

\* Trước đây cuộn **không vẽ gì cả** (kẹt ở 60 dòng) nên không có long task —
so sánh trực tiếp là không công bằng. Trong quá trình sửa, con số này từng là
**1.128 ms** vì ước lượng chiều cao dòng sai (B6); tự học chiều cao đưa về 529 ms.

**INP mục tiêu < 100 ms: ĐẠT** cho thao tác lọc (40 ms) và sắp xếp (16 ms) ở CPU ×4.

### 5.2 API (stack DEV, 6 vai đăng nhập đồng thời)

| Luồng | Throughput | p50 | p95 | p99 | Lỗi | SLO p95 ≤ 1,5 s |
|---:|---:|---:|---:|---:|---:|---|
| 10 | 33,4 req/s | 283 ms | 421 ms | 536 ms | 0,00 % | **ĐẠT** |
| 25 | 41,5 req/s | 561 ms | 858 ms | 1.036 ms | 0,00 % | **ĐẠT** |
| 50 | 36,3 req/s | 1.186 ms | 2.628 ms | 3.424 ms | 0,00 % | **KHÔNG ĐẠT** |

### 5.3 Endpoint `movement-trace` — trước/sau bản sửa khoá cache

| Phép thử | Trước | Sau |
|---|---|---|
| Gọi `per_page=5` rồi gọi KHÔNG paging | **5 / 3.434 dòng** | **3.794 / 3.794 dòng** |
| Trang 2 khác trang 1 | **không** (cùng dòng) | **có**, 0 dòng chồng lấn |
| Thời gian lượt không paging | 2,9 – 6,5 s | **0,37 s** (cache hit) |
| Payload không paging | 4,3 MB giải nén / 590 KB trên dây | không đổi |
| Payload `per_page=50` | 36 KB | không đổi |
| `summary` + `by_movement_type` ở mọi trang | toàn kỳ | toàn kỳ (đã khoá bằng test) |

### 5.4 Truy vấn CSDL

`EXPLAIN (ANALYZE, BUFFERS)` ledger cả năm, 3 join: **Planning 4,714 ms /
Execution 6,762 ms**, toàn bộ là `shared hit` (không đọc đĩa). CSDL không phải
nút thắt và không cần thêm index cho đường này.

---

## 6. Regression đã kiểm

| Hạng mục | Kết quả |
|---|---|
| `yarn typecheck` | **PASS** |
| `yarn lint` | **PASS** (0 error, 62 warning — bằng đúng baseline HEAD) |
| `yarn build` | **PASS** |
| `yarn test` (FE) | **20 đỏ / 1.479 xanh (1.499)** — baseline HEAD là **20 đỏ / 1.461 xanh (1.481)**: cùng 10 file, cùng 20 test, **+18 test mới đều xanh, 0 hồi quy** |
| `yarn ui:dependencies` | **PASS** |
| `yarn ui:architecture` | ĐỎ ở `KeepAliveOutlet.tsx` — **đã chứng minh đỏ sẵn ở HEAD** khi gỡ hết thay đổi của tôi |
| BE `tests/Feature/Cache/` | **27 xanh / 153 assertion** |
| Test mới có thật sự bắt lỗi | **2/4 test BE ĐỎ trên code cũ**; bàn đo FE cho 60 vs 5.956 |
| Responsive / mobile | Nhánh card mobile **không** bật cuộn ảo (điều kiện `!isMobile`), có test |
| Sort / filter | Sort chạy trên toàn tập (test), đổi bộ lọc đưa khung cuộn về đầu |
| Sticky header | Còn `position: sticky`, đã kiểm trong trình duyệt |
| Trạng thái loading / empty / error | Không đổi, có test |
| Trợ năng | Dòng đệm `aria-hidden="true"` ⇒ `getAllByRole("row")` chỉ đếm dòng thật |
| In ấn / xuất file | `printElement` chỉ dùng cho nhãn bảo hành; xuất XLSX đi qua `runReportExport` (dữ liệu, không phải DOM) — cuộn ảo không đụng tới |
| RBAC / business logic | Không sửa một dòng nào |
| Keep-alive | Khung cuộn chưa có chiều cao (kể cả `<Activity mode="hidden">`) rơi về đường cũ thay vì bảng trống |

---

## 7. Đạt / chưa đạt

**Đạt**

- INP < 100 ms cho lọc và sắp xếp trên bảng 5.956 dòng ở CPU ×4 (40 ms / 16 ms).
- API quan trọng ≤ 1,5 s tới **25 luồng đồng thời** trên stack DEV (p95 858 ms).
- Adapter dùng chung, không rải logic ra từng màn, không thêm UI stack thứ hai.
- Có RUM để lần sau không phải đoán.

**Chưa đạt**

- **10.000 người dùng đồng thời: CHƯA CHỨNG MINH ĐƯỢC.** Xem
  `HoaNam_BE/docs/perf/LOAD_TEST_10000_USERS.md` — trần đo được trên hồ sơ chịu
  tải là **~200–205 req/s**, thiếu ~25 % năng lực ngay cả với giả định
  think-time 40 giây. Bộ đo của tôi chạy trên stack DEV (trần ~40 req/s) nên
  càng không chứng minh được gì về production.
- Chưa đo lại hồ sơ chịu tải (k6) sau bản sửa khoá cache.
- Chưa đo **đường ghi** dưới tải (post-receipt / post-issue / putaway).
- Chưa có RUM thật từ người dùng (mới có đường ống, chưa bật ở production).

---

## 8. Bottleneck còn lại

| # | Việc | Vì sao chưa làm |
|---|---|---|
| R1 | **FE vẫn tải 4,3 MB không phân trang** ở màn Truy vết | Thẻ KPI + biểu đồ cơ cấu đã an toàn (BE tính toàn kỳ, đã có test khoá lại), nhưng **timeline** và **hai bộ lọc client-side** vẫn dựng từ `rows`. Chuyển sang phân trang server đổi ngữ nghĩa timeline — là quyết định nghiệp vụ, cần một endpoint aggregate cho timeline trước |
| R2 | Long task 529 ms khi kéo thanh cuộn tới đáy | Còn lại từ 1.128 ms; giảm tiếp phải giảm chi phí `sx` mỗi ô (xem R3) |
| R3 | `sx` của MUI/emotion trên **mỗi ô** bảng | Đã ghi ở `F5_INP_2026-09-07.md` §4.1: chuyển `sx` nóng sang class tĩnh đụng cả design system, cần kiểm thử ảnh |
| R4 | Chi phí bind mount 150–500 ms/request ở stack DEV | Đã có `docker-compose.perf.yml` phục vụ mã từ `/srv/app`; là việc vận hành |
| R5 | ETag/304 | Bị chặn bởi chính sách `no-store` — cần quyết định bảo mật trước |
| R6 | antd còn trong đồ thị tải ngay (~174 KB) | Đã ghi ở `F5_INP_2026-09-07.md` §4.2 |

---

## 9. Kế hoạch để đạt chắc 10.000 người dùng đồng thời

Xếp theo lợi ích / rủi ro:

1. **Đo lại trên hồ sơ chịu tải sau các bản sửa này** (`docker-compose.perf.yml`
   + `PROFILE=baseline` của k6), so với `load/results/plateau200-allfixes.json`.
   Không có bước này thì mọi con số sau đều là ngoại suy.
2. **Đóng R1** — tách một endpoint aggregate cho timeline của Truy vết, rồi cho
   FE phân trang sổ ledger. Đây là thay đổi có đòn bẩy lớn nhất còn lại:
   4,3 MB → 36 KB mỗi lượt, và bỏ được `JSON.parse` 4,3 MB trên máy người dùng.
3. **Đo đường ghi dưới tải.** Toàn bộ số hiện có là đường đọc; kho thật ghi liên
   tục, và chính việc ghi làm bump `cache-version` khiến báo cáo trượt cache.
4. **Bật RUM ở production** với `VITE_RUM_SAMPLE_RATE=0.1`, giữ 2 tuần, rồi mới
   quyết định tối ưu tiếp cái gì.
5. **Mở rộng theo chiều ngang.** Trần ~200 req/s là trần CPU của MỘT máy đo.
   10.000 người với think-time 40 giây cần ~250 req/s ⇒ cần thêm node ứng dụng
   + đặt PgBouncer/Valkey ra ngoài. Chỉ được tuyên bố "đạt" sau khi đo trên
   đúng hình thái hạ tầng đó.
6. **Chạy k6 từ MÁY KHÁC.** Hiện k6 giành CPU với chính hệ thống bị đo nên mọi
   số là cận dưới.

---

## 10. Commit có thể review

**FE — nhánh `perf/virtual-and-be-opt`** (worktree `C:\LAM_PHONG_TECH\HoaNam_FE\wt-perf`,
tách từ `884c1c5`; **chưa merge** vào bản làm việc chung vì phiên khác đang sửa
`WindowedMore.tsx` — cần merge tay):

| SHA | Nội dung |
|---|---|
| `6f6a4be` | `perf(fe): cuộn ảo dùng chung cho bảng báo cáo lớn (TanStack Virtual)` — 10 file, +1.018 |
| `bb9738f` | `feat(fe): RUM Web Vitals thật (LCP/INP/CLS)` — 4 file, +342 |

**BE — nhánh `dev`** (đã commit thẳng, chỉ gồm file của tôi; 34 file đang sửa dở
của phiên khác **không** bị đụng tới):

| SHA | Nội dung |
|---|---|
| `0a9b612` | `fix(be): khoá cache movement-trace phải mang page/per_page` — 2 file, +218 |
| `d94ab90` | `feat(be): endpoint nhận RUM Web Vitals + bộ đo tải nhóm báo cáo` — 4 file, +432 |

**Cách chạy lại bằng chứng**

```bash
# FE — bàn đo bảng lớn (trước/sau)
cd C:/LAM_PHONG_TECH/HoaNam_FE/wt-perf
npx vite build --config scripts/perf/bench/vite.config.mts
node scripts/perf/bench/run-table-bench.mjs --label check --repeats 3
```

```bash
# BE — test hàng rào khoá cache
cd C:/LAM_PHONG_TECH/HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE
docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: -e DB_URL= -e CACHE_STORE=array backend php artisan test tests/Feature/Cache/
```

```bash
# BE — đo tải nhóm báo cáo
node load/report-endpoints-load.mjs --concurrency 25 --seconds 25 --label check
```

---

# PHẦN II — vòng hoàn thiện (cùng ngày, sau khi merge)

## 11. Việc đã làm thêm

1. **Gộp nhánh `perf/virtual-and-be-opt`** vào bản làm việc chính (`0d34abe`).
2. **Cuộn ảo cho DÒNG THỜI GIAN**, qua một component dùng chung mới
   (`VirtualList`) chia chung adapter `useVirtualRows` với bảng — không chép
   logic hiệu năng sang màn thứ hai.
3. **Bỏ 2 trong 3 request** của màn Truy vết: BE trả sẵn `source_no`.
4. **Dựng sẵn `sx`** của ô/dòng bảng một lần mỗi lượt render thay vì một lần
   mỗi ô.
5. **Sửa 2 lỗi của chính lớp cuộn ảo**, chỉ lộ ra khi chạy trong trình duyệt
   thật (xem §12).

## 12. Hai lỗi bàn đo KHÔNG bắt được — và vì sao

Bàn đo dựng `rows` bằng `useMemo`, nên **tham chiếu mảng ổn định**. Màn báo cáo
thật dựng `rows.filter(...)` **ngay trong thân render**, nên mỗi lượt render là
một mảng MỚI dù nội dung y hệt. Khác biệt đó sinh ra hai lỗi:

| Lỗi | Triệu chứng trong app thật | Sửa |
|---|---|---|
| `useVirtualRows` mốc việc "quay về đầu" theo **tham chiếu** mảng | Cuộn làm virtualizer đổi state → render lại → mảng mới → effect tưởng "đổi bộ lọc" → kéo khung cuộn về 0. Cuộn mãi vẫn chỉ thấy dòng đầu; chiều cao dòng học sai **403 px** thay vì **77 px** | Mốc theo **nội dung**: số dòng + tham chiếu dòng đầu/dòng cuối |
| Lọc xuống dưới ngưỡng làm cuộn ảo **tắt**, nhưng khung cuộn giữ nguyên offset cũ | Đang ở offset **361.777 px** rồi lọc còn vài dòng ⇒ **vùng trắng**, người dùng tưởng bộ lọc không ra kết quả | Kéo khung cuộn về đầu ở **cả hai** chế độ |

Cả hai đã có test hàng rào (`VirtualList.test.tsx`).

**Bài học về cách đo:** đo A/B **tuần tự** trên máy dev cho kết quả **sai dấu** —
lần đầu đo, thay đổi chỉ giảm số object style lại "chậm hơn 88 %". Nguyên nhân:
các phiên khác đang biên dịch/chạy test. `run-ab-bench.mjs` chạy xen kẽ A,B,A,B
và đảo thứ tự mỗi cặp; sau đó chênh lệch mới ổn định và đúng dấu.

## 13. Số liệu vòng 2

### 13.1 Bỏ request thừa (đo cùng một thời điểm)

| | Số request | Byte trên dây |
|---|---:|---:|
| Trước | 3 | 1.115.392 B |
| Sau | **1** | **781.105 B** |
| Chênh | −2 | **−334.287 B = −30,0 %** |

Riêng `document-history` bị bỏ: 328.105 B nén / **1.694.863 B giải nén** — tải về
chỉ để dùng **hai** trường.

### 13.2 Dòng thời gian, trong app thật (`/reports/traceability`, 5.969 biến động)

| | Trước | Sau |
|---|---:|---:|
| Mục trong DOM | nới dần tới **5.969** | **15** |
| DOM node cả trang | — | **1.826** |
| Mục xa nhất tới được bằng cuộn | — | **5.968 / 5.968** |
| Lọc xong khung cuộn | giữ offset cũ (vùng trắng) | **về 0** |

### 13.3 `sx` dựng sẵn — A/B xen kẽ, 11 cặp

| Chỉ số | Đổi |
|---|---|
| INP một cú gõ ô lọc | **−6 % đến −20 %** (hai lượt đo độc lập) |
| Long task của cú gõ đó | **−6 % đến −19 %** |
| Sắp xếp một cột | 0 % |
| Thời gian dựng bảng | trong nhiễu (+1 % và +14 %) |

Cải thiện nhỏ nhưng cùng dấu ở cả hai lượt, và rủi ro bằng 0 (style sinh ra y
hệt). Sau khi cuộn ảo đã cắt số dòng vẽ xuống ~17, chi phí mỗi ô đương nhiên
không còn là phần lớn — kết quả này khớp với dự đoán đó.

**Lưu ý đọc số tuyệt đối:** cùng một bản mã, INP đo được **40 ms** lúc máy rảnh
và **96 ms** lúc máy bận (đang build + các phiên khác chạy). Cả hai đều dưới
ngưỡng 100 ms, nhưng đừng so số tuyệt đối giữa hai lượt đo khác thời điểm — chỉ
so trong cùng một lượt A/B.

## 14. Gate sau vòng 2 (bản làm việc chính)

| Gate | Kết quả |
|---|---|
| `yarn typecheck` | **PASS** (cả trong pre-commit hook) |
| `yarn lint` | **PASS** — 0 error, 62 warning |
| `yarn build` | **PASS** |
| `yarn test` | **16 đỏ / 1.501 xanh (1.517)** — toàn bộ 16 đỏ nằm ở file của phiên khác + nhóm governance pin SHA đã trôi; đã kiểm từng file |
| `yarn ui:guards` | 1 vi phạm **có sẵn** (`KeepAliveOutlet.tsx`). Guard đã bắt đúng file MỚI của tôi (`VirtualList.tsx` import `@mui/material`) và đã sửa sang `@/shared/ui` |
| BE `tests/Feature/Cache/` | **5/5** của MovementTracePagingCacheTest |
| Kiểm bằng trình duyệt thật | **PASS** — timeline, bảng, `source_no`, reset khi lọc |

## 15. Còn lại sau vòng 2

| # | Việc | Trạng thái |
|---|---|---|
| R1 | FE vẫn tải trọn tập ledger (781 KB nén) | **Đã giảm 30 %**, nhưng chưa phân trang. Chặn cuối cùng là **timeline + hai bộ lọc client-side** dựng từ chính `rows`. Cần endpoint aggregate cho timeline trước — là quyết định nghiệp vụ |
| R2 | Long task khi kéo thanh cuộn tới đáy | 529–656 ms ở CPU ×4 (≈130–165 ms ở ×1) |
| R3 | `sx` engine của MUI | Đã cắt phần rẻ; phần còn lại đụng design system |
| R5 | ETag/304 | **Không làm được** khi còn `Cache-Control: no-store` — quyết định bảo mật |
| — | **10.000 người dùng đồng thời** | **VẪN CHƯA CHỨNG MINH ĐƯỢC.** Không có số đo mới nào ở vòng 2 thay đổi kết luận của `LOAD_TEST_10000_USERS.md` |

## 16. Commit vòng 2

| Repo | SHA | Nội dung |
|---|---|---|
| FE | `0d34abe` | merge nhánh `perf/virtual-and-be-opt` |
| FE | `d06025c` | cuộn ảo dòng thời gian + bỏ 2 request + sửa 2 lỗi cuộn ảo |
| BE | `fb168d5` | `movement-trace` trả sẵn `source_no` |
