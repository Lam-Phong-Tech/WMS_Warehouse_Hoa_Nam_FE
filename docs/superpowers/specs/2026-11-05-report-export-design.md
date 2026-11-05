# Shared report export

User request: every report export opens a right drawer matching the supplied reference. All export triggers share primary color, download icon, size and loading states. Options depend on the report and supported data. User also authorized integration and push to dev.

Use the existing React/MUI UiDrawer, Operations tokens, Inter and current icons. Desktop width 560px; mobile full width. One scrolling body and fixed header/footer. Include applied context, supported scope/content, real summary, editable filename and supported format. Disable empty/invalid export and duplicate submission; retain errors for retry. Existing server export authorization, audit, polling, masking and limits stay in effect. Customize XLSX only after authorized server generation; PDF retains its supported full-detail scope. Stock reconciliation keeps its existing local worksheets with the shared drawer.

Approaches: independent page dialogs duplicate styling and behavior; a shared configurable drawer plus workbook selection reuses existing exports and provides one consistent UI. Use the latter. No unrelated list/filter redesign. Incomplete snapshots must not be labeled as complete.
