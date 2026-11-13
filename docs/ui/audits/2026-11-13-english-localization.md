# English interface localization audit — 13 November 2026

## Scope and findings

The source audit covered TypeScript/TSX UI text, validation schemas, shared error handling and notification delivery under `src`. The initial AST inventory contained 1,881 accented literals/fragments, not 1,881 defects. It included intentional bilingual lookup tables, navigation keys, backend/user data, export headers and symbols. The classified working inventory is `outputs/english-ui-audit.json`.

The English catalog lacked 51 Vietnamese keys, including the new-password required/length/whitespace messages. Those keys now have English translations. Catalog regression checks require matching key sets and interpolation variables, and reject Vietnamese copy in English entries except native language names in the language selector.

Fixed screen copy includes:

- Inbound/outbound report dropdown search placeholders, accessible names and KPI descriptions.
- Recipient/agency and warranty report KPI hints and list actions.
- Inbound report details, recorded-code lists and loading/error/empty states.
- Reconciliation report filters, empty/error states and evidence dialogs.
- Goods trace filters, source/type labels, KPI explanations, empty states, event details and export dialog copy.
- Dashboard system views, stock-threshold list/detail, BOX/tray details and master-data service errors.

Translated render-time labels subscribe to the language store. Memoized options include locale dependencies; merged business label maps are not frozen at import time. Vietnamese customer names, product names, event text and identifiers remain data.

## Errors and notifications

The screenshot's new-password validation now has an English entry. Login, password recovery, forced password change and profile password drawers refresh already displayed validation messages when the language changes, preserving entered values.

Shared API display paths translate recognized catalog messages/templates and a source-backed backend catalog containing 38 exact messages, 57 validation/business templates and 225 attribute labels. Field errors are localized for both flat and nested API envelopes, including camel-case form field extraction. UUIDs, machine flags and numeric metadata are not displayed as prose; raw error metadata remains available for diagnostics.

Known notification events use locale-aware templates for list, detail and toast delivery. Custom content and unknown event types retain their source text. Previously delivered toast text stays in the language used at delivery.

## Verification and limits

Regression tests cover the screenshot placeholders/KPI hints, language changes without remounting, preservation of business data, password client/server errors, API alerts, trace empty states, and catalog completeness. **133 tests across 17 files passed**, along with `tsc -b`, targeted ESLint and `git diff --check`.

The committed [verification manifest](./evidence/2026-11-13-localization-verification.json) records the focused regression counts. Raw evidence retained locally under `outputs/`:

- `english-report-retry.json`: 26/26 tests (reports, trace and BOX details).
- `english-errors-retry.json`: 53/53 tests (auth screens and shared API errors).
- `english-catalog-final.json`: 15/15 tests (catalog completeness and Vietnamese password rules).
- `english-detail-final.json`: 26/26 tests (inbound details, recipient report and English password rules).
- `dashboard-audit-result.log`: 13/13 dashboard tests.

This is a source audit plus automated component verification, not evidence that every screen/state has been exercised in the live browser. Spreadsheet export headers were not included in the screen-copy migration. Arbitrary unseen backend prose cannot be translated reliably by a finite client catalog: unknown messages are preserved rather than replaced with a misleading generic error. Completing that coverage requires an English message contract from the backend or additional verified message templates.
