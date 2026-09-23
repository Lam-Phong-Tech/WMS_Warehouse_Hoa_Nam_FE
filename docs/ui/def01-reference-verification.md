# DEF-01 gallery verification — 2026-09-23

Implemented in the existing `dev` checkout at `C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE`. No branch or commit was created. This report supersedes the earlier SKU-only reference report for the DEF content area.

## Reference and boundaries

Source: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914, group **Danh mục Bệnh Lỗi**. The manifest supplies 55 image records: desktop and tablet P01–P20, P11A–P11F and P13A/P13B, with the tablet P11F image unavailable in the source. Original assets and manifest were inspected under ignored `test-results/defect-reference`.

The DEF content follows the supplied composition: header and warehouse context, global catalog summary, status distribution, filters, table, combined code/name column on tablets, pagination, stacked forms and state notices. Typography, control dimensions and palette reuse the operations dashboard tokens as requested. No date field exists in this screen, so no date picker was added.

The application shell, authentication, permissions, routes, services and API hooks remain unchanged. The existing editable code field, immediate filtering, server pagination, validation, payload trimming, nullable description, version and deactivation confirmation remain intact. The gallery depicts a locked edit code, but changing that would change existing behavior.

A concurrent task is standardizing row actions across the application to the SKU pattern. Its shared `RowActionButton` icon presentation was preserved. Therefore row actions and the existing shell are not claimed to be pixel-identical to the gallery. Pixel equivalence and unseen animation timing cannot be certified from static references.

## State coverage

| Reference | Implemented behavior |
| --- | --- |
| P01 | Live API list and independent metadata totals for all/active/inactive records |
| P02 | Initial skeleton, disabled initial actions |
| P03 | Refresh indicator with retained rows |
| P04/P05 | True empty and no-results views; clear search/reset actions |
| P06/P07/P08 | Load failure, offline and stale-data recovery; stale mutations disabled |
| P09/P10 | Applied filter summary and permission-based view-only presentation |
| P11/P11A/P11F | Existing forms open synchronously from local defaults/list records; no fabricated opening delay or failure was introduced |
| P11B/P11C | Create/edit forms, focus, required labels, dropdown, prefilled data |
| P11D/P11E | Unsaved-change confirmation and pending-save locks |
| P12 | Success notice and highlighted saved row when it is in the current results |
| P13/P13A/P13B | Required/server errors, duplicate code and optimistic-conflict recovery |
| P14/P15 | Known failed-save retry through the validated form; uncertain saves use a fresh read without resubmitting |
| P16–P20 | Auth/permission/not-found/server/unavailable feedback while preserving the existing shared session and route behavior |

Recovery responses are bound to the form session. A slow response cannot reopen a discarded editor or overwrite another draft. Result verification clears its pending state even when filters change while the read is running. Missing/failed conflict reloads retain the draft and explain recovery.

## Browser verification

Tested on the local authenticated application with live reads. No record was created, updated or deactivated during browser checks.

- Widths: 320, 390, 768, 1024, 1280, 1440 and 1920px. Document width did not exceed viewport width. Narrow tables scroll inside their own region.
- Visually inspected desktop, tablet portrait and phone layouts, create/edit forms, status dropdown and no-result view.
- At 320×568, the form was 296px wide with 12px side margins. Its content scrolls independently; Save and Cancel remain visible.
- Measured static field labels: 13px; input text: 14px; desktop page title: 24px. Fixed the MUI shrink-label rule that previously enlarged static labels to 17.33px.
- Exercised search/no results/reset, active/inactive filtering, page two numbering (16–18 of 18), prefilled edit, required errors with first-invalid focus, dirty-close continuation/discard and status menu.
- Global summary remained 18 / 15 active / 3 inactive while filtered results contained 3 inactive rows.
- Final browser error-log query returned no errors.

## Automated checks

- Six suites passed: **83 tests** (`DefectMasterScreen` 31, `MvpMasterScreens` 3, flow01 contract 9, overview 19, feedback 17, mutation notice 4).
- `npm run build` passed, including TypeScript and production bundle generation.
- Scoped ESLint: 0 errors, 3 existing state-in-effect warnings in the shared screen file.
- DEF components and CSS formatted; DEF function formatted without reformatting the other screens in the shared file.
- Scoped `git diff --check` passed.
- Whole-project style/token guards still report findings in other screens. Neither guard reports a DEF finding. The architecture guard also reports the concurrent shared RowActionGroup direct MUI import. These wider guards are not claimed as passing and their unrelated files were not changed by this task.

The final P08 correction was verified with all 50 overview and DEF interaction tests passing; the other 33 tests passed in the preceding combined run. Explicit stale state retains valid cached summary metadata; missing or malformed metadata remains unavailable. The success-row marker and notice alignment are presentational only. Logs are in ignored `test-results/defect-reference/final-build.log` and `final-tests.log`.
