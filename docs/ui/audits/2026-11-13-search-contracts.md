# Search contract review — 2026-11-13

This is a source and focused regression audit of search inputs and searchable selectors. It does not certify a live production dataset or a browser walkthrough of every screen. Existing warehouse scopes, permissions and PII restrictions remain effective.

## Original failure and correction

The reversal list displayed `reference_document_code` from the joined stock/component issue document, but its API keyword predicate searched only the reversal number and reason. A visible original document number therefore produced an empty result. The predicate now includes the same authoritative original-document expression, before pagination. It accepts trimmed, case-insensitive partial/full codes and composes with status and warehouse scope. A new cache namespace prevents reusing old empty search results.

The inventory movement list had the same missing SKU/source-document fields. The reversible movement picker also searched movement number instead of the advertised original document, and returned the movement number as `source_document_code`. Both are corrected. Picker warehouse scope now applies in SQL before pagination as well as existing middleware checks.

## System coverage

| Domain | Source inventory and findings |
| --- | --- |
| Catalogs, suppliers, recipients, IAM, audit, global navigation, dashboard, account/profile and notifications | [Catalog and system audit](2026-11-13-search-catalog-system.md). Fixed recipient keyword `0`, incomplete brand/role/department lookup catalogs, and audit actor server autocomplete. |
| Inbound/receiving, outbound/shipping, inventory, trace, putaway, physical-code history, PV administration | [Operations audit](2026-11-13-search-operations.md). Fixed missing warehouse/receipt matches, incomplete tray catalogs, scan history server filtering and PV keyword/pagination. Inventory movement fixes are verified in the root regression below. |
| All report families and report dropdown sources | [Report audit](2026-11-13-search-reports.md). Fixed request/linked-document matching, later SKU/receiver matches, authoritative warranty serial/tag identifiers, and first-page-only lookup sources. |
| Reversal list and create picker | List UI forwards the entered original document code after debounce/trim. HTTP tests cover PX/PN/CID, partial/lowercase/trim, reason/reversal number, status intersection, pagination and foreign warehouse exclusion. |
| Warranty list, case picker, intake/detail and component issue controls | Existing list API regression covers case/product/customer name/phone with permission-specific PII behavior. Case picker uses the same contract. Scan fields remain exact code resolvers. Intake/detail/list defect selectors now load every authorized defect page instead of restricting local option search to the first 100 records. |
| Errors/static screens, fixed enums and page-size controls | No independent business-record keyword contract. Searchable select controls filter visible option labels; scanner inputs resolve identities rather than fuzzy text. |

VI/EN/ZH report placeholders now describe the supported fields: import-file name for import history; document/SKU/operator/partner for RPT08; document/operator/recipient for legacy IO history. Unsupported serial/lot/pallet/request promises were removed from these specific controls.

## Focused verification

- `ReversalKeywordSearchTest.php`: 4 HTTP tests / 52 assertions, isolated SQLite memory database, covering reversal search, movement keyword search, original-document picker and warehouse/status composition.
- Root final UI group: reversal list, audit actor remote lookup and complete defect selectors — 3 files / 11 tests passed.
- Root integration group: warranty list and five report search/source suites — 6 files / 34 tests passed. Completeness/error handling checks — 2 files / 11 tests passed. Incomplete-source messages use VI/EN/ZH translations.
- `npm run typecheck` (`tsc -b --pretty false`) passed after integration.
- Per-domain focused test evidence and known legacy failures are recorded in the three linked audits. No full test suite is required or claimed.

## Explicit limits

- The physical-code catalog list is already blocked by an unapproved read contract (`WMS_FE_CONTRACT_NOT_APPROVED`). This work preserves that gate and disables its unusable search when the read fails. Batch/event history searches are repaired independently. Enabling the catalog API is a separate contract change.
- Report readers with an explicit completeness cap reject oversized/inconsistent sources or retain their existing incomplete-source indication. They do not silently claim complete global results from page one.
- API failures remain failures; a source audit does not prove production connectivity, Unicode collation, every account's data, or every viewport. Full-suite legacy warranty report UI expectations are stale and remain documented; focused current serial/search checks pass.
