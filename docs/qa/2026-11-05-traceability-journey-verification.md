# Goods trace verification — 2026-11-05

Implemented the accepted nine Desktop/Tablet reference scenarios using warehouse-scoped lifecycle events and independent current-state snapshots. Preserved approved unframed 48px table filters and removed header clutter. The same chat's outbound and stock report refinements are included; latest origin/dev inbound filter changes are retained.

Backend commits: be22b274 and 85a93541. Final targeted verification: 28 tests, 233 assertions pass; PHP syntax/Pint pass. Independent review found four blockers (current-state warehouse scope, per-serial vs SKU balances, lost related container history, source document kinds); all four were fixed, covered, and approved on targeted re-review.

Frontend: 13 UI behavior tests and 7 API contract tests pass before final integration. TypeScript and production build passed. Final integration test/build results are recorded below when complete. Real React browser QA passed overview at 1440/1024/768/390/320 without document overflow and 48px inputs, export dialog, event drawer, serial tabs and BOX relationship view with controlled API fixtures (not a claim of live production data validation).

## Explicit limitations

- A warehouse-scoped actor receives no current physical snapshot or packing relation when current warehouse ownership cannot be independently established. Historical scoped evidence does not authorize current out-of-scope state. The API returns an explicit warning.
- Per-entity before/after and delta stay null when only aggregate SKU ledger values are known. Source ledger values are shown/exported separately; no invented serial balances or completeness percentages.
- Backend full suite was stopped incomplete after more than 15 minutes; it began before final review fixes. Do not claim it passed. Final changed-scope backend suites are green.
- The wider frontend reports run completed 237 passed / 39 failed across 42 files. Failing files are outside changed report paths and listed below; do not claim the wider suite is green. Some failures use Node 26's unavailable localStorage; others are existing source-contract or expected-label mismatches. No unrelated fixes were included.

- `src/modules/reports/reports-api-only.test.ts`
- `src/modules/reports/components/ReportWarehouseCard.test.tsx`
- `src/modules/reports/io-history/IoHistoryFeedback.locale.test.tsx`
- `src/modules/reports/io-history/IoHistoryReport.test.tsx`
- `src/modules/reports/recipient-agency/AgencyComparisonTab.test.tsx`
- `src/modules/reports/warranty-components/WarrantyComponentsReport.test.tsx`
- `src/modules/reports/io-history/rpt08/report-layout.test.tsx`

## Final integration result

- Frontend Node 22 targeted integration run: 6 files / 36 tests passed (new goods trace UI+contract, outbound report, stock reconciliation, retained inbound filters/sort).
- Final production build (TypeScript + Vite + manifest): passed; existing large-chunk warning remains.
- Scoped ESLint and git diff --check: passed.
- Inventory lookup opens the authorized inventory module in a separate tab; report filters remain mounted. Source warranty/reversal deep links use verified routes.
