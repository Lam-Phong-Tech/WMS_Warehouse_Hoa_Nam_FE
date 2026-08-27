# 15 — Component Contracts (Part 3)

Ngày: 2026-08-28 · Baseline source chung: **DEC-UI-BASELINE-01** (design-language parity theo Vuexy Vuejs demo-1, đo 27-28/08) + canonical tokens 11-canonical-token-contract.md; licensed source: không dùng (D1).
Trường chung (ghi 1 lần, áp cho MỌI component bên dưới — chỉ ghi lại ở component nào có khác biệt):
- **Token dependencies:** SEMANTIC_LIGHT (màu/emphasis/border/focus-ring/shadow) + COMPONENT_TOKENS (radius 6, control 38, chữ 15/13) + MOTION (90/140/200/280, easing chuẩn) — KHÔNG literal (guard `ui:tokens`).
- **Underlying adapter:** MUI 9 qua `mui-adapter` (trừ chỗ ghi antd).
- **Responsive:** không tràn ngang 320→1440 (E2E sweep 8 viewport trên catalog); grid/flex wrap; giữ hợp đồng 360/768/1280 của SRS.
- **Visual cases:** section tương ứng trong `/ui-foundation` (golden desktop 1280 + mobile 375, maxDiffPixelRatio 0.02).
- **Unit/interaction tests:** file `*.test.tsx` colocated cạnh component (43 test ui-foundation + 95 test wave-1 + suite tổng 992).
- **Acceptance Criteria chung:** computed style khớp token (E2E), ARIA đúng vai trò, keyboard vận hành được, không hex/font literal, không mount provider.

## A. Foundation / Layout

### UiText — Typography
Purpose: thang chữ canonical. Anatomy: 1 element (h1/h2/div/span). Variants: pageTitle 24/500 · cardTitle 18/600 · body 15 (div — nhận ReactNode block) · secondary 13 · caption 12. Sizes: theo variant. States: —. Keyboard/ARIA: heading levels đúng h1/h2. Duplicates cũ: antd Typography (features, P4). Deprecated: —. Migration map: P4 đổi dần Typography antd. AC: đúng size/weight/màu emphasis.

### UiIcon — Icon
Purpose: icon flaticon theo slug. Anatomy: `<i class="fi fi-rr-*">`. Variants: mọi slug. Sizes: sm16/md18/lg20. States: màu kế thừa/override token. ARIA: aria-hidden mặc định, aria-label khi có nghĩa. Duplicates: shim `shared/components/icons` (90 icon đặt tên) — CANONICAL đồng cấp cùng cơ chế. AC: cấm @ant-design/icons & @mui/icons-material (action-standard + dep chết).

### UiAppShell / UiSidebarNav / UiTopbar / UiPageContainer / UiBreadcrumb / UiFooter — Layout set
Purpose: shell Vuexy sáng (presentational — nối MainLayout ở P4). Baseline: spec X §3 [X] (sidebar 260/collapsed 72/topbar 80 — `layout-tokens.ts`). Anatomy: shell = grid sidebar+column(topbar/main/footer); sidebar = nav>groups>button items; container = breadcrumb+title-row+content. Variants: collapsed. States: item active (primary+onPrimary+aria-current="page"), hover primarySoft, focus-visible ring token; disabled —. Keyboard: item = button tab-được; Breadcrumbs phần tử cuối aria-current. ARIA: nav label "Điều hướng chính"/"Breadcrumb". Duplicates cũ: `layout/{AppShell,Sidebar,Header,Breadcrumb}` antd (ĐÃ XOÁ — 0 consumer), AppHeader/AppFooter/PartnerLayout (ĐÃ XOÁ). Adapter còn: PageHeader (freeze 2 consumer), AppBreadcrumb (freeze MainLayout). Migration: P4 swap MainLayout/SideNav → bộ này (+gỡ ?screen=/SEC-RBAC-01). Tests: 15 layout + E2E active-color/focus-ring. AC: active đúng #7367F0/#fff (E2E PASS).

### Grid/Stack/Divider/Popover/Tooltip/Menu/CircularProgress/Skeleton — primitives
Purpose: re-export MUI qua `@/shared/ui` (primitives-mui.ts) để feature không chạm engine. Contract = MUI, theme hoá sẵn. Duplicates: antd Row/Col/Space (features, P4).

## B. Actions

### ActionButton / ActionIconButton / ActionGroup — nút hành động nghiệp vụ (BLESS)
Purpose: mọi hành động dữ liệu (kind→icon/màu/tonal, permission+scope-aware, data-ui-state cho QA WWHN-268). Baseline: chuẩn a908c42 + token P2. Anatomy: MUI Button variant=text size=small + icon shim. Variants: kind (view/edit/create/delete/…) × appearance flat/tonal. States: hover/active motion, disabled-by-permission (tooltip + testid), loading (consumer tự quản). Keyboard/ARIA: button chuẩn; iconOnly bắt buộc aria-label. Duplicates: raw Button chỉ trong allowlist action-standard (NotificationBell, DashboardPage, UiButton.tsx, SideNav — enforce test). Tests: action-standard + consumer suites. AC: không màn nào tự dựng nút nghiệp vụ.

### UiButton / UiIconButton — nút primitive
Purpose: nút không-nghiệp-vụ (catalog/shell/submit). Anatomy: MUI Button/IconButton. Variants: appearance filled/tonal/outlined/text × color primary/secondary/success/warning/error/info. Sizes: theo theme (38px; small icon). States: hover(-1px)/active(0.97)/focus-visible/disabled/loading(spinner+disabled). ARIA: loading giữ accessible name. Duplicates: MUI Button trực tiếp trong features → ratchet ui:architecture (P4). Tests: foundation-computed-style + E2E (38px/6px/#7367F0). AC: đo computed PASS.

### ActionDropdown — dropdown action (BLESS)
Purpose: gom hành động phụ vào menu. Anatomy: ActionIconButton + MUI Menu (portal, theme từ root). States: item disabled-by-permission. Keyboard: MUI Menu chuẩn (arrow/Esc). Duplicates: —. AC: đóng khi chọn/Esc.

### UiConfirmDialog + useUiConfirm — confirm/destructive
Purpose: xác nhận hành động (thay antd Modal.confirm — promise API). Anatomy: UiDialog(xs) + 2 UiButton. Variants: tone primary/danger. States: loading khoá 2 nút. Keyboard: Esc=onClose, focus trap MUI. ARIA: aria-labelledby auto (useId). Duplicates cũ: `confirmDialog`/`ConfirmButton` antd (XOÁ), Modal.confirm cuối (ApiMasterScreens — ĐÃ THAY bằng useUiConfirm, antd static API = 0). Consumers hook: 3 master screens + catalog. Tests: colocated (focus/Escape/danger/loading) + master-data suite. AC: không còn antd static confirm trong src.

## C. Forms (`@/shared/ui/forms` — RHF Controller + MUI, lỗi từ fieldState)

Chung cho cả họ: Anatomy label(13)+control(38/radius6/chữ15)+helper/error(12.5, aria-describedby); required hiện *; States: default/hover/focus(viền primary)/error(viền+helper đỏ, label GIỮ màu)/disabled/read-only; IME tiếng Việt nguyên vẹn (không chặn keydown/composition — riêng numericOnly lọc sau onChange); Duplicates cũ: bộ antd `FormInput/FormSelect/FormDatePicker/FormNumber/FormSwitch/FormTextarea/FormAutocomplete/FormField + alias TextField/SelectField/DateField/FormError` — **ĐÃ XOÁ** (consumer cuối = 3 trang auth, đã migrate P3); MUI TextField trực tiếp trong features → ratchet (P4). Tests: 45 + auth suite 39.

- **UiFormText**: type text/password(toggle aria "Hiện/Ẩn mật khẩu")/search(icon); multiline/rows; startIcon slug; numericOnly+maxLength (OTP); AC: LoginPage/ForgotPassword/ChangePassword chạy đúng test cũ.
- **UiFormNumber**: number|null, giữ chuỗi gõ dở, clamp min/max khi blur, suffix (₫/cái), inputMode decimal.
- **UiFormSelect**: options{value,label,disabled}, multiple, placeholder textDisabled; labelId nối đúng; keyboard mở bằng ArrowDown/Enter.
- **UiFormAutocomplete**: lọc gõ, single/multiple, noOptionsText "Không có lựa chọn".
- **UiFormCheckbox / UiFormSwitch**: boolean; Space toggle; Switch role="switch"; ref RHF qua slotProps.input.
- **UiFormRadioGroup**: role=radiogroup + FormLabel aria-labelledby; arrow di chuyển; row?.
- **UiFormDate**: underlying adapter **antd DatePicker** (giữ value-contract dayjs như FormDatePicker cũ; đổi MUI X khi có Decision — deprecation note trong JSDoc); label/error bằng MUI cho đồng nhất.
- **UiFormField**: shell label+control tuỳ ý+helper (control không phải TextField).
- **ScanInput / CameraScanModal (BLESS, adapter antd)**: scanner input theo hợp đồng Annex D (auto-focus, Enter submit, giữ focus sau success/error, chặn trùng + alert); KHÔNG đổi trong P3 (rủi ro nghiệp vụ) — retheme qua antd-adapter; tests giữ nguyên PASS. Migration: P4 cuối cùng (D8).
- **Upload/Attachment — DocumentAttachmentsPanel (BLESS, MUI)**: hợp đồng evidence (PROVIDED gate) như hiện hành.

## D. Data display

### UiCard — Card
Surface trắng radius 6 + shadowCard; title 18/600 + action; disablePadding cho bảng full-bleed. Duplicates cũ: StatCard/InfoCard antd (XOÁ). AC: 1 card 1 mục đích (spec X §1).

### UiKpiCard — KPI/Statistic
label 13 + value 22/600 + icon ô 40px nền soft + hint. Tones = UiStatusTone. Adapter freeze: ReportKpiCard/Grid (2 trang reports — P4). AC: E2E 22px/600 PASS.

### ResponsiveDataTable — Table CANONICAL (BLESS)
Purpose: bảng list chính (desktop `<table>`+SortableTh, mobile card list — không bóp ngang). Anatomy: columns{render,sortAccessor|sortable,align,width,hideOnMobile,mobileLabel} + rows + rowKey + renderRowActions + rowSelection(useRowSelection) + sortState/onSortChange (server-sort). States: loading/empty(emptyText)/dense/selected. Keyboard: SortableTh là button; checkbox chọn dòng có label. Server pagination: đi cùng UiPagination/TopPagination — KHÔNG đổi hợp đồng page/per_page. Duplicates: `DataTable` (antd wrapper — ADAPTER freeze 4 consumer + PageSizeSelector internal), antd Table trực tiếp 12 modal (P4), raw table 2 file (P4). Visual: catalog dense 5 dòng + empty. AC: sort/selection tests hiện có PASS; WMS dense table không vỡ (sweep).

### FilterBar / SearchInput / TableToolbar-family
FilterBar (adapter antd — impl duy nhất purpose, retheme token, P4 xét gộp vào toolbar canonical); SearchInput (MUI bless). TableToolbar/TableContainer cũ (XOÁ).

### UiPagination — Pagination CANONICAL
"Tổng N bản ghi" + chọn n/trang + MUI Pagination rounded; nav aria "Phân trang"; page clamp; total=0 vẫn render. Adapters ruột-đã-canonical (API freeze): TopPagination (3), MvpPaginationFooter/MvpPageSizeSelector (3+3 — hết antd). Duplicates: antd Pagination trực tiếp 8 file (P4). AC: callbacks đúng ngữ nghĩa antd cũ (tests consumer PASS).

### UiTabs — Tabs
items{key,label,disabled}, scrollable, arrow-key MUI, textTransform none. Cũ: navigation/Tabs antd (XOÁ); MUI Tabs trực tiếp trong pages (P4 → UiTabs).

### UiStatusBadge — Badge/Chip/Status CANONICAL
Soft 16% + chữ `*Text` AA; tones 6. Adapter: StatusTag (map preset antd→tone, fail-safe neutral — freeze 3 consumer notifications). Duplicates: antd Tag 31 file (P4); StatusBadge cũ (XOÁ). AC: E2E màu PASS.

### UiAvatar / UiDescriptions / UiTimeline
Avatar: initials 2 từ cuối, nền primarySoft, 28/36/44, alt=name. Descriptions: grid 1/2/3 cột + span, label caption/value 15 (thay antd Descriptions dần P4). Timeline: ol tự dựng, chấm tone 10px + connector border token, role list. Duplicates: antd Avatar/Descriptions trong features (P4); Timeline chưa có bản cũ.

### Charts — AreaChart/BarChart/DonutChart/HorizontalBarChart + chart-theme + ReportChartPanel (BLESS)
ApexCharts wrappers, palette CATEGORICAL từ tokens (P2), font Public Sans. Container/legend/tooltip theo baseChartOptions. AC: không hex ngoài chart-theme→tokens.

## E. Overlay / Feedback

### UiDialog / UiDrawer — Modal/Drawer surface CANONICAL
Radius 6, Grow 280/200 + closeAfterTransition, aria-labelledby auto theo title (useId). Drawer phải width 420 (max 100vw). Duplicates cũ: feedback/{Modal,FormModal,FormDrawer,DetailDrawer,FormPage,FormSection,FormActions} antd (XOÁ); MUI Dialog trực tiếp 22 file (P4 quy về UiDialog). AC: E2E dialog radius/motion/đóng-sạch PASS.

### Toast — sonner (CANONICAL duy nhất)
Toaster mount 1 lần ở AppProviders; API toast.success/error/warning/info; antd message/notification = **0 usage** (WarrantyPage đã thay). AC: guard grep antd static API = 0.

### UiAlert / ApiErrorAlert
UiAlert: tone×(title/close/action), nền soft + chữ `*Text`, role=alert. ApiErrorAlert (ADAPTER-CANONICAL cho lỗi API): giữ nguyên hợp đồng message/getApiErrorMessage/field-errors/request_id/nút "Thử lại"/nhánh 403→NoPermissionState — ruột MUI Alert (P3). Cũ: feedback/Alert antd (XOÁ). AC: mọi consumer test PASS không sửa.

### UiStateSurface + adapters — Loading/Empty/Error/NoPermission/Skeleton/Offline
UiStateSurface: kind loading/empty/error/no-permission (icon/tone preset, role alert cho error, description nhận ReactNode + request_id). Adapters API-giữ-nguyên ruột foundation: EmptyState, LoadingState (aria-busy/live), ErrorState (↻ Thử lại), NoPermissionState (texts từng ký tự + navigate), Loading (overlay z token), PageSkeleton (MUI Skeleton, không layout-shift), ErrorBoundary. Offline: PwaStatus (bless — read-only shell theo WWHN-325). Cũ: PlaceholderPage/Adaptive-DelayedRender (XOÁ). AC: hợp đồng WWHN-268 data-ui-state giữ (ui-state.test PASS).

## F. Deprecated có ghi chú + guard (không phải public choice)
DataTable · useSortTooltipColumns · PageSizeSelector(internal) · TopPagination · MvpPaginationFooter/MvpPageSizeSelector · StatusTag · PageHeader · AppBreadcrumb · ReportKpiCard/Grid · SubmitButton (WWHN-268 emitter) — tất cả có JSDoc @deprecated + consumer đóng băng trong `allowlists/deprecated-components.json`, enforce bằng `deprecated-components.test.ts` (fail khi có consumer MỚI). Không còn cặp public cạnh tranh nào ngoài danh sách freeze này.
