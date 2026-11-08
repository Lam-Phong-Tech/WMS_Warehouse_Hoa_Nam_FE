# Packing Label Report Implementation Plan

> Execution: inline using executing-plans; independent backend fixtures are delegated using dispatching-parallel-agents.

**Goal:** Complete RPT-05 with production-backed content and safe print actions, then integrate dev.
**Architecture:** Existing report hooks remain the data source. A pure view module derives label rows, metrics and current print eligibility. Detail drawer reads immutable snapshot by ID. Backend fixtures are additive.
**Tech Stack:** React/TypeScript, shared UiDrawer/UiDialog, Vitest, Laravel/PHP.
**Spec:** ../specs/2026-11-05-packing-label-report-design.md

## Constraints and review focus
- Historical failure must never choose first-print when snapshot is already printed.
- Pending/uncertain attempts cannot resend without reconciliation.
- Labels without attempts remain visible and unique counts do not count attempts.
- Missing snapshot content must block preview/print and explain source remediation.
- Filters affect export consistently; failures preserve filters and expose retry.

## Tasks
- [x] 1. Add failing behavior tests for label/attempt distinction, printers, unknown and source-data gates; run to confirm red.
- [x] 2. Implement view projections, refreshed table/filters, accurate period metrics, export confirmation, print state handling; make tests green.
- [x] 3. Complete immutable snapshot detail/preview inside shared drawer, add retry and missing data checks; run behavior tests.
- [x] 4. Run typecheck, focused lint, build, relevant report regression tests and responsive inspection at 1440/1024/768/390/320.
- [x] 5. Review FE and independent backend fixtures, fix material findings, commit, push and integrate latest dev without touching original work.
