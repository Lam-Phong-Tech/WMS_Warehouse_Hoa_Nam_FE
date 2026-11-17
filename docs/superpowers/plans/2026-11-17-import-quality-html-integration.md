# Import quality HTML integration

**Goal:** Apply the three approved import-quality prototypes to the live report detail drawer without changing the HTML files or losing existing data/actions.
**Architecture:** One data-driven React drawer, Overview / Processing result / History tabs; shared UiSelect for version selection. Preserve React Query, downloads, recheck safeguards, persisted row counts and issue pagination. Use semantic tokens and the current 820px drawer.
**Spec:** User-approved `../inbound-detail-prototypes/import-quality-{duplicate,valid,invalid}.html` and accompanying field review. No compact redesign, no mock data in production.

## Constraints / review focus
- Preserve all file/result facts, actual versus projected writes, counts and source/error expiry explanations.
- Recheck uses the selected report and server-returned result, keeps history and prevents concurrent actions.
- Handle absent legacy options and unavailable original/error files without inventing values.
- Multiple errors on one row must remain visible; preserve pagination and localization.
- Three tabs, branded select, same-origin SKU link in a new tab, keyboard and mobile support.

## Tasks
- [x] Add failing integration assertions for tabs, source link and full result facts; preserve and adapt existing behavioral tests.
- [x] Integrate tabbed layout and version selection into ImportQualityBatchDrawer, localize new labels in VI/EN/ZH, retain existing APIs.
- [x] Add issue disclosure and severity while retaining loading/error/empty/pagination.
- [x] Apply scoped token-based CSS matching approved cards and timeline at 820px.
- [x] Run focused Vitest suites, typecheck, ESLint/format/select-menu checks; verify desktop/mobile and light/dark with Playwright, review final diff.

## Execution notes
Working in the current clean tracked FE workspace; pre-existing untracked outputs/ is out of scope. No push or deployment requested. HTML prototype files remain untouched.


## Verification / final review
- Vitest: 8 files, 28/28 tests passed with one worker (the first concurrent run hit 20s timeouts on this machine; sequential rerun passed).
- Playwright: 6/6 cases passed; light/dark across 1440/1024/768/390/320px, real component with mocked API, selected-result download/recheck, and valid/duplicate/invalid state coverage. Two light/dark tests repeated after active-tab contrast correction: 2/2 passed.
- Typecheck and targeted ESLint verified; select-menu guard passed; formatted changed code and git diff --check clean.
- Fresh review found busy Overview version navigation; regression first failed, then passed after busy guard. Action errors now remain visible across tabs.
- Preserved original fields and all server API actions, issue loading/errors/empty/pagination, file availability/expiry, unknown legacy values and actual/projected writes. Added visible severity and checksum copy.
- Source link is root-relative /master-data/skus, target=_blank with noopener noreferrer. No prototype sample data or simulated downloads/rechecks in runtime.
- HTML prototypes untouched. No backend change, push or deployment performed.
