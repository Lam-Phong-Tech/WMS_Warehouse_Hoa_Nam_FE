# Approved inbound HTML integration

Goal: apply the user-approved HTML to the existing inbound receipt drawer for mutable, posted and cancelled receipts.
Reference: ../inbound-detail-prototypes/{index.html,app.js,styles.css,scan.html,scan.js,scan.css,notes.js,cancelled.html}; conversation decisions are the approved specification.

Constraints: keep API writes, permissions, concurrency/idempotency, scanner/camera/carton/new-SKU flows, attachments and pagination. Use existing UI components and semantic theme tokens. Never manufacture operation actors or timestamps. Keep changes in the user's requested checkout; unrelated outputs/evidence stay untouched.

- [x] Add meaningful failing tests for receipt tabs, separate type column, long notes, cancellation and real operation history.
- [x] Add receipt presentation components (progress, overview, note disclosure, history) and read-only API history support where required. History merges persisted status changes, scans/removals and header edits with their saved actor/time.
- [x] Reorganize InboundScanModal into Overview / Goods (or Scan goods) / History without replacing existing mutation handlers. Apply compact column widths, 8px table corners, source as plain icon/text, status beside close. Remove last-update field and scan summary. Mutable receipts initially show scan; posted/cancelled receipts show overview.
- [x] Verify inbound regressions, typecheck/build, relevant UI checks and actual browser rendering in light/dark desktop/mobile using mocked API responses; review final diff. Report exact verification limits. No deploy/push requested.

Review focus: scanning state/focus when tabs change; permission-disabled writes; partial/missing historical data; cancelled-with-scans evidence retained; long unbroken notes and narrow layouts.

Verification: 148 frontend/inbound+i18n tests passed; 11 backend inbound tests / 107 assertions passed; 40 responsive browser layout cases plus selected-tab dark contrast passed. Production build passed with existing chunk-size warning. Focus-review finding reproduced and fixed with a regression test. Token guard cannot start: missing docs/ui/vuexy-sync/allowlists/hardcoded-hex-baseline.json. Browser evidence uses production components/hooks with fixture read responses, not live inventory writes. Final typecheck and targeted ESLint passed. Final Vite production bundle passed. Independent review had one focus-restoration finding, reproduced RED then fixed GREEN. No deployment or push performed.
