# Contextual SKU links in import report results — 2026-11-18

## Behavior

- Overview keeps the import source text and removes the generic catalog shortcut.
- A committed result offers **Xem SKU đã tạo/cập nhật từ lần nhập này** in Results. The expandable list belongs to the selected result version, is paginated, and resets on version changes.
- Each link opens the current SKU detail in a new tab using its immutable ID. Historical SKU codes remain snapshots. Deleted IDs display an unavailable label and are never resolved by a reused code.
- An existing catalog conflict (`DUPLICATE_CODE`, `sku_code`) offers **Xem SKU đang tồn tại** only when the server resolves an exact current SKU. File-only duplicates and unrelated errors have no link.
- Direct SKU detail loading works independently of the catalog page. Closing removes only `sku_id` from the URL. A stale publish conflict reloads the linked detail by ID without retrying the write.
- Dry runs/rejections never show a written-SKU action. Legacy committed results disclose that linkage was not recorded; no source-file reconstruction is attempted.
- Vietnamese, English and Chinese copy is included.

## Backend contract / rollout

- Migration: `Modules/Warehouse/database/migrations/2026_11_18_000100_add_written_skus_to_import_reports.php` adds nullable `import_reports.written_skus`.
- New successful imports persist `{sku_id, sku_code, action: CREATED|UPDATED}` in the same transaction as SKU writes, audit and report creation. Public import responses and report/history payloads do not expose the full snapshot array.
- `GET /api/v1/skus/import-reports/{id}/written-skus?page=1&per_page=20` returns stored entries with `available`, pagination and `meta.linkage_status` (`AVAILABLE`, `NO_WRITES`, `NOT_RECORDED`). Uses `sku.manage` and the report's existing actor scope.
- The existing `/rows` endpoint adds nullable `existing_sku_id` for exact catalog conflicts.
- Deploy backend and its migration before frontend. No deployment or migration against the user's running database was performed in this task.

## Verification

- Backend: **24 passed, 220 assertions** across ImportResultHistoryTest, UiuxV2SkuImportQualityTest and Wwhn224SkuImportDryRunTest. Includes creates/updates, preserved IDs after code changes, legacy/no-write distinction, pagination, absent IDs, exact duplicate lookup and actor/permission guards.
- Final frontend report/deep-link regression: **54 passed, 1 skipped** across 9 files. The skipped test is the independently confirmed existing Defect filter-toggle failure described below. The off-page publish-conflict regression was observed failing against the previous behavior with an actual Axios-shaped 412 response, then passing after the fix.
- Browser: **4 passed** for original drawer interactions and contextual links in light/dark modes. Existing drawer tested at 1440/1024/768/390/320px; new expanded written list at 1440/390/320px. New scenarios assert no horizontal overflow and the correct ID-based links. Screenshots inspected visually at 390px light and 320px dark.
- Final `npm run build` (TypeScript + Vite + build manifest), targeted ESLint, PHP Pint and diff whitespace checks passed. Vite emits the existing large shared-chunk warning; build exits successfully.
- Browser evidence: `test-results/import-quality-drawer/contextual-{light,dark}-{1440,390,320}.png` and `contextual-duplicate-{light,dark}-320.png`.

## Existing test failure outside this change

`MvpMasterScreens.test.tsx`: **thu gọn riêng thống kê và bộ lọc bệnh/lỗi, giữ từ khóa khi mở lại** expects a **Bộ lọc tìm kiếm** button that the unchanged Defect screen does not render. The exact test from HEAD was copied temporarily and run in isolation; it failed at the same lookup. The temporary copy was then removed. The feature's related suite excludes only this known failing test; the Defect screen and its test were not altered to hide it.

Logs: `outputs/contextual-skus-baseline-defect.log`, `outputs/contextual-skus-regression.log`, `outputs/contextual-skus-conflict-valid-red.log`, `outputs/contextual-skus-final-tests.log`, `outputs/contextual-skus-build-final.log`, `outputs/contextual-skus-browser.log`. Backend log: `build/contextual-import-skus-tests.log`.
