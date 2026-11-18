# Contextual SKU links in import results

User approved replacing the generic catalog shortcut with links to written SKUs and existing duplicate SKUs. Implement inline in the existing FE/BE checkouts; preserve unrelated local changes.

## Design and decisions

- Remove the generic catalog link from Overview, retaining the import source label.
- Persist immutable SKU IDs, code snapshots and CREATED/UPDATED actions atomically with a successful import report. Dry runs and rejected imports record no writes. Legacy reports retain unknown linkage; do not reconstruct from current codes or source files.
- Add a paginated, permission- and actor-scoped written-SKU endpoint. Return whether each original ID still exists. Keep the snapshot array out of report lists/history payloads.
- Resolve only DUPLICATE_CODE / sku_code issues to an exact existing SKU ID; batch duplicates and unrelated errors do not get links.
- In Results, allow users to expand the written-SKU list, then open a specific SKU in a new tab. Distinguish loading, failure, legacy and empty states. Version changes reset the panel.
- Add SKU detail deep links by immutable ID; fetch detail directly, independently of the catalog's current page/filters. Preserve unrelated URL parameters on close and disclose unavailable detail.
- Keep current tokens/components and Vietnamese/English/Chinese messages.

## Tasks / verification ledger

1. Backend tests first: committed create/update linkage; dry run/rejection/legacy states; exact duplicate resolution; pagination; actor scope and permissions. Add nullable JSON migration, write tracking, scoped endpoint and issue enrichment.
2. Frontend tests first: remove generic link; version-specific written list; duplicate links; direct SKU detail independent of list pagination. Implement API mapping, result list and deep-link handling.
3. Run focused FE/BE regressions, FE typecheck/lint/build and relevant browser checks. Record actual results and limitations; no deployment is implied.

## Results ledger

- Backend task complete: 24/24 focused tests, 220 assertions; Pint passed. No live database migration was applied.
- Initial frontend implementation: 19/19 focused tests passed. Broader run: 53 passed and one pre-existing Defect filter-toggle failure. Original HEAD test reproduced the same failure in isolation; temporary baseline copy removed.
- Browser verification: 4/4 tests passed in light/dark, desktop and narrow layouts. Screenshots reviewed. Typecheck and targeted lint passed.
- Final read-only reviewer found an off-page linked SKU would lose its detail after a stale publish response. Regression with Axios-shaped 412 response observed RED→GREEN; fix reloads the linked detail by ID, without retrying the mutation. Final related FE suite: 54 passed, 1 known baseline test excluded, across 9 files. Final `npm run build` and targeted ESLint passed. Vite retains its existing large-chunk warning for shared dependencies.
- Review excluded browser rendering (covered by the parent browser checks) and the unchanged Defect test failure (reproduced independently). No other Critical/Important findings were reported.
- No deferred minor findings, no commits or deployment requested.

See `docs/qa/contextual-import-skus-2026-11-18.md` for behavior, rollout contract and known baseline failure.

Status: complete in source; not deployed.
