# Attachments during receipt creation

Goal/spec: implement the user-approved select locally → create receipt → upload files → scan flow. Closing before create has no remote side effects. Keep the created receipt ID after upload errors, retry only unsuccessful files, lock duplicate submissions and header edits after creation. Existing edit attachments remain unchanged.

- [x] Add failing integration tests: local selection/cancel, deferred create/upload, partial failure and retry, invalid files and create failure.
- [x] Extend InboundDraftModal with a local validated queue, per-file status, synchronous submission guard and retained receipt identity; add localized UI copy.
- [x] Verify focused tests, typecheck/lint, review and push to dev.

Use existing FILE_RULES.documentAttachment and uploadDocumentAttachment API; no backend change or temporary server upload required.

Verification: 33 focused modal/list/attachment-panel/history-hook tests passed, plus the parent Back integration test (34 total). TypeScript and ESLint passed. Browser fixture exercised local selection (zero write requests), create/upload failure/retry (one receipt create, two upload attempts on the same ID), and desktop/mobile layouts at 1440x1000 and 390x844. Screenshots are in ignored test-results/inbound-create-*.png.

Review: found and fixed browser/Android Back bypassing child busy state. The history hook now accepts an optional dismissal guard and restores its marker when blocked. Existing consumers keep the default behavior. Reviewer reported no remaining material findings.

Files remain only in component memory before submit; closing before submit uploads nothing. After an upload failure the modal preserves the created ID and successful-file statuses, locks header edits, and allows retry or removal of failed files. Closing after failure discards pending local files but retains the already-created receipt, as explained in the visible alert. No backend/API changes.
