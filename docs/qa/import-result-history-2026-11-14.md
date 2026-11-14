# Import file details and result history — 2026-11-14

Approved scope: `docs/superpowers/specs/2026-11-14-import-result-history-design.md`.

Implemented source metadata, upload actor/account/time, exact byte size, sheet, template version, checksum, result/check actor and account, import ID/copy, result mode/status/options and start/completion/duration. Data-row totals exclude headers and blank rows. Valid, duplicate and invalid counts count distinct rows; actual write counts remain separate from dry-run projections. Each completed recheck creates a saved DRY_RUN version from retained original bytes, with the selected version's update-existing option. COMMIT replay remains idempotent.

Drawer actions download original bytes, the selected result XLSX, or that version's error CSV. Source availability and error expiry come from the server. History selection updates metadata, counters, issue query and file targets together. Cancelling a pending history read prevents stale data overwriting a newly created result. All routes retain sku.manage and existing report actor scope.

## Legacy behavior

Migration groups historical SKU reports by uploader and SHA-256 and assigns chronological versions. Unknown upload time, original size and processing time remain null. Known options are recovered from stored fingerprints. Original bytes cannot be reconstructed from reports: the original/recheck actions explain their unavailable state until identical bytes are uploaded again. A restored source invalidates cached report availability.

## Verification

Recorded results: backend import regression **63 tests / 381 assertions passed**; broad frontend report/import-service regression **65 tests passed**, followed by the final report/i18n suite **29 tests passed**, final issue/history/error-localization suite **28 tests passed**, and final import-copy/catalog checks **10 tests passed**. These runs overlap and are not additive. Chromium **3 tests passed**. TypeScript + production build passed; the build retains the existing large ApexCharts chunk warning. Scoped ESLint, Prettier, PHP Pint and diff whitespace checks passed.

- Backend focused import tests cover metadata, same-content grouping, changed-byte separation, immutable rechecks, COMMIT replay, scoped access, exact original download, per-version workbook, legacy up/down migration and source restoration, distinct-row counts and server expiry reasons.
- Frontend tests cover metadata and actual/planned counts, history selection, selected download targets, successful/failed rechecks, out-of-order history responses, unavailable legacy files, expiry with a skewed client clock and VI/EN/ZH catalog coverage. Existing import upload/service and report regressions also run.
- Chromium checks drawer at 1440, 1024, 768, 390 and 320 pixels in light/dark themes: horizontal overflow, full card text containment, fixed close button, issue selection/pagination and focus restoration. A separate browser test checks downloading version 1 and appending/reselecting version 3.
- Screenshots: `test-results/import-quality-drawer/{light,dark}-{1440,390}.png` and `{light,dark}-320-result.png`.
- Independent read-only code review completed; its three findings (legacy timing, recoverable options, stale history race) were reproduced and corrected.

## Applying the backend migration

The local `.env` targets PostgreSQL at 127.0.0.1:5432. A migration preview failed because that server refused the connection; no development migration was applied. Once that database is available, run from the backend checkout:

```powershell
php artisan migrate --path=Modules/Warehouse/database/migrations/2026_11_14_000100_add_import_result_history.php
```

Retained sources default to the private `local` disk. Multi-node deployments can configure `IMPORT_SOURCE_FILE_DISK` to an existing shared disk; the lifecycle streams retained files into local processing. Existing error-file expiry configuration is unchanged. No new automatic original-file expiry policy was introduced.

No production deployment or live authenticated application check was performed. Browser checks use the existing dedicated fixture and mocked transport; HTTP backend checks use a disposable SQLite database. PostgreSQL migration/runtime behavior remains unverified while the local server is unavailable.
