# 23 — Full-Source Violation Report (Part 4)

> Quét TOÀN BỘ `src/**` (không lọc hẹp), sau wave migrate + integration cleanup.
> Lệnh quét ghi kèm từng mục để tái lập. Trạng thái: trước checkpoint Part 4 cuối.

## 1. Direct imports `antd` / `@mui/material` / `@emotion/*`

Lệnh: `grep -rln 'from "antd"|from "antd/|from "@mui/material' src --include="*.ts" --include="*.tsx"` (loại `.test.`).

| Vùng | Số file | Đánh giá |
|---|---|---|
| `src/shared/ui/**` (foundation — tầng wrap engine DUY NHẤT) | 34 | HỢP LỆ theo thiết kế (UiButton/UiDialog/primitives/theme adapters…) |
| `src/shared/components/**` (adapter được duyệt) | 27 | HỢP LỆ — đúng bằng `allowlists/direct-ui-imports.json` (regenerate `--update-baseline` sau wave; owner/reason/deadline trong meta) |
| `src/modules/**` + `src/app/**` (feature-land) | **0** | **ĐẠT MỤC TIÊU 0** |
| `@emotion/*` bất kỳ đâu | **0** | ESLint `no-restricted-imports` chặn từ Part 2 |

Guard: `node scripts/check-ui-architecture.mjs` = PASS (ratchet: file mới chạm engine ngoài allowlist sẽ FAIL).

Shim đã XOÁ trong integration: `src/app/theme.ts`, `src/app/mui-theme.ts`, `src/app/layouts/layout.styles.ts` (consumer cuối: ContextSwitcher → token cục bộ; DataTable → literal `"middle"`; TraySelectionGrid.test → `@/shared/ui/theme`).

## 2. Raw button/input/select/table/modal bypass

- `action-standard.test.ts` (suite 4/4): cấm `<Button>/<IconButton>` trần toàn repo — allowlist còn đúng 2 mục có lý do (NotificationBell anchor, UiButton foundation); entry DashboardPage đã GỠ.
- Raw `<table>` còn lại: ApiMasterScreens/IamUserScreen (bảng wireframe + SortableTh + MvpSelectionCheckbox) — hợp đồng SRS giữ, style qua lớp scoped `.hn-mvp-source-screen` token-hoá (mục 5).
- Raw `<input type="file">` (warranty/outbound/master-data): hợp lệ — không có canonical upload, aria-label giữ.
- `PvSwitch`/`SerialItemsSelect`/`MultiSelectFilter`/`StatusProgressSteps`: control module-local dựng TRÊN token/primitives (không chạm engine) — ghi nhận hợp nhất ở Part 5.

## 3. Hard-coded colors/fonts/radius/shadows/spacing

Guard: `node scripts/check-ui-tokens.mjs` = PASS. Baseline `hardcoded-hex-baseline.json` sau regenerate: **1 file** —
`src/shared/utils/performance-monitor.ts` (4 hex trong chuỗi `console.log("%c…")` — màu devtools console, KHÔNG phải UI render; owner FE1, giữ có chủ đích).

Đã xử lý trong integration: WarrantyDetailModal + DocumentAttachmentsPanel (`#fff` → `SEMANTIC_LIGHT.onPrimary`), CameraScanModal (`#0f172a` → `textStrong`), `pwa-status.css` (2 hex → var token), 66 hex trong 4 file CSS wireframe (XOÁ theo file), toàn bộ `#fff/#e5e7eb` trong 3 file CSS giữ lại → `var(--wms-*)`. `height: 35` hack: 0 kết quả toàn src. Font: chỉ `TYPOGRAPHY.fontFamily`/monospace có chủ đích (mã hàng) — không literal font stack lạ.

## 4. Duplicate token/theme/provider

- 1 nguồn token: `src/shared/ui/tokens` (+ mirror `css-vars.css`, parity test).
- 1 `createTheme` (mui-adapter), 1 `antdTheme` (antd-adapter), 1 composition root `AppThemeProvider` (ConfigProvider+AntdApp+MUI) — `provider-uniqueness.test` + grep `<ThemeProvider|<ConfigProvider` ngoài AppThemeProvider = 0.
- `LEGACY_SHELL` (cụm màu sidebar tối cũ) đã XOÁ khỏi tokens; antd-adapter gỡ block `Layout`/`Menu` dark (antd không còn render Layout/Menu nào).

## 5. `!important` và global CSS

- CSS import ngoài entrypoint `main.tsx`: duy nhất `PwaStatus.tsx → ./pwa-status.css` (trong `css-baseline.json`). Guard `check-ui-styles` = PASS (manifest 7 lớp, thứ tự cố định).
- Teardown Part 4: XOÁ `hoa-nam-wireframe.css`, `hoa-nam-ant-overrides.css`, `hn-wms-mvp-exact.css`, `hn-wms-sidebar-account.css` (shell/wireframe cũ — shell nay là UiAppShell/sx; biến `--hn-*` màu chỉ 2 file này định nghĩa/tham chiếu lẫn nhau). GIỮ có scope: `hn-wms-page-normalize.css`, `hn-wms-source-screen.css` (style lớp `.hn-mvp-source-screen` cho màn raw-table), `hn-responsive.css`, `hn-motion.css`, `index.css` (hỗ trợ adapter antd còn lại) — tất cả 100% var token, 0 hex.
- `!important`: 97 chỗ, TOÀN BỘ trong 5 file CSS được giữ ở trên (chủ yếu reduced-motion overrides trong hn-motion + responsive guard) — 0 trong TS/TSX. Chấp nhận có scope; Part 5 thu nhỏ tiếp khi antd remnant giảm.

## 6. Orphan CSS / deprecated components

- Orphan CSS: `DashboardPage.css` XOÁ (cụm A); 4 file wireframe XOÁ (mục 5); quét class từng file CSS còn lại đối chiếu usage — các selector còn lại đều có consumer (raw-table screens/motion/pwa).
- Deprecated (freeze chỉ-giảm, `deprecated-components.json` + test 12/12): consumer giảm trong Part 4 — DataTable 3→1 (PvAdminPage), useSortTooltipColumns 1→0 (giữ file: dependency nội bộ DataTable), PageHeader 2→1, AppBreadcrumb entry XOÁ (component đã xoá P4a), CatalogMaster/Putaway/Gd1/Profile đã thoát freeze. Còn consumer: StatusTag 3, TopPagination 3, MvpPaginationFooter 3, MvpPageSizeSelector 3, ReportKpiCard/Grid 1 — kế hoạch về 0 ở Part 5.

## 7. Icon imports

1 shim duy nhất `@/shared/components/icons` (antd icon names → flaticon-mapped) + `UiIcon` (flaticon slug). Import `@ant-design/icons` trực tiếp ngoài shim: 2 file, ĐỀU trong adapter-zone data-display (`renderSortIcon.tsx` — icon sort của SortableTh; `useSortTooltipColumns.ts` — nội bộ DataTable frozen). Feature-land = 0; `@mui/icons-material` = 0 toàn repo.

## 8. Console errors/warnings, duplicate network, a11y

- Unit: setup fail-on-console giữ nguyên từ trước pipeline; 1001/1001 xanh.
- E2E console/network + a11y (axe trong wwhn-274/wwhn-292) + screenshot matrix: kết quả và fixture chi tiết ở doc 20/21 (chạy tại integration này).

## 9. Kết luận

- Vi phạm P0/P1 còn mở: **0**.
- Exception có chủ đích (owner/reason/deadline đầy đủ): adapter-zone 27 file, deprecated-frozen (mục 6), console-color 1 file, `!important` scoped (mục 5), PvSwitch/Autocomplete-gap (doc 19 Tồn dư — P2, Part 5).
