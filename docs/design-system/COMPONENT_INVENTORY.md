# WWHN-29 Component Inventory

Status: implementation baseline
Owner: FE Module 1
Evidence scope: shared app shell, RBAC, shared states, form/table/scan/status/audit baseline

| Component | Purpose | Path | API/props | Supported states | Accessibility | Responsive behavior | Reuse target | Test/evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `MainLayout` | Authenticated app shell | `src/app/layouts/MainLayout.tsx` | route outlet | loading through route suspense | landmarks via Ant Layout | sidebar collapses/drawer handled by layout styles | all authenticated pages | `src/app/layouts/SideNav.test.tsx` |
| `SideNav` | RBAC filtered navigation | `src/app/layouts/SideNav.tsx`, `src/app/layouts/menu.tsx` | menu config and permission state | expanded, collapsed, filtered | keyboard behavior inherited from Ant Menu | desktop sidebar, mobile drawer pattern | all modules | `src/app/layouts/SideNav.test.tsx` |
| `RequirePermission` | Route guard | `src/app/router/RequirePermission.tsx` | `permission?: string | string[]` | loading profile, allowed, blocked | redirects to 403 guidance page | stable on refresh/direct URL | protected routes | `src/app/router/RequirePermission.test.tsx` |
| `PermissionGuard` | Conditional content/action wrapper | `src/shared/components/permission/PermissionGuard.tsx` | module/action/permissionCode, fallback | hidden, fallback, allowed | avoids unreachable controls | inline, table action, toolbar action | all action areas | `src/shared/components/permission/**` tests |
| `ActionButton` | Permission-aware button | `src/shared/components/permission/ActionButton.tsx` | module/action/permissionCode, hide/disable | hidden, disabled, loading | disabled title explains reason | toolbar/table row safe | create/edit/delete/bulk actions | `ActionButton.test.tsx` |
| `NoPermissionState` | 403 guidance state | `src/shared/components/feedback/NoPermissionState.tsx` | title, description, action, home button | blocked, back/home action | clear text and actionable buttons | centered page/card width | route/API 403 UX | `NoPermissionPage.tsx`, router tests |
| `ApiErrorAlert` | Shared API error state | `src/shared/components/feedback/ApiErrorAlert.tsx` | error, title, retry | error, validation details, retry | alert semantics from Ant Alert | full-width in table/form pages | all query/mutation errors | API error tests |
| `Loading`, `LoadingState`, `PageSkeleton` | Loading baseline | feedback/data-display/ui-states | tip/minHeight | route, block, table skeleton | busy visual state | fixed min-height prevents jump | routes/tables/cards | shared tests and usage |
| `EmptyState` | Empty data state | `src/shared/components/data-display/EmptyState.tsx` | title, description, children | default, filtered, action | readable empty guidance | centered within container | all list/table pages | shared tests |
| `confirmDialog`, `ConfirmButton` | Confirm baseline | `src/shared/components/feedback` | title/content/onConfirm/loading | confirm, pending, cancelled | Ant modal focus trap | responsive modal width | destructive/save actions | component tests |
| `FormModal`, `FormDrawer`, `FormPage`, `FormSection`, `FormActions` | Shared form wrappers | `src/shared/components/feedback` and `forms` | open/title/loading/actions/fields | loading, validation, disabled, submit | focus trap in modal/drawer, labels through Form.Item | drawer/modal adapt to viewport | create/edit/detail workflows | form component tests |
| `FormInput`, `FormSelect`, `FormDatePicker`, `FormNumber`, `FormSwitch`, `FormTextarea` | Field controls | `src/shared/components/forms` | react-hook-form control/name/label | validation, disabled, required, IME safe | labelled controls and field errors | full-width by container | all business forms | `useFormPattern.test.tsx` |
| `TableContainer`, `DataTable`, `TableToolbar`, `TopPagination`, `PageSizeSelector` | Table baseline | `src/shared/components/data-display` | toolbar/loading/error/empty/pagination/sort | loading, empty, filtered empty, error, retry | Ant Table keyboard/labels | horizontal overflow owned by table container | list pages | `TableContainer.test.tsx`, table hook tests |
| `ScanInput` | Barcode/QR/manual scan baseline | `src/shared/components/forms/ScanInput.tsx` | value, recentCodes, error, onScan | autofocus, empty error, duplicate error, disabled | `aria-label`, alert message, focus retained | width inherited from parent/toolbars | inbound/outbound/stocktake/physical code scan | `shared-components.test.tsx` |
| `StatusBadge`, `StatusTag` | Status/chip baseline | `src/shared/components/data-display` | active/status/map props | active/inactive/custom semantic | text and color paired | inline table-safe | every status column | shared tests |
| `AuditLogsTable`, `AuditLogDetailDrawer` | Audit baseline | `src/modules/audit-logs/components` | data/loading/page/sort/view | loading, empty, detail drawer | table semantics and drawer close | table overflow plus drawer | audit trail display pattern | audit page usage |

## Shared UI State Baseline

| State | Shared abstraction | Required behavior |
| --- | --- | --- |
| Loading | `Loading`, `LoadingState`, `PageSkeleton`, `TableContainer.loading` | visible progress, stable height, no blank page |
| Empty | `EmptyState`, `FilteredEmptyState`, `TableContainer.emptyState` | explain empty/filter state and optional action |
| Error | `ApiErrorAlert`, `ErrorBoundary`, `ErrorState` | show reason, retry when available, preserve page shell |
| Confirm | `confirmDialog`, `ConfirmButton` | explicit user confirmation before destructive/save-risk actions |
| Success/toast | `sonner` mounted in `App.tsx` | mutation success is shown through shared toaster |
| Disabled | Ant disabled props, `ActionButton` disabled mode | unavailable actions explain why via title/tooltip |
| 403 | `RequirePermission`, `NoPermissionPage`, `NoPermissionState` | direct URL blocked, back/home guidance, no loop |

## Disposition

Scan and audit are included in this baseline. `ScanInput` is the reusable contract for scan entry; module pages should migrate page-local `Input.Search` instances to it as they move past prototype data. Audit has a concrete table/detail drawer pattern in `modules/audit-logs`.
