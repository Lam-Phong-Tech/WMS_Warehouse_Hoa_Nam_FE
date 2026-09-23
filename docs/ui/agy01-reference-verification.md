# AGY-01 reference verification — 2026-09-22

## Workspace and scope

- Repository: `C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE`; branch: `dev`.
- Route: `/master-data/agencies?screen=AGY-01` and the existing create-modal route.
- Presentation changes only: agency-scoped CSS, existing list/form markup, route-scoped responsive sidebar sizing and expand/collapse state.
- Shared files were patched only at agency-specific anchors; changes from parallel SKU, PV and reports tasks were preserved.
- The agency function's pre-render logic remains identical to HEAD after whitespace normalization. API queries, mutations, permissions, validation, sort, pagination and filter handlers remain unchanged.

## Reference coverage and limitation

Gallery: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914

The gallery supplies two images for this screen: DEFAULT desktop 1920×1080 and DEFAULT tablet 1600×2560. No agency modal, error or alternate-state reference was found there. Cached originals are under `.agent-cache/agency-ui/`.

The current implementation is NOT a 100% match. The reference's global overview counts, region filter and Apply/Reset behavior are absent from the current implementation and would require extra read queries or changed filtering behavior. An automatic approval review rejected adding those behaviors under the user's UI-only constraint. The user has been asked to authorize that precise addition; no answer has been received. No dummy counts, inactive controls or invented state screens were added.

## Completed presentation work

- Source-inspired navy/blue palette, type scale, card borders, input/menu/status styling, list header and existing Add action placement.
- Desktop table; composite tablet rows; mobile rows retaining all values and sorting actions.
- Existing dialogs and portal menus use the same palette; existing field validation and save/cancel logic are preserved.
- Sidebar uses 276px desktop and 86px collapsed tablet rail on AGY only. Tablet expansion override prevents auto-collapse from locking the expand button.
- No date field exists on this screen.

## Browser checks

Real data was used; no agency was created, updated or deleted during checking.

| Viewport | Document width | Table client / scroll width | Controls outside viewport |
|---|---:|---:|---:|
| 1920×1080 | 1920 | 1516 / 1516 | 0 |
| 1440×1000 | 1440 | 1036 / 1036 | 0 |
| 1024×1366 | 1024 | 810 / 810 | 0 |
| 768×1024 | 768 | 572 / 572 | 0 |
| 390×844 | 390 | 284 / 284 | 0 |
| 360×800 | 360 | 254 / 254 | 0 |

- Add dialog at 360px: width328px, left16px, right344px; no input/button overflow. Content scroll and footer actions visible.
- Open/cancel Add and Edit; Edit loads the selected record.
- Empty submit shows three required-field errors without sending a mutation.
- Search loading and empty results; cleared search restores the list.
- Inactive status filter returns five records; reset restores all26 records.
- Tablet sidebar verified collapsed86px and pinned open276px; no page overflow. Original expanded desktop preference restored and temporary viewport override reset.

## Automated verification

- Existing master-data / agency labels / system-catalog contract tests: 21 passed across3 files.
- Existing UiAppShell tests after sidebar adjustment: 5 passed.
- ESLint on `MainLayout.tsx` and `ApiMasterScreens.tsx`: 0 errors;4 existing set-state-in-effect warnings.
- TypeScript verification reported5 errors in `src/modules/reports/packing-label/PackingLabelPrintReport.tsx`, outside this change (missing LabelSnapshotRecord.version and incompatible print/export flag type). No agency errors were reported.
- Global style/token guards have existing unrelated violations; the agency stylesheet has no `!important`, and its15 palette occurrences plus CSS import were added to the existing scoped allowlists without regenerating other baselines.

These checks establish the tested UI behavior and sizes, not pixel-perfect reference equivalence or successful whole-project type checking.
