# Page size menu consistency

**Goal:** Every page size choice remains on one line in Vietnamese, English and Chinese, including unselected choices and narrow layouts.

**Architecture:** Give UiSelect an explicit page-size mode with non-wrapping options and width fitted to every option. Migrate all page-size consumers, including shared pagination adapters, to this mode. Preserve ordinary filter wrapping, page sizes, callbacks, and data queries. Use the existing localized per-page label everywhere.

**Spec:** docs/ui/sku-list-filter-table-style.md and the user's screenshots of outbound versus SKU menus.

**Execution:** Inline; systematic debugging and test-driven development.

- [x] Inventory every pagination selector and reproduce the outbound wrapping in a browser.
- [x] Add failing regression for the shared selector's page-size mode, implement it, and migrate all consumers.
- [x] Check source inventory for remaining exceptions and add a guard against unmarked page-size selectors/hard-coded labels.
- [x] Verify menus at narrow/wide widths and all three languages, focused behavior tests, lint and type/build checks.
- [x] Document verified scope and limits in the canonical UI guide and report the cause.

## Verification ledger

33 selectors inventoried (31 feature callsites and two shared adapters). Browser reproduced 20/50 per-page wrapping in the actual outbound page fixture. Root causes: UiSelect applies normal/anywhere wrapping to all options, and screen filter CSS overrides its min-width. Explicit page-size mode uses non-wrapping options plus an inline minimum width fitted to all labels; ordinary filters retain wrapping. All pagination labels now use shared.table.perPage.

29 shared component tests passed, including three failing-before-fix locale cases; 21 browser scenarios covered shared adapters and actual outbound/SKU components at narrow/wide widths in VI/EN/ZH. Initial browser run: 19 passed; two mobile outbound checks incorrectly counted empty MUI ripple element rectangles as text lines. Measuring only text nodes corrected the diagnostic; both targeted reruns passed. No production change was needed for that test correction. TypeScript + production build and ESLint for all migrated files passed. Independent review found no production regression; its guard substring concern was fixed by checking exact translation calls in every option label, with seven guard self-tests passing.

Full ui:guards: page-size checks and other self-tests passed. Existing architecture/token/style checks cannot read three absent allowlist files; icon guard reports six violations in untouched files. No allowlists were invented and no unrelated icon changes were made. See docs/qa/page-size-single-line-2026-11-14.md. No deployment or live-site post-deployment verification.
