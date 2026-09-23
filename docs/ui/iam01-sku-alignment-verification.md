# IAM-01 alignment with Danh sách SKU

Date: 2026-09-23
Repository: C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE
Branch: dev (no new branch)

## Scope

Use the existing SKU screen as the visual baseline: navy text, pale blue canvas, teal primary actions, 24px page title, 14px controls, 13px table text, 38px controls, 10px cards. The new IAM stylesheet is scoped to the page, its dialogs, dropdown portals and calendar. The 28 hex literals registered in the UI baseline are the existing SKU light/dark palette and hover colors, not a global token change.

Preserve server queries, filters, sorting, pagination, mutations, permission checks, self-edit restrictions, validation, date bounds, optimistic locking and role assignments. Date fields retain YYYY-MM-DD values; the display uses DD/MM/YYYY and the existing shared calendar adapter. Shared component changes are optional presentation props with existing defaults preserved.

## Verification

- 28/28 tests passed: IamUserScreen (3), IamDateField (5), UiSelect (11), flow01-system-catalog-contract (9).
- Targeted ESLint: zero errors; existing hook dependency warnings remain.
- Targeted Prettier and git diff whitespace checks passed.
- UI architecture guard passed.
- Vite production bundling passed.
- Browser preview used actual iframe layout widths: 320, 390, 768, 1024, 1440, 1920 pixels. Document scroll width matched the viewport at every inspected size. Tables use local horizontal scrolling when necessary.
- Verified phone actions wrap without overflowing, filters become one/two columns, and role/permission cards have no horizontal overflow at 390px.
- At 320x740, the calendar panel is x42..276 and y375..735.5, inside the viewport. Dialog client/scroll widths both equal 294px.
- Inspected create, edit, detail and department dialogs; selected a date without saving; checked role tab, loading and empty-search states. Reset search after inspection. No backend create/update/grant/revoke operation was submitted during browser QA.
- Final tablet preview had no browser console errors.

## Existing project-wide blockers outside IAM

Full TypeScript build remains blocked by five errors in src/modules/reports/packing-label/PackingLabelPrintReport.tsx: missing LabelSnapshotRecord.version at lines 194/201/234/241, and boolean | pdf | xlsx assigned to a boolean prop at line 300. No IAM TypeScript error was reported.

UI styles guard reports 12 existing violations in the shell, shared source CSS and report styles/import manifests. UI tokens guard reports 14 existing violations in auth/report/shared source files. Neither reports an IAM violation. These unrelated files were left intact.
