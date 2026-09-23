# MST-01 SKU list — reference and verification

Date: 2026-09-22. Workspace: `C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE`, branch `dev`.

## Reference and scope

Reference: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914

Reviewed all 40 SKU list reference images: P01–P20, desktop and tablet. The implementation applies the reference palette, summary, labeled filter card, table card, row actions, feedback illustrations/banners, pagination, and responsive proportions. The list continues to use live API records; there are no screenshot fixtures or fabricated timestamps/counts in the product.

The screenshot set covers default, initial loading, refreshing, empty catalog, no results, load error, offline, retained stale data, filter chips, read-only, create pending, create success, duplicate, failed create, unknown create outcome, expired session, 403, 404, 500 and maintenance. Feedback is selected from actual query/mutation/network/permission state. Component tests exercise failure states without deliberately breaking the live backend or creating SKU records.

## Preserved business behavior

Existing SKU permissions, stock-based identity lock, query parameters, pending-information scan, sort/pagination calculations, validation, create/update payload, version/idempotency contract, publish endpoint, and Excel dry-run/commit remain in place. Added count probes use the existing SKU read hook and server pagination totals. Manual refresh and completed import also refresh the three summary counts.

Do not treat this implementation as a verified 100% pixel match. The reference includes barcode, row update time, and category/unit filter behavior not exposed by the current SKU list contract. The implementation retains the actual application fields and supported filters, including stock thresholds and publish actions, instead of inventing backend capabilities or removing existing business controls. These retained fields make the table differ from the reference.

## Browser checks

Checked widths 1920, 1440, 1024, 768, 390 and 320 px. No whole-page horizontal overflow was measured at these sizes. Long tables scroll inside their own region, with row actions pinned; narrow layouts wrap the header, filters, summary and footer. Tablet navigation uses the existing icon rail. Type scale follows the operations dashboard: 24 px main title, 18 px section title, 13–14 px table/body/secondary text, 38 px controls.

Exercised live UI search/no results/reset, refresh, detail/open/close, edit/open/cancel, create/open/required-field validation/cancel and Excel import/open/close. No record was created, updated, published or imported during browser checks. The API-loaded stock lock became active in the edit form as expected.

## Verification

Targeted regression set: MvpMasterScreens, SkuStockThresholds, SkuImportModal, sku-import.service, SkuThumbnail, SkuListOverview and SkuListFeedback (68 tests including the summary refresh regression).

Vite production bundling passed. Targeted SKU ESLint has no errors; the shared master screen retains three existing effect warnings. `git diff --check` passed.

The whole-project TypeScript check currently fails outside SKU in `src/modules/reports/packing-label/PackingLabelPrintReport.tsx`: missing `LabelSnapshotRecord.version` at lines 194, 201, 234 and 241, and a non-boolean busy value at line 301. Therefore the full `npm run build` pipeline cannot be reported as passing. Global style/token guards also contain unrelated shell/auth/report findings; the new SKU CSS entries are registered in the existing scoped reference allowlists.

## Parallel-session coordination

Changes in shared `ApiMasterScreens.tsx` were limited to SKU imports and SkuMasterScreen; agency changes were preserved. MainLayout changes only add SKU to the agreed route-specific sidebar sizing. Other sessions own agency, PV catalog and report work. No branch, commit, push or deployment was created.

## Tablet menu follow-up

A final cross-session review found SKU tablet layout was forcibly collapsed even after pinning the menu open. Added a SKU-only expansion override in MainLayout, preserving the other routes and 274/54 px widths. Verified pin/open, focus transfer back to content, and collapse at 1024 px without full-page horizontal overflow.

Additional navigation checks: UiAppShell 5/5 and mobile sidebar responsive guard 3/3 passed; SideNav 11/12 passed. The existing SideNav assertion at line 70 expects visible text `Hoa Nam WMS`, while the current shared brand displays `HOA NAM SCANNER`; no branding or SideNav test was changed by this SKU follow-up. MainLayout ESLint has no errors and retains its existing mobile drawer effect warning.
