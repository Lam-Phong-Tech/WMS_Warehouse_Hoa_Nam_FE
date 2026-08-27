# 02 — Baseline Source Matrix

Ngày: 2026-08-27 · Input SHA: `a908c420663270d783a34fd378689f7940377c85` (dev) · Mini App SHA: `b9d4d025a935f4c716d7d731c4d253bbaee46365` (main)

## 0. Danh tính từng nguồn

| Nguồn | Bản chất thực tế (đã xác minh) |
|---|---|
| **Vuexy licensed source** | KHÔNG CÓ trên máy/repo; placeholder prompt chưa điền. Mọi ô "Vuexy source" bên dưới = `N/A (thiếu nguồn)` |
| **Mini App** (`Mini_App_WMS_Hoa_Nam`) | Zalo Mini App (zmp-ui shell + Tailwind 3 + React 18) **đã hoàn tất migration design-language Vuexy** — "hệ X" — 5 phase PASS (`docs/vuexy-miniapp-progress.md`). Spec: `docs/ui-system-x-vuexy.md`. Token: `src/css/app.scss` `:root` + `src/tokens.js`. Nguồn tham chiếu của nó là **Vuexy Next.js demo-1 (CRM)**: `https://demos.pixinvent.com/vuexy-nextjs-admin-template-old/demo-1/dashboards/crm/` (ghi tại `docs/prompts/vuexy-terra-phases/01-audit-baseline.prompt.md:17`). Cam kết license: chỉ chuyển design language, KHÔNG copy proprietary source/asset (`vuexy-miniapp-progress.md:394`) |
| **Live demo** (prompt chỉ định) | `demos.pixinvent.com/vuexy-vuejs-admin-template/demo-1` — engine **Vuetify** (`--v-theme-*`). Đo read-only 2026-08-27 (evidence: `01-context-readiness.md` §4) |
| **Web current** | React 19 + Vite 8; **antd 6.4.5 + MUI 9.3.1 song song** + 8 lớp CSS global; 3 hệ token TS + 2 hệ CSS vars (xem `03-token-source-matrix.md`) |

## 1. Baseline Source Matrix

| Category | Vuexy source | Mini App (hệ X) | Live demo (Vuejs, đo 27/08) | Web current | Conflict | Priority decision | Evidence |
|---|---|---|---|---|---|---|---|
| UI engine | N/A (thiếu nguồn) | Tailwind + CSS classes `.wms-*` (không MUI) | Vuetify | antd 6.4.5 + MUI 9.3.1 + 8 CSS layers | **CÓ — 4 engine khác nhau ở 4 nguồn** | Cần Decision (BC-01/BC-02). Đề xuất: Web dùng MUI làm engine, áp token hệ X | package.json cả 2 repo; đo `--v-theme-*` |
| Primary | N/A | `#7367F0` (`--wms-primary`, app.scss:8) | `#7367F0` | `#2563eb` (theme.ts BRAND) + `#356fa3` (design-tokens.ts) | **CÓ** | Hệ X + live demo NHẤT TRÍ `#7367F0` → target. Web lệch cả 2 giá trị | app.scss:8; đo live; theme.ts:10; design-tokens.ts:38 |
| Primary darken/strong | N/A | `#5E54D8` (`--wms-primary-strong`) | `#675DD8` (primary-darken-1) | `#1d4ed8` (BRAND.primaryHover) | **CÓ — X vs live lệch nhẹ** (`#5E54D8` ≠ `#675DD8`) | Cần chọn 1 khi có Decision BC-03 (đề xuất theo hệ X vì là spec nội bộ đã phê duyệt dùng) | app.scss:9; đo live |
| Font | N/A | Public Sans (system-preferred, không tải Google Fonts) | Public Sans, body 15px | **3 stack đánh nhau trên body**: Inter (index.css) → Be Vietnam Pro (wireframe.css) → Arial thắng (mvp-exact.css); MUI/antd theme = Arial 14px | **CÓ** | Public Sans 15px theo X + live (nhất trí). Quyết định kèm: self-host hay system-fallback (X chọn system-fallback, cấm Google Fonts render-blocking) | 07-css §4; app.scss:59; đo live |
| Body size / text color | N/A | 15px / `rgba(47,43,61,0.78)` | 15px / `rgba(47,43,61,0.7)` | 14px / `#1f2937` (BRAND.ink) + `#2b2b2b` (warm) | CÓ (nhẹ giữa X 0.78 vs live 0.70) | 15px thống nhất; opacity theo X | tokens; đo live |
| Background/canvas | N/A | `#F8F7FA` | `#F8F7FA` | `#f5f7fb` (cool) + `#e7e5df` (warm) | **CÓ** | `#F8F7FA` (X + live nhất trí) | app.scss:5; đo live; mvp-exact.css:2; wireframe.css:4 |
| Surface | N/A | `#FFFFFF` | `#FFFFFF` | `#ffffff` | Không | Giữ | — |
| Secondary | N/A | (không định nghĩa secondary; muted `rgba(47,43,61,0.42)`) | `#808390` | `#6b7280` (cool) / `#7a766c` (warm) | CÓ (X thiếu token secondary) | Bổ sung `#808390` từ live nếu cần secondary button | đo live |
| Success | N/A | `#28C76F` | `#28C76F` | `#16a34a` (cool) / `#3c6e4f` (warm) | **CÓ** | `#28C76F` (nhất trí X+live) | app.scss; đo live |
| Warning | N/A | `#FF9F43` | `#FF9F43` | `#d97706` / `#8a6d1f` | **CÓ** | `#FF9F43` | app.scss; đo live |
| Error/Danger | N/A | **`#EA5455`** | **`#FF4C51`** | `#dc2626` / `#b94a48` | **CÓ — X vs live LỆCH NHAU** | Cần Decision BC-03: `#EA5455` (Vuexy Next.js cũ) hay `#FF4C51` (Vuexy Vuejs hiện tại). Đề xuất `#FF4C51` nếu chuẩn là live demo prompt chỉ định; `#EA5455` nếu chuẩn là đồng bộ với Mini App đang chạy | app.scss:24; đo live `--v-theme-error` |
| Info | N/A | `#00CFE8` | `--v-theme-info` chưa đo (không có trong bộ đo) | không có token info riêng (antd mặc định) | CÓ (Web thiếu) | Thêm `#00CFE8` theo X | app.scss:27 |
| Border/divider | N/A | `rgba(47,43,61,0.12)` | `rgba(47,43,61)` @ opacity `0.12` | `#d8dfeb` (cool) / `#b9b6ad`+`#d8d5cc` (warm) | **CÓ** | `rgba(47,43,61,0.12)` (nhất trí) | app.scss:12; đo live |
| Radius (control/card) | N/A | 8px/8px (sheet 18px); spec X cho phép 6–8px | button 6px | **10 giá trị px khác nhau** (3/4/9/10/12/14/16...); antd borderRadius 10; MUI shape 10; design-tokens control 3/card 4 | **CÓ — nặng** | Chuẩn 1 thang 3 bậc theo X (6–8 control/card, 16–20 sheet/modal) | 07-css §7; theme.ts:60; mui-theme.ts:46; design-tokens.ts:60 |
| Control height | N/A | min-height 44px (mobile touch) | button 38px | antd controlHeight 36; MUI Button height 36; 10 file hard-code 35 | **CÓ** (36 vs 35 nội bộ Web; 38 live; 44 X-mobile) | Desktop 38px theo live/Vuexy; giữ 44px cho touch-target mobile theo X | mui-theme.ts:78; đo live; 07-css §5 |
| Shadow/elevation | N/A | `0 4px 18px rgba(47,43,61,.10)` card; floating `0 8px 24px .14` | (chưa đo) | `4px 5px 0 rgba(43,43,43,.12)` (design-tokens CARD_SHADOW — bóng "cứng" wireframe) + antd/MUI mặc định | **CÓ** | Theo X | app.scss; design-tokens.ts:57 |
| Breakpoints | N/A | mobile-first 320–768 (Mini App); spec X desktop: sidebar ~260px, header ~80px, 2/3+1/3 | Vuetify mặc định | Hợp đồng 576/768/980/1280 (mui-theme.ts) nhưng CSS thực tế có 8 breakpoint lạc loài (420/560/575/767/800/981/1100/1200); 1280 không xuất hiện trong CSS nào | **CÓ** | Chuẩn hoá về 1 bộ; lấy 576/768/980/1280 làm hợp đồng đã tuyên bố, sửa CSS lệch | 07-css §8 |
| Motion | N/A | fast 140ms / normal 220ms / ease `cubic-bezier(0.4,0,0.2,1)`; motion contract đầy đủ trong `02-foundation-shell-home.prompt.md:41-50` | (không đo) | hn-motion.css: instant 90/fast 140/mid 200/slow 280 + cùng easing; antd+MUI đã sync cùng bộ số | Nhẹ (Web nhiều bậc hơn X) | Web đã tự đồng bộ 3 hệ motion — giữ, map về contract X | hn-motion.css:22-47; theme.ts:70-74; mui-theme.ts:51-67 |
| Icons | N/A | inline SVG registry (`Icon.tsx`), không icon lib | Vuetify/iconify (không đo chi tiết) | Flaticon Uicons qua shim `shared/components/icons` (90 icons, 1 family, nhất quán); `@ant-design/icons` là dependency chết | CÓ (khác family nhưng mỗi bên tự nhất quán) | Giữ Flaticon shim của Web (đã chuẩn hoá tốt); không bắt buộc đổi trừ khi Decision yêu cầu icon Vuexy (Tabler) | Agent A §6 |
| Dark mode | N/A | Cấu hình selector nhưng **chưa implement** token dark | Có (chưa đo) | Không có | CÓ (cả 2 app đều chưa có thật) | Ngoài scope GĐ này trừ khi có CR | tailwind.config.js Mini App |
| Layout shell | N/A | Spec X §3: desktop sidebar trắng ~260px + sticky header ~80px, padding 24px | Sidebar trắng, header trắng | Sidebar **tối `#0f172a`** (BA wireframe MVP), header `#f5f7fb`; shell tự viết `.hn-mvp-*` + 1 bộ TS styles chết (layout.styles.ts z-index 100/99) | **CÓ — khác biệt thị giác lớn nhất** | Cần Decision: sidebar sáng (Vuexy/X) vs sidebar tối (BA wireframe đã được BA duyệt trong MVP HTML) | Spec X §3; mvp-exact.css:19; wireframe HTML aside `#0f172a` |

## 2. Baseline Conflict Register (cần authority quyết định)

| ID | Xung đột | Các bên | Ảnh hưởng | Authority cần | Trạng thái |
|---|---|---|---|---|---|
| **BC-01** | Thiếu licensed Vuexy source nhưng chương trình nêu tham chiếu "source parity" | Prompt yêu cầu vs thực tế không có nguồn | Chặn gate PASS Part 1; chặn Prompt 2 | PM/PO: cung cấp source HOẶC phê duyệt "design-language parity" theo hệ X (tiền lệ Mini App) | OPEN (= BLK-BASELINE-01) |
| **BC-02** | Baseline UI hiện hành của Web App là **BA wireframe MVP** (`#2563eb`/Arial/sidebar tối) — `src/app/theme.ts:5-8` tự tuyên bố "Source of truth: HN_WMS_Wireframe_MVP.html supplied by BA"; trong khi định hướng mới là Vuexy | BA wireframe (priority #6 — business baseline) vs Vuexy direction (commit 5df4f21, chưa có Decision Record trong `docs/decision-records/`) | Đổi sang Vuexy là thay đổi baseline thị giác do BA cung cấp → cần phê duyệt chính thức, không phải quyết định DEV | PM/PO/BA phê duyệt CR "chuyển design baseline từ BA-wireframe sang Vuexy (hệ X)" | OPEN |
| **BC-03** | Mini App hệ X lấy từ Vuexy **Next.js** demo cũ; prompt chỉ định Vuexy **Vuejs** demo. Lệch cụ thể: danger `#EA5455` vs `#FF4C51`; primary-strong `#5E54D8` vs `#675DD8`; X không có token secondary (`#808390`) | Mini App spec vs live demo prompt | 3 token lệch giá trị; nếu không chốt, Web và Mini App sẽ lệch nhau hoặc lệch demo | PM/PO chọn bản chuẩn (đề xuất: hệ X làm chuẩn để 2 app đồng bộ, ghi rõ 3 giá trị chốt) | OPEN |
| **BC-04** | `src/shared/design-tokens.ts` tự nhận "nguồn duy nhất" theo tài liệu "Wireframe P0/Design System - Module 1.md" — tài liệu này **không tồn tại trong repo**; palette warm (`#356fa3`/Be Vietnam Pro) không khớp bất kỳ baseline nào còn hiệu lực | design-tokens.ts + hoa-nam-wireframe.css vs mọi nguồn khác | 43/60 class wireframe chết; Be Vietnam Pro chỉ sống trên heading; palette warm vẫn ship | Xác nhận với BA: hệ warm P0 đã bị supersede → cho phép xoá | OPEN (đề xuất: RETIRE) |
| **BC-05** | Mini App `CLAUDE.md`/`README.md` mô tả sai hiện trạng (nói là ZaUI Bistro, router sai, tokens sai) | Docs vs code Mini App | Ai đọc docs sẽ hiểu sai baseline | Mini App team cập nhật (ngoài scope repo này) | GHI NHẬN |
| **BC-06** | Techstack guide (`docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`) tuyên bố "UI: Ant Design 6.x" và tham chiếu 4 tài liệu design không tồn tại (`WMS_FRONTEND_STANDARDIZATION.md`, `design-system/DESIGN_TOKENS.md`, `design-system/COMPONENT_INVENTORY.md`, `ARCHITECTURE.md`) | Docs vs code Web | Guide chính thức mâu thuẫn hiện trạng MUI-hoá | Cập nhật guide trong Prompt 2 (sau khi có Decision BC-01/BC-02) | OPEN |

## 3. Kết luận baseline theo thứ tự ưu tiên của prompt

1. **Decision/CR được phê duyệt**: chưa có Decision Record nào về UI baseline trong `docs/decision-records/` → mọi conflict trên đều OPEN.
2. **Licensed Vuexy source**: không có → không dùng được ưu tiên #2.
3. **Mini App tại exact commit `b9d4d02`**: nguồn khả dụng cao nhất hiện tại — có spec hệ X hoàn chỉnh, token chính xác, motion contract, và cả quy tắc desktop (sidebar 260px/header 80px/2-3+1-3) sẵn cho Web.
4. **Live demo (Vuejs)**: đã đo, khớp bảng prompt 100%, dùng làm nguồn đối chiếu độc lập; 3 điểm lệch với hệ X đã ghi ở BC-03.
5. **Web current**: KHÔNG được coi là baseline — nó đang đồng thời mang 3 hệ token và 2 engine.

**Không mặc định Mini App đúng 100%** (đúng quy tắc prompt): các điểm Mini App lệch live demo (BC-03), thiếu secondary token, dark-mode chưa implement, và mobile-first nên thiếu số đo desktop thực tế (chỉ có spec §3) — đã ghi rõ ở trên, chờ authority chốt.
