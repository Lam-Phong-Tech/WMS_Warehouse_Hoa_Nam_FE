# RPT-08 reference and state verification

Scope: Lịch sử nhập – xuất kho at `/reports/pending-evidence?screen=RPT-08`. Presentation uses the existing snapshot, permissions, picker, detail flow and export contract. No mock records or production state switcher are installed.

Reference: [SystemHNWeb gallery](https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914). Local evidence: `test-results/rpt08-reference/manifest.json`, 20 desktop and 20 tablet PNGs. Every row below maps both files, accounting for all 40 references. Local inspection images may be excluded from Git.

| Reference files                  | Observed state         | Real trigger and limits                                                                                                                                                                                          |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| desktop-P01.png · tablet-P01.png | Default                | A successful snapshot renders filters, derived totals/charts and paginated history. Real values and account scope replace illustrative numbers.                                                                  |
| desktop-P02.png · tablet-P02.png | Initial loading        | Initial snapshot loading shows named busy skeletons and disables export.                                                                                                                                         |
| desktop-P03.png · tablet-P03.png | Refreshing             | Actual refetch retains data and shows updating feedback; apply/reset follow request state.                                                                                                                       |
| desktop-P04.png · tablet-P04.png | Empty                  | A successfully loaded range without records shows zero/empty summaries and date-adjustment recovery.                                                                                                             |
| desktop-P05.png · tablet-P05.png | No result              | Search or section filters without matching rows show no-results feedback and reset.                                                                                                                              |
| desktop-P06.png · tablet-P06.png | Load error             | Failed loading without usable rows offers retry and return to overview; export is disabled.                                                                                                                      |
| desktop-P07.png · tablet-P07.png | Offline                | Browser connectivity supplies this condition when no usable snapshot exists. Usable records remain available with stale feedback.                                                                                |
| desktop-P08.png · tablet-P08.png | Partial/stale          | A source failure with usable rows keeps data visible and offers refresh/dismiss. Timestamp comes from the snapshot.                                                                                              |
| desktop-P09.png · tablet-P09.png | Invalid date range     | The shared picker prevents end-before-start selection and never emits reversed dates. Defensive validation remains, but this exact error is not reachable through the current picker. Its contract is preserved. |
| desktop-P10.png · tablet-P10.png | Read only              | Export permissions control the read-only badge and export actions.                                                                                                                                               |
| desktop-P11.png · tablet-P11.png | Exporting              | A real export job disables repeat submissions and shows progress until settled.                                                                                                                                  |
| desktop-P12.png · tablet-P12.png | Export success         | The existing job reaches ready and download completes before success appears.                                                                                                                                    |
| desktop-P13.png · tablet-P13.png | Export warning/partial | The feedback component supports the visual state. The current contract has no authoritative partial-result flag, so no production trigger is fabricated from unrelated row counts.                               |
| desktop-P14.png · tablet-P14.png | Export failed          | A definite failure offers retry and dismiss. Retry retains the last requested format.                                                                                                                            |
| desktop-P15.png · tablet-P15.png | Export outcome unknown | Timeout or uncertain network outcome requires acknowledgement; export stays blocked until then to reduce accidental duplicates.                                                                                  |
| desktop-P16.png · tablet-P16.png | Session expired / 401  | Existing auth/session handling owns login and its shell. Report feedback delegates sign-in via callback; it neither replaces auth flow nor simulates expiry.                                                     |
| desktop-P17.png · tablet-P17.png | Forbidden / 403        | An actual forbidden response without usable snapshot rows shows access-denied recovery.                                                                                                                          |
| desktop-P18.png · tablet-P18.png | Not found / 404        | An actual missing-report response without usable rows shows not-found recovery.                                                                                                                                  |
| desktop-P19.png · tablet-P19.png | Server error / 500     | A server failure without usable rows shows system-error recovery. Supplementary-source failures do not hide usable documents.                                                                                    |
| desktop-P20.png · tablet-P20.png | Maintenance            | The feedback component supports the visual state. No distinct maintenance signal exists in the current contract; a generic 503 is not silently relabelled as maintenance.                                        |

## Responsive decisions

Desktop retains the hierarchy and seven-column history. Tablet uses two filter columns, combined time/document and object detail cells, and paired summary/chart cards. Narrow content stacks panels and contains the wide history in its own scroll area. Report container queries respond to available content width, including narrow panels within a wide browser window. Feedback actions and long text wrap. Existing shell and operational dashboard typography remain the common sizing context.

No reference shows an open calendar, export menu, dropdown or document-detail panel. These keep existing component/data contracts with scoped colors, focus handling and bounds. Screenshots cannot establish precise hover timing, transitions or undocumented actions; these are not claimed as pixel-proven.

## Verification boundaries

`IoHistoryFeedback.test.tsx` checks callback dispatch, duplicate-action prevention while busy, uncertain-export acknowledgement, home/login delegation, empty-state recovery and accessible loading announcements. Components render directly without API/module mocks or CSS snapshots. Integration tests cover snapshot/filter/export separately. Component tests do not establish pixel equality or prove server states missing from the contract.

## Verified in the local application

- Branch: dev. Work performed in C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE.
- Browser measurements: document width equals client width at 320, 390, 768, 1024, 1440 and 1920px. Tablet report rail is 54px; desktop sidebar is 274px. The 320px date popup and warehouse popover fit the viewport.
- At 768px, the document dialog measured x20–748 inside the viewport, with no internal horizontal overflow. Escape closes it and restores focus to the originating Xem button.
- Real date preset 7 ngày qua updated the snapshot, KPI and chart. Real XLSX export completed with the success notice; the browser error log was empty at that check.
- Report page titles now share the visible Warranty report typography: clamp(22px, 1.45rem, 27px), weight750, line-height1.22, letter-spacing-0.02em and navy text. All nine report routes were measured at23.2px on1280px viewport and22px on390px viewport, without title overflow. Chart and body typography are unchanged by this follow-up.
- Focused report/advice tests20/20; feedback interactions11/11; shared date picker5/5; matching smoke fixtures4/4; export/pagination contract8/8; route access6/6.
- Vite production bundle succeeds. Full TypeScript still reports five existing errors in unchanged PackingLabelPrintReport.tsx (snapshot.version and busy boolean). Broader legacy smoke/dashboard CSS guards also have failures outside RPT-08. No style/token guard violation is reported for the three RPT-08 stylesheets.

Exact pixel equivalence is not claimed: gallery images contain illustrative values, and the existing operational data, permissions and API contracts remain authoritative.
