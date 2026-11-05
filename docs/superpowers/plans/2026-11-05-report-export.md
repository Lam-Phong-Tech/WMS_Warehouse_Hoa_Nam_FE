# Shared report export implementation plan

**Goal:** Consistent report export button and right drawer on every report route.
**Architecture:** Shared button/drawer, configurable sections and scope, XLSX transformation after existing audited download.
**Tech Stack:** React, TypeScript, MUI, SheetJS, Vitest.
**Spec:** ../specs/2026-11-05-report-export-design.md

## Constraints

Use DESIGN_FOUNDATIONS.md and existing Operations tokens/icons. Preserve server permission, audit, masking, polling and PDF behavior. Work from origin/dev in isolated worktree; preserve original dirty checkout.

## Review focus

Empty results; unknown workbook headers fail closed; page scope with multiple lines per document; filename extension/path characters; duplicate submission and error retry; actual route coverage.

## Tasks

- [x] Add tests proving drawer opens without exporting, selected scope/content/name reach submission, validation/error/retry and workbook filtering preserve all matching lines. Run red.
- [x] Implement ReportExportAction/Drawer/Button and workbook selection; extend UiDrawer with fixed actions. Run tests.
- [x] Integrate all report routes including inbound, outbound, reconciliation, traceability, import quality, labels, warranty, recipient and both history presentations; legacy report buttons reuse trigger. Preserve current adapters and conditions.
- [x] Run typecheck, report tests, lint, token/component checks and build; inspect responsive drawer in browser. Review final diff, commit, integrate with latest origin/dev and push.

## Verification record

- Shared export behavior, workbook selection, reconciliation and server export timeout adapter: 13/13 tests passed.
- History filter, confirmation, READY and unknown-state retry behavior: 4/4 targeted tests passed.
- TypeScript check and production Vite build passed; lint of reports and new localization passed.
- Chromium inspected at 1440/1024/768/390/320px: correct 560px right drawer (full width on phones), no horizontal overflow, pinned footer, Inter and primary rgb(0,78,116), no browser errors. Dark surface/text were also verified against the theme tokens. Screenshots retained in ignored test-results.
- Independent review found duplicate import aggregation, missing actual issued quantities and unknown-state retry protection; regression tests failed before fixes and passed afterward.
- Broad report/UI checks surfaced failures in unchanged comparison/warehouse/locale/icon/address tests and report tests with older screen assumptions or runtime timeouts. Broad runs were stopped after these failures; no claim of a green full suite. ui:tokens reports 30 pre-existing violations outside the new shared styles.
- Ruling: preserve the original dirty dev checkout; integrate this isolated branch into remote dev without rewriting local uncommitted work.
