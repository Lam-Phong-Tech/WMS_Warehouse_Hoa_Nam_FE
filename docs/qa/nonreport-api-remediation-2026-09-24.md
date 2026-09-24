# Non-report API remediation — 24/09/2026

## Status: source changes applied; full acceptance NOT achieved

Repository: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`. Branch: `dev` only. No new branch, no force push, no backend edits, and no live warehouse transactions or seeded warehouse records were used.

Start SHA: `858d37513d79bc3cc91b2139d27bd943c32ea6c5`.
Latest application-source SHA: `31e5bbd9f13f38fda03268d32c880fe3dcc9b161`.
Comparing these SHAs gives 13 changed/added source and test files. No file under `src/modules/reports/**` changed. The temporary unused patch script was removed; no source-mutating workflow was added.

## Applied changes

### Shared response evidence

`src/shared/api/api-read-values.ts` now distinguishes absent booleans and malformed/missing lists from actual false/empty responses. Optional states remain absent rather than receiving an operational default. Write versions must be finite positive safe integers; they are never synthesized as 0 or 1.

### Warranty

`warrantyService.ts` preserves documented legacy status aliases and existing permission-aware PII masking. Missing/unknown case status no longer becomes RECEIVED. Identification must come from the API. Priority and read version stay absent when not provided. Updates obtain and validate a real version before sending the existing idempotent status operation. A NOTE event without a transition does not invent a new target case status. Attachment type/media/status/size require actual response values.

The current backend case payload was inspected and does not publish priority, so priority is optional instead of MEDIUM. Types and positive test responses were updated accordingly. Existing public service operations and test scenarios were retained. New negative tests cover missing states, identity evidence, version, list shape and no-transition events.

Limitation: handling a malformed successful warranty write response as an unknown outcome still requires consumer-level validation. Do not infer that every write outcome path has been closed.

### Master data and SKU identity

`read-all-pages.ts` aggregates only complete API pages, validates pagination and IDs, rejects duplicate rows/changing totals or advertised snapshots, and propagates errors instead of returning a truncated list. Catalogue choices remain ACTIVE; the service now reads all their pages instead of only the first 200 entries.

`hasMvpSkuStock()` no longer converts an API failure into false. It validates stock quantities and additionally checks actual movement existence when current stock is zero. SKU identity updates read current server identity and block identity changes when stock/movement evidence exists or the required verification fails. Supplied versions are checked before writes.

Limitations: UI-level error/unknown feedback and lookup of linked inactive catalogue records have not been completed. The current form can still appear editable before a stock lookup finishes, although the updated write service checks identity changes before submission. Agency/defect legacy optional-version header behavior remains unchanged when no version is supplied.

### SKU import

Import counters and transaction flags must be explicitly supplied and valid. A successful operation must match the actual file checksum, requested options, dry-run/commit mode and committed/partial-write evidence before it is returned as success. Documented rejection, concurrency and confirmed rollback errors remain separate from unknown write outcomes.

Unknown-result protection tracks operation evidence by actor/file/options, not business records. It prevents resubmission of the same unresolved commit and persists its unknown state in session storage when available. A known report ID can be cleared after reading the exact terminal COMMIT report. Unknown results without a report ID do not yet have a complete in-UI recovery flow. Reload during an in-flight request and concurrent tabs need further end-to-end validation. These are not certified solved.

`SkuImportModal` production UI was not modified in this batch. Service validation protects the success path, but dedicated unknown-result banner/button/recovery behavior is still outstanding. Existing modal test scenarios were retained and their positive response builders now contain actual contract fields rather than relying on runtime defaults.

### Test repairs

The simple login-form test now targets the current accessible username field. Session-confirmation test rendering includes its required QueryClient provider. Existing test cases were retained, and additional evidence/pagination rejection tests were added.

MFA and transport-test selector changes and the DashboardSnapshot menu-item role correction were prepared but their write was blocked by the editing tool. They are NOT present in the committed source. The two DashboardPage snapshot tests still need diagnosis, including URL synchronization and waiting for actual non-null rendered data.

## Verification evidence and its limits

Earlier baseline at `858d375`: typecheck/build passed; 903 non-report tests, 891 passed, 12 failed. This is historical evidence, NOT evidence for the new source.

The last successfully executed intermediate verification was for `8274e70f9ad09a96a226841532ff37ce77f2f959`:
- Run `35967797779`, job `107530304293`.
- Typecheck failed: six errors from TypeScript parameter properties under erasableSyntaxOnly, and one optional warranty event status used as an index.
- Tests: 903 total, 865 passed, 38 failed. Three original login/session tests passed; remaining failures included old tests and positive test payloads missing newly required API fields.

`f30a15171f54add18342adb05c53f1b9145639ef` replaces parameter-property constructors and fixes the no-transition type. `31e5bbd9f13f38fda03268d32c880fe3dcc9b161` updates positive response contracts and replaces fabricated-default assertions with explicit rejection assertions, while adding regression coverage. These corrections have NOT been certified by a completed rerun.

The latest attempted verification for `31e5bbd9f13f38fda03268d32c880fe3dcc9b161` was run `35969766182`, job `107536485113`. GitHub returned failure with an empty step list, runner_id=0 and no downloadable log. No typecheck, test or build step executed. The reason was not established; do not claim a billing, quota or code cause without evidence.

Some further editing calls were blocked by the tool. No successful commit is claimed for those attempted changes. There is no full green test run or successful production-build proof for the final application-source SHA.

## Acceptance work still required

1. Run typecheck, formatting/lint, non-report regression tests and build on the final exact SHA. Fix any remaining regressions; do not skip tests or suppress exit codes.
2. Complete the remaining inbound/outbound numeric, list, completeness-flag and document-code mappings. Those production service files were NOT modified in this batch. The previously identified defaults still need endpoint-by-endpoint resolution.
3. Finish inactive-reference lookup and UI feedback for failed/unknown catalogue and stock checks; complete SKU-import unknown-outcome recovery and warranty write-result handling.
4. Correct and execute the remaining MFA/transport and dashboard test scenarios. DashboardSnapshot still contains a warehouse-active label without an explicit status prop; this needs real status evidence or removal of that claim.
5. Continue the full route/modal/query/field matrix, including active legacy consumers, stale response ordering, scope changes, pagination and cache invalidation after writes.
6. Authenticate against the intended real API and verify every in-scope route/modal plus the inbound → inventory → outbound/warranty → reversal flow. No authenticated browser/end-to-end or deployment verification was completed in this batch.

Do not label this delivery 100%, production-ready, or fully tested. Isolated test response builders remain in test files; they are not imported as runtime fallback business records.
