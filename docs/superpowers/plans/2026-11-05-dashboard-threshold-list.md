# Dashboard threshold list implementation plan

**Goal:** Restyle MAP-01 threshold alerts using the supplied SKU table specification, with STT, real pagination, and details shown only after explicit SKU selection.

**Architecture:** Keep the existing stock snapshot query and `buildDashboardThresholds` unchanged. Extract the list, local filters, pagination and conditional detail pane into `ThresholdSkuList`. Scope all presentation to this view so other dashboard views retain their behavior.

**Spec:** `docs/ui/sku-list-filter-table-style.md`, the user's supplied copy, and the annotated MAP-01 screenshot in this chat. The supplied file takes priority for table typography and footer layout.

**Implementation and verification:**

- [x] Update tests to reject automatic selection and require STT, page slicing, continuous numbering, page-size changes and filter resets; observe failures.
- [x] Build the scoped list with search/status controls, shared responsive table and pagination, and an explicit close action for the selected detail pane.
- [x] Retain snapshot loading, initial error, stale-data retry and min/max calculations. Keep totals across the complete dataset.
- [x] Verify filtering/page changes hide previous details, empty ranges are honest, data shrink clamps the active page and keyboard actions reach details.
- [x] Run scoped tests, lint and typecheck. Check light/dark layouts at 1440, 1024, 768, 390 and 320px, table typography and pagination placement.
- [x] Obtain a read-only review and integrate current dev without overwriting other changes. Final delivery pushes the verified commit and checks its remote SHA.

**Rulings:** Desktop retains the screenshot's inline right pane, rather than introducing an overlay. On narrow screens selected details stack above the list and receive focus; the full list remains accessible. Default page size is 10, with existing project options 20 and 50. Filter or page changes clear explicit selection. No new dependency or API mutation is needed.
