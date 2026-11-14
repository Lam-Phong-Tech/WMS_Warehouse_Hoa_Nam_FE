# Chi tiết file nhập và lịch sử kết quả

User approved the complete field proposal and confirmed result versions mean successive checks of the same file.

Use one retained source file per uploader + SHA-256. Store each actual check/import as an immutable report with an atomically allocated version; an idempotent COMMIT replay still returns the original report. A recheck uses the retained bytes and original update-existing option, always DRY_RUN, and never writes SKU data. Keep actor scope on history, downloads, exports and rechecks. Different bytes create a different source even when filenames match.

Show source name, upload actor/account/time, byte size, sheet, template version, import/result IDs, checker, result version/time/completion/duration, mode/status/update option, data rows (excluding headers/blank rows), valid/duplicate/error rows, actual inserted/updated/not-written rows and dry-run projections. Separate original, result workbook and error downloads; show availability, expiry and unavailable reasons. History selection updates every result-dependent field, issue query and download target.

Use existing UiDrawer, UiButton, UiSelect, alert, tokens, account timezone and VI/EN/ZH translations. Import labels are data-validity labels, not reconciliation labels. The saved result is a snapshot at its check time; no recomputation on read. Legacy reports retain counters and can be grouped by uploader/checksum, but unavailable original bytes/size/timing must not be invented.

Approaches: frontend-only would display incomplete information and cannot implement history/downloads; overwriting a report would destroy traceability. Chosen: retain source separately and append versioned reports, extending the existing import writer and authorization scope. No new dependencies, no deployment, no changes to business import atomicity.
