# WAR-01 reference verification

Date: 2026-09-23
Branch: dev
Workspace: C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE

## Reference and scope

Reference gallery: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914

The “Bảo hành sửa chữa · Hồ sơ bảo hành” group contains two default-state images: desktop 1920 × 1080 and tablet 1600 × 2560. Other warranty-component report images belong to another screen. The supplied group does not provide detailed modal or interaction states.

This change adapts WAR-01's header, list card, filters, table, badges, menus, pagination, spacing and responsive layout to those images. Existing intake and detail dialogs receive locally scoped typography, control sizing and blue focus/selection styles. Native date inputs retain their existing behavior; their OS/browser popup appearance cannot be fully controlled by the page stylesheet.

## Preserved contracts

- Existing warranty list API, parameters, search debounce/Enter behavior, status/identification/defect filters and pagination.
- Existing permissions, PII masking and deep links (WAR-02, WAR-03 and COMP-01).
- Existing intake/detail dialogs, validation, mutations, invalidate/open-created flow and callbacks.
- Original table sort accessors, including defect and identification in the additional sort menu.
- Actual supplied record data only. Missing serial/deadline/age fields are not fabricated. Date display in the list uses slashes; original timestamp remains available as a tooltip.

No service, hook, backend or mutation implementation was changed by this WAR-01 work. Shared layout changes present in the workspace are outside this change. The defect field is omitted from the desktop/tablet table to match the reference, retained on mobile and accessible in the existing detail flow. The identified badge is visually hidden; temporary-intake identification remains visible.

## Verification

- WarrantyPage: 23 tests passed.
- Warranty service: 16 tests passed.
- WarrantyDetailModal: 16 tests passed.
- Scoped ESLint: no errors; two existing React Hook Form watch compatibility warnings in the dialogs.
- Scoped Prettier and git diff whitespace check passed.
- Browser checks at 1920 × 1080, 1024 × 1366, 768 × 1024, 390 × 844 and 320 × 740: no document horizontal overflow or controls extending beyond the viewport.
- Confirmed live status filtering, search with no results, reset, responsive table/card layout, and intake dialog opening/closing with scrollable body and visible footer. No warranty record was created or edited during browser checks.
- Automated tests cover loading, empty, error/retry, keyboard case/menu actions, filters/reset, existing sorting, missing values and opening the existing detail flow from product text.

Project-wide checks were not clean during this run. TypeScript failures were reported in outbound interaction tests and PackingLabelPrintReport. UI style/token guards reported violations in unrelated shell/auth/report/source-screen files. No WAR-01 file appeared in those failures. These concurrent/pre-existing changes were not modified as part of this task.

## Pending scope approval and remaining differences

The implementation is not a 100% match yet. The reference's overview/progress card and “Tình trạng hạn” filter require data/aggregation that the existing list contract does not supply. An initial proposal adding read-side aggregation/filter behavior was rejected by automatic approval review as exceeding the explicit “UI only, preserve logic” constraint. That proposal was not applied. Its unused new files were removed, and the user was asked to approve a concrete read-only extension using existing warranty APIs while preserving mutation APIs, permissions and intake/repair/return flows.

Until that approval, retain the working existing defect filter rather than introducing an inactive due filter or fake overview figures. The pending extension would also need complete-pagination and failure handling; current-page counts must not be presented as whole-dataset KPIs.

The shared shell/navigation and native calendar popup are not asserted to be pixel-identical. No pixel-difference claim or unsupported “all states match” claim is made from two default reference screenshots.
