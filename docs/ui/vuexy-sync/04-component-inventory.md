# 04 — Component Inventory

Ngày: 2026-08-27 · SHA: `a908c420663270d783a34fd378689f7940377c85`
Consumer = số file import symbol, "external" loại trừ `src/shared/components/**` và `*.test.*`.

## 1. Tổng quan shared components (`src/shared/components/`)

Tổng file component (trừ test/barrel/types): **antd-based 44 · MUI-based 18 · mixed 2 (`MvpListPagination`, `TableToolbar`) · ApexCharts 4 · raw/none ~20**.

Quy ước tài liệu hoá mâu thuẫn nhau:
- `src/shared/components/README.md`: chuẩn hoá theo **vocabulary antd** ("loading/disabled/danger đặt tên đúng như antd", `size: 'small'|'middle'|'large'`), form đi qua `FormField` (antd Form.Item + RHF).
- `src/shared/components/actions/README.md`: chuẩn hoá action layer trên **MUI** (`ActionButton`/`ActionIconButton`/`ActionGroup`, variant="text", size="small"), cấm import `@ant-design/icons`/`@mui/icons-material` trong business screens, allowlist raw Button được enforce bởi `action-standard.test.ts`.

## 2. Component Inventory theo purpose

Cột "Vuexy/Mini App": tương đương trong hệ X (`Mini_App_WMS_Hoa_Nam`); Vuexy source N/A (thiếu licensed source — xem BC-01).

| Component purpose | Vuexy (X spec) | Mini App impl | Web implementations (số impl) | Consumers | Variants/states | Gap | Severity |
|---|---|---|---|---|---|---|---|
| Button (action) | Button 38-44px, radius 6-8, primary `#7367F0` | `AppButton` (`.wms-button--primary/secondary/ghost/danger`) | **ĐÃ HỢP NHẤT tốt**: `ActionButton` (MUI, 39 ext) + `ActionIconButton` (MUI, 21 ext) + allowlist 4 file dùng Button trực tiếp (AppHeader†, NotificationBell, DashboardPage, SideNav raw `<button>`×3 — SideNav KHÔNG có trong allowlist README) | 39+21 | kind/appearance/tonal per `action-kinds` | Token sai (xanh `#2563eb`, cao 36 vs 38-44); SideNav ngoài allowlist | **P1** (token), P2 (SideNav) |
| Modal/Dialog | Sheet radius 16-20, backdrop blur | `WmsModal` (bottom sheet) | **3 impl cạnh tranh**: MUI `Dialog` trực tiếp (22 file); antd `Modal` trực tiếp (3 file: IamRolePermissionScreen, ApiMasterScreens, NotificationDetailModal); shared antd `Modal`/`FormModal`/`FormDrawer`/`DetailDrawer`/`confirmDialog` (0-1 ext — gần chết). `ApiMasterScreens.tsx` dùng CẢ BA cùng lúc | 22/3/≤1 | confirm/detail/form | 2 hành vi đóng-mở, 2 hệ animation, 2 backdrop trong cùng flow | **P0** (UX drift trong cùng flow nghiệp vụ) |
| Table | Spec X §3 desktop: multi-col table, filter luôn hiện | (mobile — list card) | **3 impl + 2 raw**: antd `Table` trực tiếp (12 file, chủ yếu trong modal); `DataTable` (antd wrapper, 5); `ResponsiveDataTable` (MUI + raw `<table>`, 7 — các trang list chính); raw `<table>` (ApiMasterScreens ×3, IamUserScreen ×1); `TableContainer`/`TableToolbar` (0 ext — chết) | 12/5/7/2 | sort/pagination/empty/loading khác nhau từng impl | Trang list = MUI table, modal detail = antd Table → cùng flow 2 kiểu bảng, 2 kiểu sort icon, 2 pagination | **P0** |
| Form input/select | Input 44-48px (X), 38 (live), label 13 | `WmsInput/WmsSelect/WmsTextArea/WmsField` | MUI `TextField` trực tiếp (25 file) + MUI `Select` (14) + MUI `Autocomplete` (9) **vs** shared antd forms layer (`FormInput/FormSelect/FormDatePicker/FormNumber/FormSwitch/FormTextarea/FormAutocomplete` + alias `TextField/SelectField/DateField`) — **forms layer chỉ còn 3 trang auth dùng, còn lại 0 external** | 25 vs 3 | RHF Controller chỉ ở nhánh antd; nhánh MUI tự quản state | 2 hệ validation/label/error style; forms/ antd gần chết nhưng vẫn ship | **P0** |
| DatePicker | — | — | antd `DatePicker` (qua FormDatePicker + AlignedReportsPage, Gd1ScopeReports dùng antd picker trực tiếp) — chưa có MUI date picker (không có @mui/x-date-pickers) | ~4 | range/quarter presets (`date-presets.ts` dayjs) | Nếu bỏ antd cần thay thế picker — điểm khó nhất của việc gỡ antd | **P1** (rào cản kỹ thuật) |
| Status tag/chip | `.wms-chip--*`, `.wms-status--*` | StatusBadge/Chip X | antd `Tag` trực tiếp (**31 file** — symbol antd được import nhiều nhất) vs `StatusTag` (MUI Chip, 4) vs `StatusBadge` (MUI, 0 ext) vs `ReversalStatusTag` (antd, module-local) | 31/4/0 | màu status map tay từng nơi | Cùng một trạng thái nghiệp vụ render 2 kiểu chip | **P1** |
| Pagination | — | — | **5 impl**: antd `Pagination` trực tiếp (8); `TopPagination` (antd, 3); `MvpPaginationFooter`+`MvpPageSizeSelector` (mixed, 3); `Pagination` shared (antd, 0 ext); `PageSizeSelector` (MUI, 0 ext) | 8/3/3/0/0 | page-size options lệch nhau | Hợp nhất về 1 | **P1** |
| Toast/notification | X: notice + snackbar zmp | `WmsNotice`, SnackbarProvider | **ĐÃ HỢP NHẤT**: sonner (30 file, 189 call sites) + `<Toaster>` mount 1 lần ở AppProviders; sót 2 offender: antd `message` (WarrantyPage.tsx), antd `Modal.confirm` (ApiMasterScreens.tsx:127) | 30 | success/error/warning/info | Chỉ còn 2 chỗ lệch | P2 |
| Icons | Inline SVG registry | `Icon.tsx` (IconName union) | **ĐÃ HỢP NHẤT**: shim Flaticon `shared/components/icons` (90 icons, 35 consumers); 1 inline SVG (IamUserScreen); `@ant-design/icons` dependency chết | 35 | — | Xoá dep chết; quyết định có đổi family theo Vuexy không | P2 |
| Charts | — (X không dùng chart lib) | — | ApexCharts qua 4 wrapper (`AreaChart/BarChart/DonutChart/HorizontalBarChart`) + `chart-theme.ts` + `DonutBreakdown` (MUI); 1 dùng trực tiếp ở TraySelectionGrid | ~6 | CHART_COLORS cool palette | Chỉ cần đổi token palette | P2 |
| Layout shell | X §3: sidebar trắng 260px, header 80px sticky | (mobile bottom-nav) | MainLayout + SideNav **tự viết raw** (`.hn-mvp-*`, sidebar tối `#0f172a`) — trong khi shared `AppShell/Sidebar/Header/Breadcrumb` (antd, **0 ext — chết toàn bộ**) và `AppHeader/AppFooter/PartnerLayout` (antd, **chết**) và `layout.styles.ts` (một phần chết) vẫn tồn tại | 1 shell sống + 8 file shell chết | collapse persist localStorage | Shell là nơi lệch Vuexy nặng nhất (màu + cấu trúc); 8 file chết gây nhiễu | **P0** (shell), P2 (xoá chết) |
| Cards/KPI | `.wms-kpi`, KpiCard | `KpiCard`, `ActionCard` | `StatCard`/`InfoCard` (antd, 0 ext — chết); `ReportKpiCard`/`ReportChartPanel` (MUI, 1-2); Dashboard tự viết `DashboardMetricCard` local | 0/2/local | — | 3 kiểu KPI card, 1 chết | P2 |
| Feedback states | X §4: Empty/Loading/Error chuẩn | `EmptyState/ErrorState/LoadingState` | antd `EmptyState/LoadingState/BusinessState/ApiErrorAlert/NoPermissionState` (sống) + `ErrorState` raw (composes ActionButton) + `PageSkeleton` (antd) | nhiều | loading/empty/error/no-permission | Nhất quán khá; chỉ cần retheme | P2 |
| Scan/camera | `ScanModeSelector`, ScannerPage ZXing | (X có scanner riêng) | `CameraScanModal`, `ScanInput` (antd — giữ nguyên qua migration theo commit 5df4f21) | nhiều | camera/manual fallback | antd-based, nằm trong flow nghiệp vụ nhạy cảm — migrate cuối | **P1** (rủi ro cao khi đổi) |
| Attachments | — | WarrantyReceivePage media | `DocumentAttachmentsPanel` (MUI + sonner) | ~3 | upload/list/delete | ổn | P2 |
| Permission gate | — | AuthGate | `RequirePermission` (router), `PermissionGuard` (raw), `useCan/useHasPermission` (barrel 16 consumers), `ActionButton` permission prop | 16+ | — | ổn về logic; xem SEC-RBAC-01 (05-screen-role-inventory) | — |

† `AppHeader` nằm trong allowlist nhưng bản thân nó là file chết (không được mount).

## 3. Dead exports trong shared (0 external consumers) — 41 symbols

`TableContainer`, `FilteredEmptyState`, `TableToolbar`, `Modal`, `FormDrawer`, `DetailDrawer`, `FormPage`, `FormSection`, `FormActions`, `confirmDialog`, `Alert`, `StatusBadge`, `Pagination`, `PageSizeSelector`, `AppShell`, `Sidebar`, `Header`, `Breadcrumb`, `MenuItem`, `Tabs`, `StatCard`, `InfoCard`, `PlaceholderPage`, `FormSelect`, `FormDatePicker`, `FormNumber`, `FormSwitch`, `FormTextarea`, `FormAutocomplete`, `TextField`, `SelectField`, `DateField`, `FormError`, `FieldError`, `ActionGroup`, `AdaptiveDelayedRender`, `DelayedRender`, `BusinessState`(*), `renderSortIcon`(*), + (`PermissionGuard`, `FormField` — dùng nội bộ/qua barrel, không chết thật).

→ Phần lớn tầng shared antd (layout/, cards/, forms/, ½ feedback/) là **di sản của kiến trúc antd cũ đã bị bypass** sau commit 5df4f21. Đây vừa là nhiễu (dev mới không biết dùng gì) vừa là cơ hội: xoá được ~40 file không gãy gì.

## 4. Điểm mấu chốt cho remediation

1. Mẫu hợp nhất ĐÃ THÀNH CÔNG 3 lần trong repo: **icons** (1 shim, 35 consumers), **toasts** (sonner, 30 files, còn 2 sót), **actions** (ActionButton/ActionIconButton + test enforce allowlist). → Lặp lại đúng pattern đó (wrapper + test enforce + allowlist) cho Modal, Table, Form input, Tag, Pagination.
2. Thứ tự khó tăng dần khi gỡ antd: Tag/Pagination (dễ) → Modal (22 MUI + 3 antd → chuẩn 1 wrapper) → Form (RHF binding cho MUI) → Table (antd Table còn 12+5 chỗ, tính năng sort/virtual) → DatePicker (cần lib thay thế) → CameraScanModal/ScanInput (flow nghiệp vụ scan — cuối cùng, có E2E bảo vệ).
3. 29 file import đồng thời antd+MUI là danh sách việc chính của Prompt 3-4 (liệt kê đầy đủ trong `06-library-import-graph.md`).
