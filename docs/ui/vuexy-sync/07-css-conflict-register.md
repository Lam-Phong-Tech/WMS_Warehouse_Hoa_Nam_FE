# 07 — CSS Conflict Register

Ngày: 2026-08-27 · SHA: `a908c420663270d783a34fd378689f7940377c85`
Import order (main.tsx): flaticon → `index.css` → `hoa-nam-wireframe` → `hoa-nam-ant-overrides` → `hn-wms-mvp-exact` → `hn-wms-page-normalize` → `hn-wms-sidebar-account` → `hn-wms-source-screen` → `hn-responsive` → `hn-motion`. Ngoài ra: `DashboardPage.css` (import cục bộ trong page), `pwa-status.css` (import cục bộ) — không qua main.tsx.

## 0. Số liệu nền

| File | Dòng | `!important` | `.ant-*` refs |
|---|---|---|---|
| index.css | 357 | 6 | 47 |
| hoa-nam-wireframe.css | 678 | 30 | 52 |
| hoa-nam-ant-overrides.css | 235 | 9 | 65 |
| hn-wms-mvp-exact.css | 155 | 31 | 109 |
| hn-wms-page-normalize.css | 267 | **63** | 63 |
| hn-wms-sidebar-account.css | 30 | 10 | 3 |
| hn-wms-source-screen.css | 50 | 0 | 2 |
| hn-responsive.css | 512 | 10 | 106 |
| hn-motion.css | 433 | 18 | 55 |
| **Tổng (9 file qua main.tsx)** | **2717** | **177** | **502** |

Bổ sung: hex hard-code toàn src (trừ test): **450 occurrences / 110 distinct**. `sx` prop: 658 (51 file). Inline `style={{}}` modules+app: 286 (45 file). Selector MUI trong CSS: 2 (hn-motion.css:310,313). Không rule nào trộn `.ant-*` với `.Mui*` trong cùng selector.

## 1. Register

| ID | Selector/file | Competing source | Winner/cascade | Affected screens | Required remediation | Severity |
|---|---|---|---|---|---|---|
| CSS-01 | 2 hệ token `:root`: `--hn-*` (wireframe.css:3-34, 30 vars warm) vs không-prefix (mvp-exact.css:1-11, 9 vars cool) | warm P0 vs cool MVP | Không đè nhau (tên khác) — CẢ HAI cùng ship; selector nào trỏ hệ nào ra màu hệ đó | Toàn app | Hợp nhất 1 hệ token (Prompt 2) | **P0** |
| CSS-02 | `html,body,#root { font-family }` — 3 tuyên bố: Inter (index.css:2) → Be Vietnam Pro (wireframe.css:39) → Arial (mvp-exact.css:14; :110 `!important` cho `.ant-app,.ant-layout*`) | 3 font stack | **Arial thắng thuần bằng import order**; Inter tải từ Google Fonts (index.html:16-17) không bao giờ render; Be Vietnam Pro (@import render-blocking wireframe.css:1) chỉ sống trên heading qua ant-overrides.css:8-27 | Toàn app | 1 font (Public Sans theo baseline mới); xoá 2 nguồn tải font thừa | **P0** |
| CSS-03 | `.ant-btn` — mvp-exact.css:111 (6 props `!important`) vs hn-motion.css:157 (`transition ... !important`) | 2 file cùng specificity cùng `!important` | Thắng theo THỨ TỰ FILE | Mọi nút antd | Gộp về theme antd (components.Button), bỏ override CSS | P1 |
| CSS-04 | `.hn-mvp-screen`/`.hn-mvp-content`/`.hn-mvp-title h2`/`.hn-mvp-header` — mvp-exact.css:65-71 (fixed px) vs hn-responsive.css:61-78 (clamp) [+ hn-motion.css:148 cùng match] | exact vs responsive | responsive thắng chỉ nhờ đứng cuối — comment thừa nhận tại main.tsx:14-15, hn-responsive.css:7-8 | Shell mọi trang | Shell mới 1 lớp duy nhất | **P0** |
| CSS-05 | `var(--primary, #6c5ce7)` — index.css:220,240 | fallback vs `:root` | `--primary` luôn resolve (mvp-exact.css:7) → fallback tím là DEAD; sortable-th luôn `#2563eb` | Bảng sort | Xoá fallback misleading khi hợp nhất token | P2 |
| CSS-06 | `hn-responsive.css:474-475` — khôi phục rule ≤576px của wireframe.css đã bị mvp-exact.css "đè chết" bằng `!important` | 3 lớp chồng: wireframe → exact (giết) → responsive (hồi sinh) | Lớp thứ 3 hồi sinh lớp 1 — kiến trúc "sửa bằng lớp mới" | Mobile | Xoá chuỗi 3 lớp khi làm foundation mới | **P0** |
| CSS-07 | `hn-responsive.css:300-470` (section 11) tái cài đặt NGUYÊN vocabulary `.btn/.input/.select/.grid-2...` của source-screen.css, re-scope dưới `.ant-modal`/`.ant-drawer`, copy-paste toàn bộ hex | Duplication có chủ đích (antd portal ra body → rule gốc thành "CSS chết", ghi ở :471-473) | Cả 2 bản cùng sống, phải maintain song song (~170 dòng) | Mọi modal/drawer chứa markup wireframe | Đưa vocabulary ra khỏi scope hoặc thay bằng component thật | P1 |
| CSS-08 | `div[style*="padding: 24px"]` (+3 biến thể) — hn-wms-page-normalize.css:7-10,24; `span[style]`/`div[style]` — sidebar-account.css:2-3,13 | CSS match **attribute-substring của inline style** | Ép `padding: 0 !important` lên inline style của React | Mọi trang trong `.hn-mvp-screen` | Cấm pattern này; thay bằng class thật TRƯỚC khi dọn inline style (nếu không sẽ vỡ layout im lặng) | **P0** (bẫy refactor) |
| CSS-09 | Breakpoints: hợp đồng 576/768/980/1280 vs thực tế thêm 420/560/575/767/800/981/1100/1200; cặp 767-768 (hn-responsive:125,286 vs index.css:305, wireframe:622, ant-overrides:227) và 575-576 (pwa-status.css:45) | 2 quy ước biên | Tại đúng 768px: nhánh desktop của hn-responsive + nhánh mobile của index.css CÙNG áp | Trang có bảng/filter tại tablet | 1 bộ breakpoint; `1280` hiện không có trong CSS nào (chỉ mui-theme xl) | P1 |
| CSS-10 | z-index: CSS shell 40/30 (mvp-exact:19,65) vs TS layout 100/99 (layout.styles.ts:91,179 — shell CHẾT) vs 999 (index.css:152) vs antd mask ~1000 vs PWA 2200 vs loading 9999 | 8 giá trị, 2 shell song song | tooltip 999 nằm DƯỚI mask antd; không thang chuẩn | Overlay/tooltip/PWA banner | Thang z-index đặt tên trong token layer | P1 |
| CSS-11 | Radius: 93 khai báo, 10 giá trị px; ant-overrides.css tự đánh nhau (`:33` = `4px !important` vs `:145` = `10px !important`) | warm (3/4) vs cool (10/12/14/16) | Tuỳ selector | Toàn app | Thang 3 bậc theo baseline mới | **P0** |
| CSS-12 | Emotion/cssinjs runtime vs 10 file CSS tĩnh — hn-motion.css:296-303 thừa nhận: style inject runtime "không có thứ tự cố định... ai thắng tùy lúc" | 502 rule `.ant-*` tĩnh vs antd cssinjs; MUI emotion vs 2 rule `.Mui*` | **Nondeterministic** theo thời điểm inject | Bất kỳ | Nguyên tắc mới: token qua theme API (ConfigProvider/createTheme), CSS tĩnh không override component internals | **P0** (nguyên tắc kiến trúc) |
| CSS-13 | `DashboardPage.css` (261 dòng, breakpoints 1100/800/560, import cục bộ) + `pwa-status.css` (575px) nằm ngoài chuỗi main.tsx | Lớp CSS thứ 10-11 ngoài trật tự đã thiết kế | Phụ thuộc thứ tự bundle của Vite | Dashboard, PWA banner | Đưa vào hệ thống layer thống nhất | P2 |
| CSS-14 | Dead CSS: 103+/224 class tự định nghĩa (46%) không có ref trong TSX — wireframe.css 43/60 (72%), mvp-exact 41/88, source-screen 15/56, index.css 4/20. Nguyên bộ `hn-*` primitives (hn-kpi/hn-pill/hn-card/hn-stat/hn-toolbar/hn-wire-*...) là "design language không ai render"; hn-motion.css còn viết transition cho các class ma này (:121-147); `hn-wms-sidebar-account.css` (30 dòng, 10 `!important`) target markup không còn tồn tại; bộ `barcode-*/label-*/print-sheet` chép từ wireframe HTML chưa từng port | — | Ship thừa + gây nhiễu hiểu | Bundle size + maintainability | Xoá theo danh sách (verify từng class trước khi xoá — check này dùng substring nên dead thật có thể CAO hơn) | P1 |
| CSS-15 | `height: 35` sx block copy-paste 10 file (xem 03 §3.5) vs theme 36 | sx cục bộ vs theme | sx thắng (specificity emotion runtime) | 10 trang list | Đưa về theme, xoá 10 bản copy | P1 |

## 2. Bằng chứng "cascade-order dependency" dạng comment (tự thú trong code)

1. `main.tsx:14-15` — "hn-responsive.css phải đứng cuối: ... thắng cascade của các file wireframe 'exact'".
2. `main.tsx:18-20` — "hn-motion.css đứng sau cùng ... vẫn thắng cascade nếu file cũ lỡ đặt transition".
3. `hn-responsive.css:7-8` — "File này được import CUỐI CÙNG ... nên thắng cascade".
4. `hn-responsive.css:474-475` — thừa nhận lớp trước đã bị `!important` "đè chết", lớp này "khôi phục".
5. `hn-motion.css:16-19` — "import SAU CÙNG ... để chắc chắn thắng cascade".
6. `hoa-nam-wireframe.css:495` — chạy đua specificity với file load SAU nó (`.hn-login-wrap` của mvp-exact).
7. `hn-motion.css:296-303` — thừa nhận emotion runtime "ai thắng tùy lúc" (lý do CSS-12).

## 3. Kết luận
Không có "một bug CSS" đơn lẻ — có **một kiến trúc giải quyết xung đột bằng vị trí import + `!important` (177 chỗ) + attribute-substring**, chồng 5 đời layer (wireframe → ant-overrides → exact → normalize → responsive/motion). Mọi remediation kiểu "thêm file CSS thứ 10 để đè" sẽ làm tình hình tệ hơn; hướng đúng duy nhất là thay nguồn (token + theme API + component wrapper) và RÚT lớp, mô tả tại `09-remediation-architecture-plan.md`.
