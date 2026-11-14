# Dashboard payload optimization

> Execute inline using executing-plans and test-driven-development.

**Goal:** Reduce dashboard transfer and parsing while preserving every displayed value, permission, filter and drill-down.

**Design:** Add opt-in response projections to existing report endpoints. Apply projections after canonical builders/caches and authorization. Keep row order, row count and numeric values intact. Full reports remain the default. No new cache TTL or alternate stock calculation.

**Tech stack:** Laravel/PHP, React, TanStack Query, PHPUnit, Vitest.

## Data inventory

| Consumer | Required source/data | Decision |
| --- | --- | --- |
| KPI, issues, stock composition, warranty | dashboard-overview: kpi, flow_daily, stock_trend, stock_structure, issues, warranty | Preserve existing source and periods |
| Stock SKU count, legacy equation and top SKU | XNT lines: product_code/name, opening, receipt_net, issue_net, component_issue_net, reversal_unlinked_net, closing | Opt-in dashboard projection; retain every line |
| Chart with independent date range | dashboard-overview + inventory-xnt-daily | Preserve both sources and Vietnam date logic |
| Four threshold counts | reconciliation rows: product_code/name, sku_type, available_qty; shared SKU catalog: min/max | Compact reconciliation projection + same threshold calculation |
| Work/threshold detail views | full reconciliation evidence and catalog | Preserve full source |
| Recent five documents | io-history snapshot with canonical document/reversal enrichment and sorting | Preserve; limiting individual input pages without a matching global ordering contract could select the wrong five |
| Legacy threshold alert | dashboard-quick | Preserve in this change |

## Alternatives

Server aggregates would transfer fewer bytes but introduce a second implementation of existing numeric rules. Extending cache TTL would change freshness. Selected: lossless field projections, the smallest change supported by the audit and the user's request to preserve accuracy.

## Constraints and review focus

- No deployment, new dependencies, database changes, security/encryption changes or UI redesign.
- No truncation, rounding, row aggregation or default-zero substitution introduced by projection.
- Compact/full results must not contaminate query or server caches.
- Old backend ignoring the optional query parameter remains compatible.
- Test multiple warehouses/statuses, negative/fractional movement, empty rows, min/max zero/null, failed refresh and full-detail reads.

## Execution

- [x] Add failing HTTP parity/size tests for compact XNT and reconciliation; run to prove failure.
- [x] Implement explicit `view=dashboard` for XNT and `view=dashboard-thresholds` for reconciliation, after canonical payload construction. Reuse full report cache by removing only the recognized view from the cloned builder request.
- [x] Add frontend hook/consumer tests; use compact requests only in dashboard consumers, with distinct query keys.
- [x] Run backend report regression, frontend dashboard/report regression, lint/type/build checks and record fixture payload sizes.
- [x] Review diffs and document measured results and remaining runtime/deployment limits.

## Verification ledger

Backend report suites: 83/83 passed; dashboard subset with added permission checks: 11/11 passed. Frontend broad run: 129/132 passed, with three outdated request expectations; after updating those to include `view`, all 49 tests in the affected three files passed. Remaining broad-run files passed. ESLint passed. Production build (`tsc -b`, Vite, manifest) passed, with the existing large-chunk warning. OpenAPI attribute/schema reflection passed. Independent review found no functional regression; its documentation concern was addressed. No deployment or live post-change Lighthouse run.

Ruling: preserve canonical builders and shared catalog instead of introducing new SQL aggregates. This optimizes payload/decoding, not database compute. Fixture assertions establish >70% reconciliation and >50% XNT raw JSON reduction; they are not production measurements.
