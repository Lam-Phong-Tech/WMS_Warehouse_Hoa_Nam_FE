# Packing label report completion — 2026-11-05

User request: complete RPT-05 using the supplied Desktop/Tablet references, canonical DESIGN_FOUNDATIONS and SKU filter/table rules; create backend data; push and integrate dev.

Approach: extend the current React report and stable Laravel APIs. Preserve aggregate label-log export contract (20 columns); clearly disclose export scope rather than misrepresent event rows. Add labels/attempts tabs, immediate filters (keyword/date/printer/result/actor/action), correct unique-label metrics, accessible right detail drawer, immutable preview, safe print confirmation and unresolved-result blocking. No new dependencies. Seed additive, repeatable current-month scenarios in BE separately without resetting data.

Constraints: semantic theme tokens, 48px filter controls directly above a border-wrapped table, #d2edf7/16px/800 uppercase header, 14px data, full column widths totaling 100%, contained horizontal scrolling, mobile drawer. Keep mutations permission checked, If-Match/idempotency, explicit reprint reason. Pending attempts prevent duplicate submissions; fresh snapshot decides print vs reprint, never historical row result.

Verification: behavior tests for tab cardinality, no-event labels, filters, export parity, pending/failed historical attempt safety, missing payload, error/empty states; typecheck/build/lint and responsive runtime inspection. Existing unrelated edits stay in original checkout.
