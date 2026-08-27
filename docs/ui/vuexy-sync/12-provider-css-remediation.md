# 12 — Provider & CSS Remediation

Ngày: 2026-08-28 · Input SHA: `ea309b211aa3b06d106af660bf29fbd15bd2a6ae`

## 1. Provider remediation (RC-05 → đóng)

### Trước
- 37 file mount `<ThemeProvider theme={muiTheme}>` (1 root + 36 re-wrap, một số file wrap 2-3 lần — danh sách đầy đủ: 06-library-import-graph.md §3).
- antd ConfigProvider + locale trộn trong AppProviders.

### Sau
- **1 composition root duy nhất**: `src/shared/ui/theme/AppThemeProvider.tsx` (MuiThemeProvider + ConfigProvider + AntdApp + locale vi). `AppProviders` = QueryProvider → AppThemeProvider → ErrorBoundary → Toaster.
- **0 re-wrap** production (45 wrap gỡ khỏi 36 file bằng fragment-replacement, import dọn sạch; 2 "ngoại lệ portal" cũ — ActionDropdown, MvpListPagination — xác minh không cần vì React context xuyên qua portal, đã gỡ luôn; comment cũ thay bằng ghi chú trỏ về composition root).
- File test render cô lập được miễn (TraySelectionGrid.test.tsx giữ wrap của nó).
- Enforce: `provider-uniqueness.test.ts` (createTheme đúng 1 nơi; ThemeProvider/ConfigProvider/AntdApp JSX chỉ ở composition root + allowlist RỖNG) + guard `ui:architecture`.

## 2. CSS remediation (RC-03/RC-04 → trói lại, rút dần ở Part 3)

### Entrypoint & load order (hợp đồng, enforce bằng `ui:styles` CSS_MANIFEST)
```text
src/main.tsx:
 1. @flaticon/…/rounded.css      (icon font)
 2. shared/ui/tokens/css-vars.css  ← LỚP TOKEN CANONICAL (mới, đứng trước tất cả)
 3. index.css                     (patch app-level)
 4. hoa-nam-wireframe.css         (legacy warm — :root --hn-* đã ALIAS về --wms-*)
 5. hoa-nam-ant-overrides.css
 6. hn-wms-mvp-exact.css          (legacy cool — :root --bg/--primary/… ALIAS về --wms-*)
 7. hn-wms-page-normalize.css
 8. hn-wms-sidebar-account.css
 9. hn-wms-source-screen.css
10. hn-responsive.css
11. hn-motion.css
```
Không thêm file mới vào src/styles (guard fail); không thêm CSS import ngoài entrypoint trừ allowlist component-scoped (`DashboardPage.css`, `pwa-status.css`, `PvPublicLayout`… — ghi trong `allowlists/css-baseline.json`).

### Re-point giá trị (2 pass perl trên 11 file CSS)
- ~60 mã hex distinct map về `var(--wms-*)` (primary/semantic/soft/text/border/grey/bg…), bao gồm cả bảng màu antd-classic trong khối `.ant-message` của index.css và 2 fallback chết `#6c5ce7` (CSS-05 đóng).
- **Còn lại đúng chủ đích**: `#fff/#ffffff` (60 — trắng thuần) + 4 màu sidebar tối legacy (`#0f172a`, `#111f3d` ×4, `#e5e7eb` ×7, `#94a3b8` ×3) = LEGACY_SHELL, deadline Part 3. Tổng hex ngoài tokens: **~175** (từ 450 của Part 1; phần TSX module còn lại nằm trong ratchet `hardcoded-hex-baseline.json`).

### Fonts (CSS-02 → đóng)
- Gỡ `<link>` Inter + 2 preconnect khỏi `index.html`; gỡ `@import` Be Vietnam Pro khỏi wireframe.css.
- Mọi khai báo `font-family` body/heading (9 vị trí: Inter stack, Be Vietnam Pro stack ×3, Arial stack ×8) → `var(--wms-font-family)` = Public Sans system-preferred. KHÔNG còn request font ngoài.
- Guard: `ui:tokens` fail nếu "Inter"/"Be Vietnam Pro"/"Arial,Helvetica"/fonts.googleapis quay lại.

### `!important` & cascade
- Không thêm mới (ratchet per-file trong `css-baseline.json`; hiện trạng ~279 chỗ đo bằng countImportant — sẽ giảm mạnh khi xoá lớp normalize/exact ở Part 3 Phase C).
- KHÔNG tạo "final-override.css" — thay đổi diện mạo Part 2 đến từ đổi NGUỒN (token alias + theme adapter), không thêm lớp đè (đúng nguyên tắc mục 6.6 của prompt).
- Attribute-substring hooks (CSS-08) giữ nguyên trong Part 2 (chúng tiếp tục hoạt động vì inline style không đổi); xử lý tại Phase C như kế hoạch.

### Token drift đã diệt trong TS
- `design-tokens.ts` (warm): XOÁ; consumer duy nhất (FormPage) chuyển sang tokens; ESLint + guard chặn import quay lại.
- `actionIconColors.ts`: 10 hex chép tay → đọc `SEMANTIC_LIGHT` (mapping ngữ nghĩa ghi trong file).
- `chart-theme.ts`: hex + Arial → tokens.
- `motion-tokens.ts`: thành mirror của `tokens/primitives.MOTION`.
- Block sx `height: 35` (CSS-15, 10 file): GIỮ trong Part 2 (đổi làm lệch layout list — thuộc Phase D3), nằm trong hex/sx ratchet + ghi ở đây làm việc Part 3.

## 3. Số liệu before → after

| Chỉ số | Part 1 (a908c42) | Sau Part 2 |
|---|---|---|
| Điểm mount MUI ThemeProvider (production) | 37 file / ~48 sites | **1** |
| createTheme | 1 (app/mui-theme) | 1 (shared/ui/theme/mui-adapter — có guard) |
| Nguồn token | 11 (3 hệ màu) | **1 canonical** + shim @deprecated trỏ về |
| Hệ CSS vars | 2 hệ cạnh tranh (--hn-*, --bg…) | 1 hệ `--wms-*`; 2 hệ cũ = alias |
| Hex literal (src, non-test) | ~450 | ~230 tổng, trong đó 55 thuộc tokens (hợp lệ) → **~175 legacy** (ratchet) |
| Font stack body | 3 stack đánh nhau + 2 font tải thừa | 1 stack, 0 font request ngoài |
| Fallback chết #6c5ce7 | 2 | 0 |
| Lớp CSS global | 9 + 2 ngoài luồng | 10 trong manifest (thêm css-vars) + allowlist; cấm thêm mới |
| Guard chống tái phát | 0 | 4 lệnh + ESLint + 5 test file |

## 4. Còn mở (chuyển Part 3 — theo 09-remediation Phase C/D)
1. Xoá lớp wireframe/exact/normalize/sidebar-account + dead CSS (CSS-14) sau khi shell mới thay `.hn-mvp-*`.
2. LEGACY_SHELL (sidebar tối) → shell Vuexy sáng; gỡ `?screen=`/renderMvpScreen (SEC-RBAC-01, DEC D4).
3. 10 block sx `height:35`; hex TSX module còn lại; hợp nhất Modal/Table/Form/Tag/Pagination (Phase D).
4. Breakpoint lệch 767/768, 575/576 (CSS-09) — sửa khi rút hn-responsive.
