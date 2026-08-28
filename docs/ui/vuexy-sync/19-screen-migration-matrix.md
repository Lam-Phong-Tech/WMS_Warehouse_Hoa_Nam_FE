# 19 — Screen Migration Matrix (Part 4)

> Phạm vi: TOÀN BỘ route thực tế của Web App (29 mục theo `05-screen-role-inventory.md`),
> migrate về canonical Design System (`@/shared/ui`) theo DEC-UI-BASELINE-01 (Vuexy live demo-1).
> Trạng thái nguồn: sau checkpoint Part 4a (shell swap, SEC-RBAC-01 đóng) + wave migrate 8 cụm module.
>
> Quy ước cột:
> - **Imports sau P4**: engine import trực tiếp còn lại trong file màn hình (mục tiêu 0 — mọi UI đi qua `@/shared/ui` hoặc adapter được duyệt trong `docs/ui/vuexy-sync/allowlists/direct-ui-imports.json`).
> - **Adapter được duyệt** (không tính vi phạm): `ResponsiveDataTable`, `SearchInput`, `SortableTh`, `ScanInput`, `CameraScanModal`, `ActionButton/ActionIconButton`, `DocumentAttachmentsPanel`, `UiFormDate/UiDatePicker/UiDateRangePicker` (antd DatePicker + dayjs), cụm deprecated-frozen trong `deprecated-components.json` (StatusTag, TopPagination, DataTable, PageHeader, MvpPaginationFooter, MvpPageSizeSelector, ReportKpiCard/Grid — chỉ được GIẢM consumer).
> - **States tested**: L=loading, E=empty, Er=error/retry, P=permission/RBAC, R=responsive, V=validation. Bằng chứng: unit suite của module + E2E (doc 20/21).

| # | Route/Screen | Permission | Imports sau P4 | Canonical dùng | Gap baseline đã đóng | States | Visual | Business | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/login` | public | 0 | AuthShell (module-local trên UiCard/tokens), UiAlert, form RHF thuần, CircularProgress | bỏ `.hn-login-*` (hoa-nam-wireframe.css đã xoá), token cool→Vuexy | L,Er,V,R | PASS | PASS (LoginPage.test nguyên trạng) | DONE |
| 2 | `/pv` SCR-PV-01 | public | 0 | UiTextField, UiSelect, PvSwitch (module-local), UiStatusBadge, tokens sx | 20+ inline style → sx token; hex wireframe → token | L,E,Er,R | PASS | PASS (pv tests) | DONE |
| 3 | `/pv/products/:skuId` SCR-PV-02 | public | 0 | UiDescriptions, UiStatusBadge, tokens sx | 18 inline style → sx; giữ testid `pv-detail-spec`, `data-stock-status` | L,Er,R | PASS | PASS | DONE |
| 4 | `/change-password` | public (forced flow) | 0 | AuthShell, UiAlert, form thuần | token + shell auth thống nhất | Er,V | PASS | PASS | DONE |
| 5 | `/forgot-password` | public | 0 | AuthShell, UiAlert, CircularProgress | OTP 3 bước + countdown giữ nguyên | L,Er,V | PASS | PASS | DONE |
| 6 | `/` → `/dashboard` | protected | — (redirect) | — | — | — | — | — | N/A |
| 7 | `/dashboard` MAP-01 | any authenticated | 0 | Box+CARD_SX token, UiStatusBadge, UiAlert, UiButton, ApexCharts wrappers | DashboardPage.css **đã xoá** (grid→sx, breakpoint lạc 560/800/1100→sm/md/lg); `${color}1a`→`*Soft` tokens; normalizeDashboardKPI fail-soft partial payload | L,E,Er,R (partial data) | PASS | PASS (dashboard tests + wwhn-144 MAP-01) | DONE |
| 8 | `/system/users` (+`/new`) IAM-01/02 | `iam.user.view\|manage` | 0 | UiTabs, UiDialog, UiTextField(+select), UiSelect, UiStatusBadge, UiAlert, UiDescriptions, Collapse+UiIcon, MvpPaginationFooter (frozen) | height:35 toolbar hack xoá; inline SVG → UiIcon; deep-link `?screen=IAM-02` page tự xử lý (SEC-RBAC-01) | L,E,Er,P,V,R | PASS | PASS (iam 3/3) | DONE |
| 9 | `/system/roles` IAM-03 | `iam.role.view\|manage\|iam.permission.view` | 0 | UiDialog, UiTextField, useUiConfirm, UiCard, UiStatusBadge, UiAlert, UiStateSurface, UiPagination, MvpSelectionCheckbox, MvpPageSizeSelector (frozen) | antd 18-dòng import + Popconfirm + 14 inline hex (#2563eb…) → token; validation rule giữ nguyên | L,E,Er,P,V,R | PASS | PASS | DONE |
| 10 | `/master-data/skus` (+`/new`) MST-01/02 | `sku.view\|manage` | 0 | UiDialog (form id + submit), UiTextField(+select), UiSelect, UiStatusBadge, UiDescriptions, raw table + SortableTh + MvpPaginationFooter (hợp lệ), useUiConfirm | 3 hệ modal → 1 (UiDialog); `.pill` → UiStatusBadge; MASTER_TOOLBAR_SX height:35 xoá; immutable-rule/identityLocked giữ | L,E,Er,P,V,R | PASS | PASS (master-data 31/31) | DONE |
| 11 | `/master-data/catalog` | `catalog.view\|manage` | 0 | UiTabs+UiCard, ResponsiveDataTable, UiPagination, UiDialog, UiStatusBadge, UiAlert | DataTable (deprecated) → ResponsiveDataTable; consumer freeze giảm | L,E,Er,P,V,R | PASS | PASS | DONE |
| 12 | `/master-data/warehouse` WH-01 | `warehouse.view\|manage` | 0 | UiAlert(title), UiCard, Skeleton/Grid/Stack, UiDescriptions+UiStatusBadge, UiTextField select, UiDialog | MUI thuần → canonical; STATE_CONFLICT/403 wording giữ | L,Er,P,V | PASS | PASS | DONE |
| 13 | `/master-data/agencies` (+`/new`) AGY-01/02 | `agency.view\|manage` | 0 | như #10 | như #10 (recipient Tag → UiStatusBadge neutral) | L,E,Er,P,V,R | PASS | PASS | DONE |
| 14 | `/master-data/defects` (+`/new`) DEF-01/02 | `defect.view\|manage` | 0 | như #10 | như #10 | L,E,Er,P,V,R | PASS | PASS | DONE |
| 15 | `/scan` TRACE-01 | `inventory.trace\|view` | 0 | UiTabs, UiAlert, SearchInput, UiTextField+ActionButton, UiSelect, UiStatusBadge, UiPagination, MvpPageSizeSelector (frozen) | 21 inline style → sx; **đã có nav entry** (NAV-01, nav-data.ts) | L,E,Er,P,R | PASS | PASS (scan tests + wwhn-195 52/52 nhóm liên quan) | DONE |
| 16 | `/inbound` IN-01/02 | `inbound.view\|create\|scan\|post` | 0 | UiDialog×3, ResponsiveDataTable×3 + UiPagination, UiAlert, UiStatusBadge, UiTextField, ScanInput (scan-focus Annex D giữ) | 3× ThemeProvider cũ đã gỡ (P2); hex slate/green/red → token; height:35 xoá | L,E,Er,P,V,R | PASS | PASS (inbound+putaway 60/60) | DONE |
| 17 | `/putaway` PTW-01 | `putaway.*\|container.*` | 0 | ResponsiveDataTable + useClientSort (giữ sort toàn danh sách như antd), UiTabs, UiCard, UiAlert, SearchInput, UiSelect, UiDialog, TraySelectionGrid (ApexCharts token-hoá, hết @mui/material) | DataTable deprecated → RDT; lighten() MUI → helper local; heatmap đọc SEMANTIC_LIGHT | L,E,Er,P,V,R | PASS | PASS (TraySelectionGrid 8/8) | DONE |
| 18 | `/outbound` OUT-01… | `outbound.*\|request.*` | 0 | UiDialog×4, ResponsiveDataTable×2, LinearProgress, UiStatusBadge, UiTextField select, UiSelect, UiPagination, TopPagination (frozen) | Progress antd → LinearProgress; TOOLBAR_SX height:35 xoá; **Post-Issue gate/idempotency/If-Match/packing-label giữ nguyên từng literal** (flow06 + wwhn-195 pins xanh) | L,E,Er,P,V,R | PASS | PASS (outbound+scan 16/16 + flow06/wwhn-195) | DONE |
| 19 | `/inventory` INV-01 | `inventory.view` | 0 | UiTabs, UiSelect×5, UiTextField, UiStatusBadge, UiPagination, Tooltip, BalanceDetailModal/TraceModal (UiDialog + RDT + UiTimeline) | 2 kiểu bảng cùng flow → RDT thống nhất; hex qty (#237804/#cf1322/#d46b08) → tokens; TOOLBAR_SX xoá | L,E,Er,P,R | PASS | PASS (inventory 11/11 + trace 12/12 + wwhn-240) | DONE |
| 20 | `/warranty` WAR-01/02, COMP-01 | `warranty.*\|component_issue` | 0 | UiDialog×(5+3), UiTabs, ResponsiveDataTable, UiStatusBadge (TAG_TONE_MAP), UiAlert, UiFormAutocomplete (RHF), StatusProgressSteps (module-local thay Stepper) | antd `message` offender đã hết; **PII masking §13.8 byte-identical**; state machine + evidence gate giữ | L,E,Er,P,V,R | PASS | PASS (warranty 50/50) | DONE |
| 21 | `/reverse` REV-01/02 | `inventory.view\|inventory.reversal.post` | 0 | ResponsiveDataTable×3, UiDialog, UiAlert, UiStatusBadge (ReversalStatusTag nội bộ), UiPagination, TopPagination (frozen), DocumentAttachmentsPanel | **wwhn-242 contract giữ nguyên** (aria-labelledby reversal-post-confirm-title, evidence gate PROVIDED, If-Match/version) | L,E,Er,P,V,R | PASS | PASS (reverse 143/143 nhóm H, wwhn-242 6/6, wwhn-258 9/9) | DONE |
| 22 | `/reports` RPT-01 | `report.view` (+`report.export`, `warranty.pii.*`) | 0 | UiTabs, ResponsiveDataTable + toResponsiveColumns (giữ định nghĩa cột antd làm source vì flow06 pin literal), UiPagination, UiDatePicker/UiDateRangePicker, MultiSelectFilter (module-local), ReportKpiCard/Grid + ReportChartPanel + MvpPageSizeSelector (frozen) | 38 inline style → sx/props; expandable row → modal chi tiết (ghi chú bàn giao); export/Idempotency-Key/PII gating giữ | L,E,Er,P,V,R | PASS | PASS (flow06 pins + reports tests) | DONE |
| 23 | `/audit-logs` | `audit_log.view` | 0 | UiPagination, UiTextField, UiSelect, UiStatusBadge (ACTION_TONES), UiDialog | antd Pagination/Tag → canonical; tooltip title + UUID rút gọn giữ (getByTitle) | L,E,Er,P,R | PASS | PASS (23/23 nhóm A) | DONE |
| 24 | `/notifications` | any authenticated | 0 | UiCard, UiPagination, StatusTag + PageHeader (frozen — consumer cuối), UiStateSurface | antd List → ul/li token; **breadcrumb đã có** (nav-data.ts NAV-01) | L,E,Er,R | PASS | PASS | DONE |
| 25 | `/component-catalog` | DEV-only | — | `<Navigate to="/ui-foundation" replace/>` — catalog demo antd cũ **đã xoá**, thay bằng Foundation Catalog (golden) | catalog lệch chuẩn → golden catalog chuẩn | — | PASS (golden) | N/A | DONE |
| 26 | `/pv-admin` PV-ADM-01 | `pv.master.manage\|pv.publish` | 0 | UiDialog, UiTabs, UiTextField, UiDescriptions, PvSwitch, UiStatusBadge, UiSelect; DataTable + FilterBar (frozen — consumer cuối của DataTable) | **đã có nav entry** (NAV-01); contract version/412/428 giữ (7/7) | L,E,Er,P,V,R | PASS | PASS | DONE |
| 27 | `/profile` | any authenticated | 0 | UiPageContainer, UiCard, UiAvatar, UiDescriptions, UiStatusBadge, ResponsiveDataTable | PageHeader consumer gỡ (freeze giảm); antd Table trực tiếp → RDT | L,E,R | PASS | PASS | DONE |
| 28 | `/errors/403` | protected | 0 | UiDescriptions, UiStatusBadge, tokens | #f5f5f5 → bgCanvas token | P | PASS | PASS | DONE |
| 29 | `*` (404) | public | 0 | NotFoundPage — UiStateSurface + UiButton (bare, ngoài MainLayout) | **NAV-02 đóng**: hết redirect lặng lẽ về `/` | — | PASS | PASS (catch-all test) | DONE |

## Shell & điều hướng (Part 4a — nền của mọi màn)

| Thành phần | Imports sau P4 | Canonical | Ghi chú |
|---|---|---|---|
| `MainLayout` | 0 (Drawer/useMediaQuery qua `@/shared/ui` primitives) | UiAppShell, UiTopbar, UiBreadcrumb, UiFooter, Drawer (mobile nav) | **SEC-RBAC-01 đóng**: luôn render `<Outlet/>`; `?screen=` chỉ còn vai trò meta/deep-link do page đích xử lý |
| `SideNav` | 0 | Box/Collapse/UiIcon/UiIconButton + nav-data.ts | nav sáng Vuexy; classes `hn-mvp-*` giữ làm test-hook inert; mặc định mở tất cả group |
| `UserMenu` | 0 | Menu/MenuItem/ListItemIcon/ListItemText (primitives), UiAvatar | dropdown hồ sơ + đăng xuất |
| `ContextSwitcher` | 0 | Menu/MenuItem + token styles cục bộ | `layoutStyles` (wireframe) đã xoá — consumer cuối chuyển token |
| `NotificationBell` | 0 | Badge primitive, UiIconButton, UiStateSurface, StatusTag (frozen) | NaN-guard `unreadCount ?? 0` |
| `nav-data.ts` | — | Nguồn nav DUY NHẤT (NAV-01): sidebar + breadcrumb + title + meta | thêm `/scan`, `/pv-admin` vào NAV_GROUPS |

## Screen Migration Contract — hồ sơ chung

Áp cho mọi dòng DONE ở trên (chi tiết per-module nằm trong báo cáo cụm A–H, lưu ở transcript pipeline):

- **Entry/exit**: route registry `src/app/router/index.tsx` + `RequirePermission` không đổi; deep-link `?screen=` do page đích xử lý sau guard.
- **API behavior unchanged**: không sửa service/contract nào ngoài `normalizeDashboardKPI` (fail-soft cho partial payload — phòng thủ render, không đổi request/response shape).
- **Keyboard/a11y**: mọi Dialog qua UiDialog có accessible name (auto `aria-labelledby` hoặc aria-label tường minh — WarrantyIntakeModal trước đây KHÔNG có tên, nay có: cải thiện); form trong dialog dùng `<form id>` + nút submit `type="submit" form=` nên Enter-to-submit giữ; radio-group thay ToggleButton có `role="radiogroup"` + arrow-key native.
- **Tests/evidence**: unit per-module (doc 22), E2E + screenshot (doc 20/21).

## Tồn dư có chủ đích (không phải vi phạm)

1. **Deprecated-frozen còn consumer** (được phép, chỉ-giảm; xoá hẳn ở Part 5): StatusTag (3 notifications), TopPagination (3), DataTable+PageSizeSelector+useSortTooltipColumns (PvAdminPage — 1 consumer), PageHeader (NotificationsPage), MvpPaginationFooter (3), MvpPageSizeSelector (3), ReportKpiCard/Grid + ReportChartPanel (AlignedReportsPage/Gd1). Danh sách chốt trong `allowlists/deprecated-components.json`.
2. **Autocomplete non-RHF**: chưa có `UiAutocomplete` canonical — các chỗ antd/MUI Autocomplete cũ chuyển `UiTextField select`/`UiSelect` (mất typeahead, dáng dropdown). Ghi nhận cho Part 5 cân nhắc thêm canonical (PvAdminPage multiple, OutboundIntake SKU, CatalogMaster brand, InboundDraft warehouse).
3. **`DialogContent dividers`**: UiDialog không hỗ trợ — mất kẻ phân cách title/actions ở một số dialog (thẩm mỹ, không chức năng).
4. **PvSwitch module-local**: primitives đã export `Switch` nhưng PV cần dáng token riêng — đề nghị Part 5 hợp nhất về UiSwitch.
5. **Console-only colors**: `src/shared/utils/performance-monitor.ts` (4 hex trong `console.log("%c…")`) — không phải UI render; entry duy nhất còn lại của `hardcoded-hex-baseline.json`.
