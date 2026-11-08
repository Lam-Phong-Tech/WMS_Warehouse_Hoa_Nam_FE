# Report workbook formatting

User request: all exported reports should have attractive colored tables/columns; style the supplied warranty workbook as a concrete example.

Use a shared ExcelJS document writer after the existing SheetJS data-selection stage. Palette: navy 004E74, text 12344B, muted 627C8E, line D9E8EF, alternate row EAF5F8, white FFFFFF. Calibri 11, title 18 bold, white-on-navy headers. Add a title and compact metadata, freeze the identifying column and header, filters, readable widths, wrapped long data, native date/number formatting and semantic status fills. Preserve identifiers, masks, raw enum values and selection. UTC timestamps display as Vietnam local time; date-only values keep their date. Existing formula layouts must not be shifted.

- [x] Write failing style/roundtrip/date/data-integrity tests.
- [x] Add an isolated browser-compatible styled writer and route all application XLSX report writers through it, including server fallback exports.
- [x] Update both dependency locks without changing the original checkout dependencies.
- [x] Verify saved XLSX styles and values, lint and affected report tests; obtain code review.
- [x] Deliver one styled copy of the sample, authored and visually checked with the spreadsheet runtime.

Validation: 44 tests passed across the style writer, selection/workbook export, async job fallback, stock reconciliation, goods trace and audit logs. Targeted ESLint and git diff checks passed. A real Chromium download was reimported/rendered with the spreadsheet runtime: 5 rows × 14 columns, 58 unchanged text/blank cells, 12 reconciled dates, UTC+7 timestamps, readable headers/status fills, frozen B5 and A4:N9 filter. The standalone sample copy was also authored and visually checked through the spreadsheet runtime.

Review caught and fixed missing “Thời điểm” detection and source-format lookup after blank rows; actual sample QA caught PostgreSQL hour-only offsets. Each issue has a regression test. Both lockfiles add ExcelJS dependencies without unrelated upgrades; library code loads on export.

Final `npm run build` passed (TypeScript + production bundle), and targeted ESLint / 44 affected tests passed. Integrate latest origin/dev with a normal merge, verify the combined report paths, then use a non-force HEAD:dev push under the user's explicit authorization. Final integration status is recorded in repository history and the delivery message.

Scope limits: no backend changes; browser downloads are styled after existing server permission/audit/job checks. Visual workbook QA covers the supplied warranty fixture; not every live report page was visually exercised. The full repository test suite was not rerun.
