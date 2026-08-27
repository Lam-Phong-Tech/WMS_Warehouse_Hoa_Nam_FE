# 16 — Component Migration Map (Part 3)

Ngày: 2026-08-28 · Nguyên tắc: mỗi purpose đúng MỘT public implementation; antd/MUI chỉ là underlying adapter; xoá deprecated chỉ khi consumer graph = 0 (hoặc consumer được migrate trong chính Part 3); adapter tương thích phải có deprecation note + guard test.

Ký hiệu: **CANONICAL** = bề mặt duy nhất cho code mới · **ADAPTER** = giữ API cũ, ruột đã render bằng foundation (note @deprecated, consumer bị đóng băng bằng guard) · **DELETE** = xoá trong Part 3 (0 consumer hoặc consumer đã migrate) · **P4** = consumer migration thuộc Part 4.

## 1. Foundation / layout

| Purpose | CANONICAL (mới/bless) | Số phận bản cũ |
|---|---|---|
| AppShell | `UiAppShell` (shared/ui/layout — presentational, chưa nối router) | `shared/components/layout/AppShell` (antd, 0 consumer) → **DELETE**; `MainLayout` (.hn-mvp-*) giữ vận hành tới P4 (swap shell + SEC-RBAC-01) |
| Sidebar | `UiSidebarNav` (sáng, 260px, active primary) | `layout/Sidebar` (antd, 0) → **DELETE**; `SideNav` (raw + ?screen=) → P4 |
| Header/Navbar | `UiTopbar` (sticky 80, surface) | `layout/Header` (antd, 0) → **DELETE**; `AppHeader` (antd, DEAD) → **DELETE** |
| Footer | `UiFooter` | `AppFooter` (DEAD) → **DELETE** (MainLayout inline footer → P4) |
| Breadcrumb | `UiBreadcrumb` (MUI) | `layout/Breadcrumb` (antd, 0) → **DELETE**; `AppBreadcrumb` (antd, đang chạy trong MainLayout) → ADAPTER giữ tới P4 |
| Page container/header | `UiPageContainer` | `layout/PageHeader` (antd; consumer: ProfilePage) → **ADAPTER** (note + freeze) |
| Grid/Stack/Divider + overlay primitives | re-export `@/shared/ui` (`primitives-mui.ts`: Box/Stack/Grid/Divider/Tooltip/Popover/Menu/MenuItem/CircularProgress/Skeleton) | antd Row/Col/Space trong features → P4 |
| Typography | `UiText` | antd Typography trong features → P4 |
| Icon | `UiIcon` + shim `shared/components/icons` (90 icon — CANONICAL đồng cấp, cùng cơ chế flaticon) | — (đã hợp nhất từ trước) |
| Partner shell | — (không còn nhu cầu) | `PartnerLayout` (DEAD) → **DELETE**; `middleware.ts` (DEAD, redirect sai /403) → **DELETE** |

## 2. Actions

| Purpose | CANONICAL | Số phận bản cũ |
|---|---|---|
| Nút hành động nghiệp vụ (permission/kind/tonal) | `ActionButton` / `ActionIconButton` / `ActionGroup` (bless — đã chuẩn từ a908c42, enforce bằng action-standard.test) | — |
| Nút primitive (không nghiệp vụ) | `UiButton` / `UiIconButton` (filled/tonal/outlined/text; size theo token) | antd Button trực tiếp: chỉ allowlist action-standard; MUI Button trực tiếp trong features → ratchet ui:architecture |
| Dropdown action | `ActionDropdown` (bless, MUI Menu) | — |
| Confirm / destructive | `UiConfirmDialog` + hook `useUiConfirm()` (promise API thay Modal.confirm) | antd `confirmDialog` helper (0 consumer sau khi catalog cũ xoá) → **DELETE**; `ConfirmButton` (Popconfirm; consumer duy nhất = catalog cũ) → **DELETE**; `Modal.confirm` cuối trong ApiMasterScreens → thay bằng useUiConfirm ngay Part 3 |

## 3. Forms

| Purpose | CANONICAL (`src/shared/ui/forms`, RHF + MUI) | Số phận bản cũ (`shared/components/forms`, antd) |
|---|---|---|
| FormField/label/help/error | `UiFormField` (foundation) + label/help/error tích hợp trong từng UiForm* | `FormField` → **DELETE** (theo lớp antd forms) |
| Text/Password/Search/Textarea | `UiFormText` (type text/password/search, multiline) | `FormInput` (consumer: 3 trang auth → MIGRATE trong Part 3) → **DELETE**; alias `TextField` → **DELETE** |
| Number/Currency | `UiFormNumber` (suffix ₫) | `FormNumber` (0) → **DELETE** |
| Select/MultiSelect | `UiFormSelect` | `FormSelect`/`SelectField` (0) → **DELETE** |
| Autocomplete | `UiFormAutocomplete` | `FormAutocomplete` (0) → **DELETE** |
| Checkbox/Radio/Switch | `UiFormCheckbox` / `UiFormRadioGroup` / `UiFormSwitch` | `FormSwitch` (0) → **DELETE** |
| Date/Time/Range | `UiFormDate` (underlying adapter: antd DatePicker — đổi MUI X khi có Decision) | `FormDatePicker`/`DateField` (0) → **DELETE** |
| Textarea | `UiFormText multiline` | `FormTextarea` (0) → **DELETE** |
| Upload/Attachment | `DocumentAttachmentsPanel` (bless, MUI) | — |
| Scanner input | `ScanInput` + `CameraScanModal` (bless — adapter antd, GIỮ NGUYÊN hành vi scan-focus Annex D; không đổi trong P3) | — |
| Field error standalone | lỗi hiển thị trong từng UiForm* (helper/error tích hợp) | `FieldError` + alias `FormError` → **DELETE** (0 consumer sau khi xoá lớp forms) |
| Submit | `UiButton type=submit` / ActionButton | `SubmitButton` → GIỮ un-exported làm emitter hợp đồng WWHN-268 (ui-state.test) với @deprecated — consumer=0, xoá khi Part 4 chuyển hợp đồng sang ActionButton |

## 4. Data display

| Purpose | CANONICAL | Số phận bản cũ |
|---|---|---|
| Card | `UiCard` | `cards/StatCard`, `cards/InfoCard` (0) → **DELETE** |
| KPI/Statistic | `UiKpiCard` | `ReportKpiCard` (MUI, 1-2 consumer) → **ADAPTER** (freeze, hợp nhất P4); Dashboard local card → P4 |
| Table (list) | `ResponsiveDataTable` (bless CANONICAL — MUI+raw, 7 trang list) | `DataTable` (antd wrapper, 5 consumer) → **ADAPTER** (@deprecated + freeze; consumer migrate P4); antd `Table` trực tiếp trong modal (12) → P4; `TableContainer`+`FilteredEmptyState`, `TableToolbar` (0) → **DELETE** |
| Table toolbar/filter | `FilterBar` (bless ADAPTER antd — 1 impl duy nhất purpose này; retheme qua antd-adapter token) + `SearchInput` (MUI, bless) | — |
| Pagination | `UiPagination` | `TopPagination` (3) + `MvpPaginationFooter`/`MvpPageSizeSelector` (3+3) → **ADAPTER** ruột UiPagination (hết antd); `navigation/Pagination` (0) → **DELETE**; `PageSizeSelector` → GIỮ internal-only cho DataTable (@deprecated); antd Pagination trực tiếp (8 file) → P4 |
| Tabs | `UiTabs` | `navigation/Tabs` (0) → **DELETE**; MUI Tabs trực tiếp trong shell các trang → P4 (đổi qua UiTabs) |
| Badge/Chip/Status | `UiStatusBadge` | `StatusTag` (4) → **ADAPTER** ruột UiStatusBadge; `StatusBadge` (0) → **DELETE**; antd Tag trực tiếp (31) → P4 |
| Avatar | `UiAvatar` | antd Avatar (UserMenu/Profile) → P4 |
| Descriptions | `UiDescriptions` | antd Descriptions trong features → P4 |
| Timeline | `UiTimeline` | — (mới, phục vụ warranty detail P4) |
| Chart container/legend | `ReportChartPanel`/`ReportChartGrid` (bless) + wrappers `AreaChart/BarChart/DonutChart/HorizontalBarChart` + `chart-theme` (token hoá từ P2) | — |
| Sort header | `SortableTh`/`renderSortIcon`/`useClientSort` (bless — thuộc ResponsiveDataTable family) | `useSortTooltipColumns` (antd Table family) → ADAPTER theo DataTable |

## 5. Overlay / feedback

| Purpose | CANONICAL | Số phận bản cũ |
|---|---|---|
| Modal/Dialog | `UiDialog` (+ auto aria-labelledby) | `feedback/Modal`, `FormModal`, `FormPage`, `FormSection`, `FormActions` (0 sau khi catalog cũ xoá) → **DELETE**; MUI Dialog trực tiếp (22 file) → P4 quy về UiDialog |
| Drawer | `UiDrawer` | `FormDrawer`, `DetailDrawer` (0) → **DELETE**; antd Drawer trực tiếp (AuditLogDetailDrawer…) → P4 |
| Dropdown/Menu | `ActionDropdown` + primitives Menu/MenuItem | — |
| Popover/Tooltip | primitives re-export (theme hoá sẵn) | — |
| Toast/Snackbar | `sonner` toast (CANONICAL duy nhất — antd message đã về 0 sau Part 3) | `message` (WarrantyPage) → ĐÃ THAY bằng toast; notification antd: 0 |
| Alert | `UiAlert` | `feedback/Alert` (0) → **DELETE**; `ApiErrorAlert` → **ADAPTER-CANONICAL** (API giữ, ruột MUI Alert — đây LÀ bề mặt chuẩn cho lỗi API) |
| Confirm dialog | `UiConfirmDialog`/`useUiConfirm` | (xem Actions) |
| Skeleton/Loading | `UiStateSurface loading` + `PageSkeleton` (ruột MUI Skeleton, API giữ) + `Loading` (ruột MUI overlay, API giữ) | — |
| Empty/Error/NoPermission | `UiStateSurface` — `EmptyState`/`LoadingState`/`ErrorState`/`NoPermissionState` giữ API, ruột UiStateSurface | `PlaceholderPage` (0) → **DELETE**; `AdaptiveDelayedRender`/`DelayedRender` — kiểm tra consumer nội bộ, 0 thì **DELETE** |
| Offline | `PwaStatus` (bless — raw, token hoá CSS từ P2) | — |
| Error boundary | `ErrorBoundary` (bless; ruột antd Result → chuyển UiStateSurface nếu an toàn trong P3, không thì P4) | — |

## 6. Demo/catalog

| Purpose | CANONICAL | Số phận bản cũ |
|---|---|---|
| Component catalog | `/ui-foundation` (FoundationCatalogPage — production exports, mở rộng toàn bộ variant/state) | `modules/component-catalog` (antd demo, dùng toàn deprecated) → **DELETE**, route `/component-catalog` → redirect `/ui-foundation` (giữ key REQ-017) |

## 7. Guard sau Part 3

- `deprecated-components` test: đóng băng consumer của mọi ADAPTER (StatusTag, TopPagination, MvpListPagination, DataTable, PageHeader, ReportKpiCard, useSortTooltipColumns, AppBreadcrumb) — consumer MỚI ⇒ fail.
- `ui:architecture`/`ui:tokens`/`ui:styles` ratchet như Part 2 (baseline cập nhật sau deletions).
- action-standard allowlist: bỏ mục AppHeader (đã xoá).
