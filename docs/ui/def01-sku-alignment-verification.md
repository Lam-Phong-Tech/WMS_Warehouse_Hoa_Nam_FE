# DEF-01 alignment with the SKU list

Verified on 2026-09-23 in the existing `dev` checkout at `C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE`.

## Reference and scope

The user selected the existing SKU list as the visual reference for DEF-01. The change matches its palette, typography, controls, cards and table presentation, while retaining the defect catalog fields and API behavior. No defect-specific gallery images were claimed as a reference.

Owned changes are the DEF-01 section and its stylesheet import in `ApiMasterScreens.tsx`, `defect-list.css`, the focused `DefectMasterScreen.test.tsx`, and the two DEF-specific stylesheet registration/count entries in the existing UI allowlists. The new stylesheet contains 27 hex occurrences, all drawn from the existing SKU stylesheet palette; the allowance is limited to that file. Concurrent changes to SKU, agency, catalog, reports, the shell and shared controls belong to other tasks and were preserved.

No service, hook, permission, route or mutation contract was changed. Filtering remains immediate; Apply refreshes the current query, and Reset clears the filters and returns to page one. Existing field validation, payload trimming, nullable description, edit version, server field-error mapping and inactive-status confirmation are retained.

## Browser checks

At desktop size, measured values match the SKU list: 24px title, 13px table text, 12px table headers, 14px button text, 38px buttons, 10px card corners, navy title/primary button, pale blue headers and borders.

Widths checked: 320, 390, 768, 1024, 1280, 1366 and 1920px. The document did not overflow horizontally. Narrow layouts keep the wide table inside its own scroll area and preserve access to row actions. At 390px, the form dialog fits within the viewport with 12px side margins.

Checked loaded rows, loading, no matching results, reset, create required-field validation, prefilled edit fields, status dropdown and inactive confirmation cancellation. Error field borders remain red; selected menu items and the confirmation action use the SKU palette. Browser verification did not save or deactivate production records. No browser console errors were present at the final check.

## Automated checks

- `DefectMasterScreen.test.tsx`: 8 tests passed.
- `MvpMasterScreens.test.tsx` and `flow01-system-catalog-contract.test.ts`: 12 tests passed.
- ESLint on the edited screen and new test: no errors; three existing state-in-effect warnings in shared screen implementations.
- Prettier: scoped CSS and test file formatted.
- `git diff --check`: passed.

The whole-project TypeScript check remains blocked by unrelated `PackingLabelPrintReport.tsx` errors (missing snapshot version properties and an export busy value typed as boolean or format string). Whole-project style/token guards also report existing findings in other screens; neither reports a DEF-01 finding. These broader checks are not claimed as passing.
