# Page size menu audit — 14/11/2026

The outbound fixture reproduced the reported failure: `20 / trang` and `50 / trang` wrapped while `10 / trang` stayed on one line. UiSelect deliberately allowed ordinary filter labels to wrap, and the outbound screen's `.MuiFormControl-root { min-width: 0 }` overrode its shared width. Pagination had no distinct rendering contract.

## Source coverage

Every existing page-size selector found in the source now uses `UiSelect kind="page-size"` and `shared.table.perPage`. The new mode measures all choices, retains a minimum width above screen filter overrides, prevents flex shrinking, and prevents wrapping for selected and unselected options. Ordinary filters keep their existing wrapping and searchable behavior. Page size values, query parameters, page reset callbacks and permission rules are preserved.

| Area | Selectors |
| --- | ---: |
| Audit logs and account history/devices | 3 |
| Dashboard tables and thresholds | 2 |
| Effective permissions | 1 |
| Inbound | 1 |
| Inventory | 2 |
| SKU, recipients, defects, product catalogs, suppliers | 5 |
| Outbound and outbound NFC products | 2 |
| Putaway queue/orders and history | 2 |
| Reports: import quality, inbound/outbound flow, IO history, movement/goods trace, packing labels, recipients, stock reconciliation, warranty components | 10 |
| Reversals | 1 |
| Warranty and component issue lists | 2 |
| UiPagination and legacy MvpPageSizeSelector | 2 |
| **Total** | **33** |

TopPagination and other screens using UiPagination inherit the shared fix. `node scripts/check-page-size-selectors.mjs --list` prints the current source locations. The checker rejects missing page-size mode, raw selectors, untranslated labels, ARIA-key false positives and mixed translated/hard-coded labels. It is included in `ui:guards`.

## Verification

- `UiSelect.test.tsx` + `UiPagination.test.tsx`: 29 passed. Covers every option in VI/EN/ZH, selection callbacks, width, empty/disabled pagination and ordinary filter behavior.
- `playwright.page-size.config.ts`: 21 scenarios across shared UiSelect/UiPagination/MvpPageSizeSelector/TopPagination and the actual outbound/SKU pages. VI/EN/ZH; widths 320/390/1536 for shared adapters, 390/1536 for actual pages; shared adapters also tested in dark mode. Service data is mocked in the existing page fixtures. Menu text geometry, non-wrapping CSS, clipping and selection were checked. First run 19 passed; two mobile outbound checks were corrected to exclude empty ripple-element rectangles, then both reruns passed.
- Page-size source guard: 33/33; guard self-tests: 7/7.
- ESLint for migrated selectors, shared components, regression fixture and spec: passed.
- Production build, including TypeScript: passed. Existing large-chunk warning remains.
- Independent read-only review: no production correctness findings. The guard's translation matching was strengthened following review.

## Limits and unrelated checks

This is source-wide migration and targeted runtime verification, not a claim that every route and every data state was opened interactively. No deployment was performed; the hosted website still needs the updated build.

The full UI guard runner remains red outside pagination: architecture/tokens/styles cannot read `direct-ui-imports.json`, `hardcoded-hex-baseline.json`, and `css-baseline.json` under `docs/ui/vuexy-sync/allowlists/`. The icon guard reports six existing issues in HoaNamAuthShell, ForgotPasswordPage, IamRoleMatrix and the shared icon registry. Those source files were not changed by this task. Pagination checks and the guard self-tests pass; no baseline was created to conceal other failures.
