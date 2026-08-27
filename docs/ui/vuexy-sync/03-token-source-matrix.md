# 03 — Token Source Matrix

Ngày: 2026-08-27 · SHA: `a908c420663270d783a34fd378689f7940377c85`

## 1. Danh sách TẤT CẢ nguồn token đang ship trong Web App

| # | Nguồn | Loại | Hệ | Nội dung chính |
|---|---|---|---|---|
| T1 | `src/app/theme.ts` (`BRAND` + `DESIGN_TOKENS` + `themeConfig`) | TS → antd ConfigProvider | **Cool/MVP** | primary `#2563eb`, hover `#1d4ed8`, canvas `#f5f7fb`, ink `#1f2937`, border `#d8dfeb`, success `#16a34a`, warning `#d97706`, danger `#dc2626`, sider `#0f172a`; radius 10/12/16 (Card 14, Modal/Drawer 16); controlHeight 36; font Arial 14px; motion 0.14/0.2/0.28s. Tự nhận nguồn: "HN_WMS_Wireframe_MVP.html supplied by BA" |
| T2 | `src/app/mui-theme.ts` (`muiTheme`) | TS → MUI createTheme | **Cool/MVP** (map từ BRAND) | palette map BRAND; shape.borderRadius 10; breakpoints 0/576/768/980/1280; Button height 36 radius 10; Dialog radius 16; font Arial 14; transitions map từ motion-tokens |
| T3 | `src/shared/design-tokens.ts` | TS thuần | **Warm/P0** | NEUTRAL canvas `#e7e5df`, ink `#2b2b2b`; ACCENT `#356fa3`; SEMANTIC success text `#3c6e4f`...; FONT `'Be Vietnam Pro'`; RADIUS card 4/control 3/pill 10; CARD_SHADOW `4px 5px 0 rgba(43,43,43,.12)`. Tự nhận nguồn: "Wireframe P0/Design System - Module 1.md" — **tài liệu không tồn tại** |
| T4 | `src/styles/hoa-nam-wireframe.css` `:root` (30 vars `--hn-*`) | CSS vars | **Warm/P0** | `--hn-canvas:#e7e5df`, `--hn-accent:#356fa3`, `--hn-green:#3c6e4f`, `--hn-red:#b94a48`... + `@import` Google Fonts Be Vietnam Pro (line 1) |
| T5 | `src/styles/hn-wms-mvp-exact.css` `:root` (9 vars không prefix) | CSS vars | **Cool/MVP** | `--bg:#f5f7fb`, `--primary:#2563eb`, `--success:#16a34a`, `--warn:#d97706`, `--danger:#dc2626`, `--line:#d8dfeb`, `--text:#1f2937`, `--muted:#6b7280`, `--panel:#ffffff` |
| T6 | `src/styles/hn-motion.css` (11 vars `--hn-dur*`, `--hn-ease*`, `--hn-t-*`) | CSS vars | Motion | instant 90ms / fast 140ms / 200ms / slow 280ms; easing chuẩn + spring |
| T7 | `src/shared/components/motion/motion-tokens.ts` | TS | Motion | `MOTION_DURATION` instant 90/fast 140/normal 200/slow 280 + `MOTION_EASING` — bản TS mirror của T6 (đồng bộ chủ động, nguồn đôi) |
| T8 | `src/index.css` | CSS | Lai | `:root` Inter font-family + patches; `--y` (sonner); 2 chỗ `var(--primary, #6c5ce7)` — fallback chết (xem CSS-05) |
| T9 | `src/shared/theme/actionIconColors.ts` | TS | Cool (copy tay) | import `BRAND` rồi vẫn hard-code lại `"#2563eb"`, `"#16a34a"`, `"#dc2626"`, `"#d97706"`, `"#6b7280"` — tự phá hợp đồng "nguồn duy nhất" |
| T10 | `src/shared/components/charts/chart-theme.ts` | TS → ApexCharts | Cool | `CHART_COLORS`, `CATEGORICAL_PALETTE`, `CHART_FONT_FAMILY = Arial` |
| T11 | Hard-code rải rác | TS/TSX/CSS | Hỗn hợp | **450 occurrences hex, 110 giá trị distinct** ngoài test (top: `#fff`×71, `#d8dfeb`×21, `#f8fafc`×18, `#2563eb`×17, `#1d4ed8`×12); 286 inline `style={{}}` trong 45 files; 658 `sx` trong 51 files |

Tham chiếu target (không phải nguồn của Web hiện tại): hệ X Mini App — `Mini_App_WMS_Hoa_Nam/src/css/app.scss:5-47` (`--wms-*`) + `src/tokens.js`.

## 2. Ma trận theo category (giá trị đang thắng ở runtime vs các giá trị cạnh tranh)

| Category | Giá trị THẮNG runtime hiện tại | Các giá trị cạnh tranh đang ship | Target (hệ X / live demo) | Mức lệch |
|---|---|---|---|---|
| Color/primary | `#2563eb` (T1→antd, T2→MUI, T5→CSS) | `#356fa3` (T3/T4 — sống trên heading + PlaceholderPage), `#6c5ce7` (T8 fallback chết) | `#7367F0` | **Đổi toàn bộ** |
| Color/semantic | success `#16a34a`, warning `#d97706`, danger `#dc2626` | warm set `#3c6e4f`/`#8a6d1f`/`#b94a48`; + biến thể tay `#237804`, `#166534`, `#b91c1c`, `#92400e` (5-4 lần mỗi mã) | `#28C76F`/`#FF9F43`/`#EA5455 hoặc #FF4C51` (BC-03) + info `#00CFE8` | **Đổi toàn bộ** |
| Typography/family | **Arial** (thắng nhờ import order T5 sau T8/T4) | Inter (T8 — tải từ Google Fonts, KHÔNG BAO GIỜ render), Be Vietnam Pro (T4 — chỉ còn trên heading qua ant-overrides), 2 stack monospace khác nhau | Public Sans (system-preferred, không render-blocking) | **Đổi + xoá 2 font tải thừa** |
| Typography/size | body 14px (T1/T2); table 13px | 12/12.5/13/15/18/22/24 rải rác | body 15px, secondary 13px, title theo scale X §2 | Đổi |
| Spacing | antd/MUI mặc định + `DESIGN_TOKENS.spacing` 4/8/12/14/18/24 (T1) | inline padding 24 bị CSS attribute-substring ép về 0 (normalize layer) | X: 4/8/12/16/24/32 | Đổi nhẹ (14/18 → 16) |
| Radius | 10 (control antd+MUI), 14 (Card), 16 (Modal) | **10 giá trị distinct trong CSS** (3,4,9,10,12,14,16 + pill 999/50%); T3 nói control 3/card 4 | X: control/card 8 (6–8), sheet 16–20 | **Chuẩn hoá thang 3 bậc** |
| Border | `#d8dfeb` (T1/T5) | `#b9b6ad`, `#d8d5cc`, `#e3e0d8`, `#ece9e1` (T4) | `rgba(47,43,61,0.12)` | Đổi |
| Elevation | antd/MUI mặc định (disableElevation cho Button) | CARD_SHADOW "cứng" `4px 5px 0` (T3); `0 4px 14px rgba(15,23,42,.05)` (wireframe screen) | X: `0 4px 18px rgba(47,43,61,.10)` / floating `.14` | Đổi |
| Density/control height | 36 (T1 controlHeight, T2 Button height) | **35** hard-code lặp ở 10 file module (`height: 35` trong sx `MuiOutlinedInput-root`) — lệch 1px có hệ thống | 38 desktop (đo live); 44 touch (X) | **Sửa 10 chỗ lặp + chốt 1 số** |
| Breakpoint | media queries thực dùng: 576/767/768/980(+981)/1200/420/560... | Hợp đồng tuyên bố 576/768/980/1280 (T2 + hn-responsive.css); `1280` không có trong CSS nào; cặp lệch 767/768 và 575/576 gây nhánh mobile+desktop cùng lúc tại đúng biên | 1 bộ duy nhất, khớp giữa MUI breakpoints và CSS | **Chuẩn hoá** |
| z-index | 9999 (loading), 2200 (PWA), 999, 100/99 (TS layout chết), 40/30 (shell CSS), 2 | 2 hệ shell cạnh tranh (CSS 40/30 vs TS 100/99); không phối hợp với antd mask 1000 | Thang z-index có chủ đích | Chuẩn hoá |
| Icon | Flaticon Uicons (`fi fi-rr-*`) qua shim 90 icons — 1 family, nhất quán | `@ant-design/icons` = dependency chết (0 import); 1 inline SVG (IamUserScreen) | Giữ shim (hoặc đổi theo Decision) | Giữ + xoá dep chết |
| Motion | T6/T7 đồng bộ antd (T1 motionDuration*) + MUI (T2 transitions) — 3 hệ cùng nhịp | ổn — đây là phần đã làm ĐÚNG mô hình "một nguồn, nhiều adapter" | X contract: fast 140/normal 220 | Map nhẹ (200→220 nếu chốt theo X) |

## 3. Xung đột giá trị cụ thể đáng chú ý (exact evidence)

1. **Hai hệ CSS vars song song không đè nhau** — semantic trùng, tên khác: `--hn-canvas:#e7e5df` (wireframe.css:4) vs `--bg:#f5f7fb` (mvp-exact.css:2); `--hn-accent:#356fa3` (:16) vs `--primary:#2563eb` (:7)... → cả hai cùng ship, selector nào tham chiếu hệ nào thì ra màu hệ đó. Không có cơ chế hoà giải.
2. **Radius mâu thuẫn phẳng**: `design-tokens.ts` RADIUS card 4/control 3 vs `theme.ts` DESIGN_TOKENS.radius 10/12/16 — cả hai đang được import và áp (ant-overrides.css:33 set `4px !important` rồi :145 set `10px !important` — cùng file tự đánh nhau).
3. **`#6c5ce7` (tím)**: chỉ tồn tại đúng 2 chỗ — `src/index.css:220` và `:240` dạng `var(--primary, #6c5ce7)`. Vì `--primary` LUÔN resolve được từ `:root` (mvp-exact.css:7), fallback tím là **code chết** — sortable-th luôn render `#2563eb`. (Giải thích vì sao snapshot cũ "thấy" 3 primary.)
4. **Font tải thừa**: `index.html` tải Inter (Google Fonts) nhưng Arial thắng cascade trên body → Inter không bao giờ render; Be Vietnam Pro tải qua `@import` (render-blocking, wireframe.css:1) chỉ còn sống trên heading. 2 request font cho 1 family không dùng.
5. **Height 35 vs 36**: block sx `"&, & .MuiOutlinedInput-root": { height: 35 }` copy-paste nguyên văn ở 9-10 file module (AuditLogsPage.tsx:39, IamUserScreen.tsx:94, InboundPage.tsx:46, InventoryPage.tsx:59, ApiMasterScreens.tsx:247, CatalogMasterScreen.tsx:133, AlignedMvpOutboundPage.tsx:45, MvpPutawayPage.tsx:145, ReversalPage.tsx:45, WarrantyPage.tsx:59) trong khi theme đặt 36 — lệch 1px nhân bản 10 lần.
6. **actionIconColors.ts** import `BRAND` xong vẫn hard-code lại đúng các giá trị BRAND export — mọi lần đổi BRAND sẽ không lan tới action icons.

## 4. Kết luận

Web App hiện có **tối thiểu 11 nguồn token** (T1–T11) thuộc **3 hệ màu** (warm P0, cool MVP, và mảnh vụn tự phát) + 2 nguồn motion (đã đồng bộ tay). Không nguồn nào trùng bất kỳ giá trị nào với hệ X/Vuexy (`#7367F0` xuất hiện **0 lần** trong Web repo — đã grep). Việc "đồng bộ Vuexy" vì vậy không phải là tinh chỉnh mà là **thay baseline**: hợp nhất 11 nguồn về 1 nguồn (CSS vars + TS mirror sinh từ cùng chỗ), rồi trỏ antd ConfigProvider + MUI createTheme + CSS layers vào nguồn đó. Chi tiết tại `09-remediation-architecture-plan.md`.
