# Audit hiệu năng Frontend — 06/09/2026

Điểm xuất phát: người dùng báo **INP 14.696 ms** (input delay 14.693 ms) trên
`/reports/traceability`, kèm cảm giác một số màn "đứng", lọc/tìm kiếm bị lag.

Toàn bộ số liệu dưới đây đo trên **bản build production** (`yarn build` +
`vite preview`), gọi API thật của stack docker local. Không có số nào suy diễn.

---

## 1. Chẩn đoán

`input delay 14.693 ms` nghĩa là luồng chính bận 14,7 giây **trước khi** trình
duyệt kịp xử lý cú bấm. Đây là vấn đề của FE, không phải API: cùng lúc đó
`/reports/movement-trace` trả về trong ~280 ms.

Tái hiện được, chính xác: một `PerformanceObserver('longtask')` bắt được **một
long task duy nhất, 14.666 ms**, sinh ra khi gõ một ký tự vào ô lọc của khối
"Sổ tồn kho biến động".

Ba nguyên nhân cộng dồn:

### 1.1 Cột STT quét lại cả mảng cho từng dòng — O(n²)

```
render: (row) => ledgerFilter.rows.indexOf(row) + 1
```

`render` chạy một lần cho MỖI dòng. Với 5.956 dòng, đó là ~35 triệu phép so sánh
tham chiếu cho MỘT lần render. Cùng khuôn mẫu này nằm ở **25 chỗ** khắp dự án
(bảng báo cáo, danh sách mã vật lý, xếp kho, PV admin, tồn kho…).

Với bảng cắt trang 15 dòng thì 15² = 225 phép so sánh — vô hình. Vấn đề chỉ lộ ra
ở đúng những bảng nhận trọn tập đã lọc.

### 1.2 Vẽ toàn bộ tập đã lọc vào DOM

Dòng thời gian dựng 5.956 mục, mỗi mục ~8 `Box` của MUI (mỗi `sx` là một lượt
serialize + tra cache của emotion). Bảng ledger dựng thêm 5.956 `<tr>`.

Đo được: **293.514 node DOM** trên một trang.

### 1.3 Mỗi phím gõ dựng lại cả màn ở mức ưu tiên GẤP

Một lượt render lại của `MovementTraceReport` (một component ~1.500 dòng, hàng
trăm `sx` inline) tốn ~200 ms — đo bằng cách gõ chuỗi không khớp gì (0 dòng kết
quả), nên chi phí đó KHÔNG phải do vẽ dòng, cũng không phải do lọc (quét 5.956
dòng chỉ ~1 ms sau khi có bộ nhớ đệm chuỗi tìm).

---

## 2. Đã sửa gì

| Sửa | File | Ảnh hưởng |
|---|---|---|
| Tra vị trí dòng bằng Map thay vì `indexOf` | `shared/components/data-display/row-index.ts` + 25 chỗ gọi | Bỏ hẳn O(n²) |
| Cửa sổ vẽ tăng dần (60 dòng, tự nới khi cuộn) | `shared/components/data-display/useRenderWindow.ts` | Gắn vào `ResponsiveDataTable` → **mọi bảng** của dự án được bảo vệ |
| Chân "Hiện thêm" cho bảng dựng tay / lưới thẻ | `WindowedRowsFooter.tsx`, `WindowedMore.tsx` | 8 danh sách dựng tay ở 5 màn báo cáo |
| Đổi từ khoá chạy trong `startTransition` | `reports/operations/report-section-filter.ts` | Lượt render nặng thành ngắt được |
| Ô tìm kiếm giữ bản nháp cục bộ | `reports/operations/SectionFilterBar.tsx` | Ký tự hiện tức thì, không chờ màn dựng xong |
| Bộ nhớ đệm chuỗi tìm kiếm theo dòng | `report-section-filter.ts` | Bỏ ~42.000 lần tạo chuỗi cho mỗi phím |
| Tra vị trí dòng trong adapter cột báo cáo | `reports/operations/report-columns.ts` | Dùng chung cho mọi bảng báo cáo |

Hai mảnh cuối của mục "transition" **phải đi cùng nhau**: chỉ có `startTransition`
mà không có bản nháp thì chính ô nhập trở thành thứ bị chậm.

---

## 3. Đo lại sau khi sửa

Cùng thao tác, cùng máy, cùng dữ liệu (5.956 dòng):

| Màn | Chỉ số | Trước | Sau |
|---|---|---|---|
| `/reports/traceability` | long task khi gõ 1 phím | **14.666 ms** | phần gấp **9–34 ms**, phần nền **84 ms** (ngắt được) |
| `/reports/traceability` | node DOM | 293.514 | **3.292** |
| `/reports/stock-reconcile` | long task khi gõ 1 phím | 220 ms | phần gấp **9–20 ms**, phần nền **62 ms** |
| `/reports/stock-reconcile` | node DOM | 16.638 | **5.932** |

Số liệu hiển thị không đổi: màn vẫn công bố "Đang hiển thị 60/5956 dòng", và mọi
KPI/biểu đồ/bộ đếm vẫn tính trên trọn tập đã lọc.

---

## 4. Đã quét toàn bộ màn, đây là những màn KHÔNG có vấn đề

Đo số node DOM sau khi trang ổn định:

| Màn | node DOM | Ghi chú |
|---|---|---|
| `/dashboard` | 894 | |
| `/inventory` | 709 | phân trang server |
| `/master-data/skus` | 752 | phân trang server |
| `/audit-logs` | 544 | |
| `/system/roles` | 1.094 | |
| `/pv-admin` | 537 | |
| `/reports/warranty` | 1.246 | |
| `/reports/import-quality` | 921 | |
| `/reports/packing-label` | 992 | |
| `/reports/pending-evidence` | 1.884 | |
| `/reports/recipient` | 3.585 | |
| `/reports/inventory-flow` | 6.926 | 130 dòng — dưới ngưỡng cửa sổ vẽ |

Các màn vận hành đều phân trang phía server nên không thuộc lớp lỗi này. Dù vậy
`ResponsiveDataTable` vẫn được gắn cửa sổ vẽ để một thay đổi tương lai (nâng
`per_page`, thêm màn "xem tất cả") không mở lại đúng cái hố này.

## 4b. Rà soát modal / drawer

Có 26 component modal/dialog/drawer; 6 trong số đó tự gọi API.

**Đúng rồi, không sửa:** cả 6 đều được mount CÓ ĐIỀU KIỆN
(`{id ? <Modal/> : null}`), nên query chỉ chạy khi modal thật sự mở — không có
chuyện "modal đóng vẫn gọi API ngầm". Các query phụ thuộc dữ liệu đều có `enabled`
gác. Mở lại modal trong khoảng `staleTime` của nhóm thì lấy từ cache React Query,
không gọi lại.

**MỘT lỗi thật, đã sửa — modal chi tiết phiếu xuất kéo NGUYÊN bảng nhãn về máy:**

```ts
// trước
const labelQuery = useQuery({ queryKey: ["mvp-outbound", "packing-labels"],
                              queryFn: fetchPackingLabels });
// fetchPackingLabels(): vòng lặp TUẦN TỰ, tối đa 20 trang × 100 dòng,
// KHÔNG lọc — rồi .find() ra đúng một dòng của phiếu đang mở.
```

Số nhãn chỉ tăng theo thời gian, nên mỗi lần mở modal lại đắt hơn lần trước. Đo
tại chỗ: bảng đang có 115 dòng ⇒ 2 lượt gọi tuần tự để lấy 1 dòng.

Sửa hai đầu:
- BE: `listLabelSnapshots` nhận thêm bộ lọc `outbound_document_id` (BỔ SUNG, client
  cũ không gửi thì hành vi y như trước);
- FE: `fetchPackingLabels(documentId)` + khoá query mang `documentId`.

Đo lại trong trình duyệt sau khi sửa: mở modal phát ĐÚNG MỘT request
`/api/v1/label-snapshots?page=1&per_page=100&outbound_document_id=<id>` trả 1 dòng.
Không còn tăng theo lịch sử in nhãn nữa.

## 5. Đã kiểm và KHÔNG phải vấn đề

- **Tách chunk theo route: đang hoạt động.** 38 route đều `lazy()`. Chunk
  `react-apexcharts` (888 KB) và `vendor-xlsx` (282 KB) KHÔNG nằm trong đồ thị
  tải của trang đăng nhập.
- **Không có request trùng / waterfall** ở các luồng chính: đọc network log của
  `/dashboard`, các request nổ song song theo nhóm, không nối đuôi.
- **`POST /auth/refresh` mỗi lần tải lại trang là ĐÚNG** — access token chỉ nằm
  trong bộ nhớ, F5 phải khôi phục phiên từ cookie refresh. Điều hướng trong SPA
  không gọi lại.
- **Preflight CORS đã được cache** (`Access-Control-Max-Age: 3600`).

## 6. Còn lại / chưa đạt

| Mục | Trạng thái |
|---|---|
| Trang đăng nhập tải 52 file / ~2 MB | **CẦN HẠ TẦNG** — cần bật nén + `Cache-Control: immutable` cho asset có hash ở tầng phục vụ tĩnh. Repo FE không chứa cấu hình nginx/Dockerfile nên không sửa được từ đây. Local `loadEventEnd` = 63 ms nên không phải nút thắt ở LAN |
| `MovementTraceReport` render lại tốn ~200 ms | **CHẤP NHẬN CÓ Ý THỨC** — đã chuyển thành việc nền ngắt được. Muốn giảm nữa phải tách component và hoisting `sx`, là một đợt refactor riêng |
| `/reports/movement-trace` trả 4,3 MB | **RỦI RO CÒN LẠI** — tăng tuyến tính theo số biến động. Cần tổng hợp KPI + dòng thời gian ở server rồi mới cắt trang được bảng; đổi hợp đồng API |


---

## 7. Đợt 2 (07/09/2026) — "chuyển tab / chuyển màn vẫn lag, nhất là 8 màn báo cáo"

Phản hồi sau đợt 1: gõ/lọc đã mượt, nhưng **rời một màn báo cáo rồi quay lại**, và
**bấm qua lại các tab trong màn**, vẫn khựng. Đo lại bằng trình duyệt thật
(`scripts/perf/measure-transitions.mjs`, Chromium headless, build production ở
`localhost:5199`, BE thật ở `:8080`), ở CPU x1 và CPU x4 (giả lập máy văn phòng).

### 7.1 Chẩn đoán (đo trước khi sửa, CPU x4)

| Thứ đang tốn | Bằng chứng | Hệ quả người dùng thấy |
|---|---|---|
| Tải chunk của route lúc bấm | lần đầu vào màn báo cáo: 300–370 ms (x1) / >1 s (x4) chỉ để tải + parse JS trước khi gọi API | skeleton "trắng" ngay sau khi bấm menu |
| Remount toàn bộ trang mỗi lần điều hướng | `MainLayout` key theo pathname ⇒ quay lại màn đã mở vẫn dựng lại 3–10k node DOM: 0,7–0,9 s, 200–400 ms khoá luồng chính | quay lại tab cũ "như lần đầu" |
| Panel nặng vẽ cùng lượt với tô sáng tab | bấm "Dạng hộp"/"Dạng ngang": ~930 ms khoá luồng chính trước khi tab đổi màu | bấm tab không phản hồi |
| ApexCharts vẽ SVG + `getBBox()` cho mọi nhãn, kể cả chart dưới màn hình | trace Chrome: ~60 % thời gian luồng chính của một màn báo cáo là style/layout/paint | cuộn/bấm giật lúc chart vào |
| Danh mục SKU cuốn 9 trang `GET /products` | 9 request / ~50 KB mỗi lần mở màn báo cáo đầu tiên; 3.000 người ⇒ ~45 req/s vô ích | màn đầu chậm, BE gánh thêm |

### 7.2 Đã sửa gì (cơ chế của các trang web lớn, áp vào đúng chỗ đo được)

| # | Cơ chế | Ở đâu | Học từ |
|---|---|---|---|
| 1 | **Nạp trước chunk route** khi rê chuột/focus mục menu + nạp dần lúc rảnh (`requestIdleCallback`, 3 s sau shell, mỗi nhịp một chunk, 8 màn báo cáo trước) | `app/router/route-preload.ts`, `SideNav.tsx` | Next.js/Remix `<Link prefetch>` |
| 2 | **Giữ sống màn báo cáo** đã mở bằng React 19.2 `<Activity mode="hidden">` — state, DOM, bộ lọc, tab, **vị trí cuộn** còn nguyên; tối đa 6 màn (LRU); đăng xuất là mất | `app/layouts/KeepAliveOutlet.tsx`, `keep-alive.ts` | Vue `<keep-alive>`, tab trình duyệt |
| 3 | Overlay portal (Dialog/Drawer/Menu/Popover) **không render khi trang bị giữ sống ở trạng thái ẩn** — không được `open=false` vì trong cây ẩn React đã gỡ effect, transition thoát của MUI không bao giờ hoàn tất (đã thấy drawer đứng im đè lên Dashboard) | `shared/ui/page-visibility.ts`, `UiDialog.tsx`, `components/PageOverlays.tsx` (re-export qua `primitives-mui.ts`) | — |
| 4 | Tab = cập nhật **gấp**, panel = **trễ** (`useDeferredValue`): tab đổi màu ngay, panel vẽ ở lượt ngắt được | 7 màn báo cáo | React 18+ concurrent |
| 5 | **Chart lười**: `react-apexcharts` tách chunk (`lazy`), chỉ vẽ khi cách màn hình 200 px (IntersectionObserver), tắt animation | `shared/components/charts/LazyApexChart.tsx` + 8 wrapper + `TraySelectionGrid` | — |
| 6 | `content-visibility: auto; contain-intrinsic-size: auto 480px` cho thẻ báo cáo ngoài màn hình | 3 file css + 2 `CARD_SX` | Chrome rendering guide |
| 7 | Danh mục SKU: **1 request** `GET /skus/lookup` (9 cột, cache server 30 phút theo namespace master) thay 9 trang; BE cũ chưa có route ⇒ 404/405 tự lùi về cuốn trang | BE `ProductController::lookup`, FE `report-data.ts` | — |
| 8 | Trang KHÔNG keep-alive về đầu khung cuộn khi mở (trước đây `main.scrollTop` "dính" từ trang trước) | `KeepAliveOutlet.tsx` (`FreshPage`) | mặc định của trình duyệt |

### 7.3 Đo sau khi sửa

**CPU x1** (`build/perf/transitions-final-cpu1.json`, 2 vòng: vòng 1 lần đầu vào, vòng 2 quay lại):

| Màn | Lần đầu: shell / đủ nội dung | Quay lại: shell / đủ nội dung | Request khi quay lại |
|---|---|---|---|
| Nhập – Xuất – Tồn | 675 / 785 ms | 80 / 214 ms | 0 |
| Tồn kho & đối soát | 356 / 477 ms | 113 / 255 ms | 0 |
| Truy vết | 720 / 828 ms | 136 / 269 ms | 0 |
| Nhập dữ liệu & lỗi | 654 / 820 ms | 69 / 180 ms | 0 |
| Nhãn đóng gói | 615 / 729 ms | 93 / 217 ms | 0 |
| Bảo hành & linh kiện | 358 / 776 ms | 104 / 241 ms | 0 |
| Xuất theo người nhận | 933 / 1.051 ms | 128 / 249 ms | 0 |
| Lịch sử nhập – xuất | 377 / 488 ms | 78 / 217 ms | 0 |
| Dashboard / SKU / Nhập / Xuất / Tồn / Bảo hành | 349–711 ms lần đầu | 36–63 ms shell khi quay lại | 0 |

- Bấm tab trong màn (18 tab của 9 màn): **trung vị 106 ms, p90 167 ms, tối đa 175 ms**.
- Ping-pong giữa hai màn báo cáo: 65–148 ms.
- Chunk phải tải khi bấm menu: **0** ở mọi màn (đã nạp trước).

**CPU x4** — số tin cậy là lượt đo lúc máy yên (`transitions-after4-cpu4.json`):
lần đầu vào 480–1.620 ms shell; quay lại màn báo cáo 416–921 ms shell (từ
0,7–0,9 s + 200–400 ms khoá luồng chính xuống còn 129–489 ms khoá); tab trung vị
352 ms, p90 520 ms. **Ba lượt đo lại x4 ngày 07/09 dao động rất lớn** (quay lại
Truy vết 921 → 1.058 → 2.708 ms; ping-pong 532 → 831 → 1.405 ms) vì máy đang có
các phiên khác chạy build/test song song — giả lập chậm 4 lần khuếch đại mọi tranh
chấp CPU. Không dùng các lượt đó để kết luận; muốn số x4 sạch phải đo trên máy
rảnh (`CPU=4 ROUNDS=3 node scripts/perf/measure-transitions.mjs`).

### 7.4 Kiểm tra đầu-cuối cơ chế giữ sống (`scripts/perf/verify-keep-alive.mjs`)

Chạy trên build production, trình duyệt thật, đăng nhập thật — 19/20 điều kiện PASS:

- rời Truy vết bằng nút Back khi drawer chứng cứ đang mở ⇒ drawer **biến mất**,
  Dashboard hiện đúng, màn báo cáo vẫn được giữ trong DOM (ẩn);
- Forward quay lại ⇒ ô lọc còn nguyên chữ đã gõ, drawer mở lại đúng chỗ, **0 request**;
- bấm menu đi–về ⇒ vị trí cuộn 700 → 700 px, 0 request, 0 chunk của màn đó,
  418–497 ms tới nội dung thật (5 lượt chạy);
- Tồn kho & đối soát: tab thứ hai vẫn đang chọn sau khi đi–về, 0 request;
- tối đa 6 màn giữ trong DOM; màn nghiệp vụ (Tồn kho) vẫn mount mới; deep-link
  `?screen=IAM-02` vẫn mở modal; trang mới về đầu khung cuộn.
- Điều kiện FAIL duy nhất: console có **một** `422 POST /auth/refresh` ở lần F5
  đầu — hành vi bootstrap phiên có sẵn (FE luôn gọi refresh sau F5 để dựa vào
  cookie HttpOnly; lượt đầu bị BE từ chối dữ liệu), không thuộc phạm vi đợt này,
  ghi lại để xử lý riêng.

### 7.5 Còn lại / chưa đạt

- Mục tiêu "mọi thao tác ≤ 2 s trên máy yếu": ở CPU x4, lần **đầu** vào Xuất theo
  người nhận vẫn ~1,5 s shell (7 request + trang 10k node); phần còn lại là layout
  thật của trang lớn. Cắt tiếp cần chia nhỏ trang (ảo hoá bảng theo chiều dọc thay
  vì cửa sổ 60 dòng) — chưa làm.
- Số x4 sau đợt 2 chưa có lượt đo sạch (xem 7.3).
- `422 POST /auth/refresh` ở lần F5 (xem 7.4).

### 7.6 Ghi chú phía backend (đo cùng ngày)

Mọi số "lần đầu vào màn" ở 7.3 đo với backend đang chạy từ **bind mount** của Docker
Desktop — endpoint có auth + DB trả 160–260 ms lúc rảnh. Cùng ngày, phía BE phát hiện
và sửa nguyên nhân (`HoaNam_BE/docs/perf/LOAD_TEST_2026-09-07.md` §1): hồ sơ chịu tải
nay phục vụ mã từ filesystem của container, cùng các endpoint đó còn 32–90 ms. Phần
"chờ API" trong lần đầu vào màn báo cáo (3–8 request) vì thế sẽ ngắn hơn đáng kể trên
stack đã sửa; chưa đo lại FE trên stack đó — ghi để lượt sau đối chiếu.
