# Non-report API data audit — 23/09/2026

## Status: partial remediation; not a full runtime sign-off

Target: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`, branch `dev` only. No new branch. `src/modules/reports/**` is excluded from source changes. No live warehouse records were created, edited or seeded for this audit.

## Applied runtime-source changes

- `d94e5ae5753bec65241373f84e57a967c9ab9563`: 19 source files, including regression tests. Removes the Foundation UI catalogue business records, KPI values, fabricated history and related bundled sample translations. Removes dashboard URL-driven demonstration states and invented closing-stock chart points. Preserves unknown inventory quantities and identity checks; removes unrelated lot/source/date substitutions. Requires explicit catalogue, outbound, reversal and component-issue states rather than assuming ACTIVE/DRAFT/POSTED. Removes the fabricated profile role ID. Reversal eligibility no longer becomes true because a server flag was absent.
- `0f4ae2a17d836e4267cf59c1bb3b7e6fda5c504b`: 2 additional inbound files. An absent list version stays undefined; detailed operational data requires a server version. Posted quantities come from scanned quantities rather than planned quantities.

Total: 21 changed source files across these two commits. The report module files are unchanged. Translation edits only remove the developer catalogue sample content; they do not replace report labels.

## Executed validation evidence

The final candidate tree `ef6d43103225c1bf044693bee22f271429217d4c` is the exact tree committed by `0f4ae2a17d836e4267cf59c1bb3b7e6fda5c504b`.

- Typecheck: PASS.
- Production build: PASS.
- Non-report tests: 890 total, 878 passed, 12 failed.
- The same 12 failures were present in the before-change baseline (866 total, 854 passed, 12 failed). No new failing test identity remained in the final run. This does NOT make the suite green.
- Final run: https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE/actions/runs/35875488775
- Before/after baseline run: https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE/actions/runs/35873075301
- Safety subset before/after: 226 tests; the same 9 pre-existing failures remained. Run: https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE/actions/runs/35874801824

The static inventory at the baseline scanned 438 non-report runtime text files and found 110 modal/dialog/drawer declaration sites. These are source sites, NOT 110 browser scenarios that passed end-to-end execution. The inspector also records API query sites, literal values, fallback expressions and an import graph. Its output is a review inventory, not proof that every flagged fallback is wrong or that unflagged code is correct.

## Known outstanding items — must not be reported complete

1. The 12 existing test failures need diagnosis: SessionConfirmationGate (QueryClient provider); LoginPage form/MFA/transport selectors and expectations; DashboardSnapshot custom range; DashboardPage English snapshot and chart/KPI independence assertions. Tests have not been skipped or removed to manufacture a PASS result.
2. Remaining read-model fallback review includes document-attachment evidence/status/size defaults; inventory trace net-effect numeric defaults; some inbound/outbound number coercions; SKU stock preflight and import-result normalization; warranty case/event/attachment defaults; legacy shipping and scan services. Do not blindly replace request defaults, page sizes, enum labels, or idempotency keys: they are not fabricated business records. Each remaining read fallback needs the current endpoint contract and its consumers checked before changing it.
3. Full authenticated browser/API verification has not been completed: each route and nested modal, pagination/filter context, loading/error/empty/partial responses, stale cache after writes, and end-to-end inbound → inventory → outbound/warranty → reversal reconciliation.
4. A deployment of these source commits to the live website has not been verified. Successful Git writes and a build are not deployment evidence.

## Regression tooling after remediation

The one-off patch scripts and source-mutating validation workflows were removed after the source was committed. The retained verification workflow has read-only repository permission and checks the actual committed source, not a patched runner-only copy. It preserves failing test exit codes. `guard.mjs` catches runtime imports of test/sample data and obvious hard-coded business-record arrays; it is intentionally labelled a regression guard, not a complete API-mapping certification.

Test-only fixtures remain isolated from application runtime. They are not fallback data for the live UI and were not sent to the warehouse API. No claim is made that every test fixture or every legacy fallback has been deleted from the repository.
