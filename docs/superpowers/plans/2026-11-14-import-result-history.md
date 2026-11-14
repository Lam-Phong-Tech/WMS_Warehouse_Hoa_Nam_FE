# Import Result History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete import file metadata, downloads and immutable recheck history.

**Architecture:** Retain original bytes in private local storage and source metadata in import_source_files. Extend import_reports with source ID, atomic version, sheet, processing time and options. Existing report APIs and a scoped lifecycle service provide history/recheck/downloads; the drawer selects complete snapshots.

**Tech Stack:** Laravel/Eloquent, PhpSpreadsheet, React/TypeScript, TanStack Query, existing UI/i18n.

**Spec:** ../specs/2026-11-14-import-result-history-design.md

## Global Constraints

- Preserve all-or-nothing SKU writes and idempotent COMMIT replay.
- Rechecks are always DRY_RUN; each completed recheck adds one version.
- Apply existing actor scope and sku.manage to every new endpoint.
- Unknown historical metadata is null/unavailable, never fabricated.
- Use existing design tokens, responsive drawer and VI/EN/ZH catalogues.

## Review Focus

- Same filename with different bytes must not merge histories (Task 1).
- Recheck of committed source may reject duplicates but never modifies SKU (Task 2).
- Out-of-scope history/download/recheck must return 404 (Task 2).
- Missing original bytes/expired errors must explain disabled actions (Task 3).
- Selecting historical version must update counts, rows and download ID (Task 3).

### Task 1: Durable source and result metadata

Files: backend migration, ImportSourceFile, ImportReport, ImportReportWriter, ImportService; tests/Feature/ImportResultHistoryTest.php.
Interfaces: service import gains optional source ID for recheck; writer receives source path/timing in internal metadata; report serialization adds source metadata and processing options.
- [x] Write and run failing HTTP upload tests for size/sheet/actor/options/timing and same-content version grouping vs changed bytes.
- [x] Add source table and report columns with legacy grouping/backfill; atomically allocate versions under source row lock; retain bytes and enrich report snapshot within existing report transaction.
- [x] Run new tests and existing SKU dry-run/import quality tests.

### Task 2: Scoped lifecycle endpoints

Files: backend ImportReportController, ImportReportLifecycle service, import routes, ImportResultHistoryTest.
Interfaces: GET reports/{id}/versions -> report snapshots; POST reports/{id}/recheck -> new DRY_RUN report; GET reports/{id}/source-file and /result-file -> original bytes/result XLSX.
- [x] Write/run failing tests for recheck immutability, original bytes, single-version export, authorization and unavailable legacy source.
- [x] Implement with existing scope, safe error-file generation, per-version result export and cache invalidation.
- [x] Verify lifecycle and idempotency regressions.

### Task 3: Complete drawer and import labels

Files: import-match-model.ts, import-quality-api.ts, ImportQualityBatchDrawer.tsx/css, ImportQualityBaseline.tsx, i18n catalogs; model/API/drawer tests; browser fixture/spec.
Interfaces: optional import metadata on normalized batch; scoped history query and lifecycle actions; selecting version swaps the whole snapshot.
- [x] Add failing tests for metadata, dry-run actual vs planned counts, unknown values, selected-version targets and failed recheck/download.
- [x] Implement grouped metadata, actions, version selector/history, immutable-result note and accurate import-specific labels in drawer and report page.
- [x] Run focused tests, typecheck, lint/format on changed files and responsive Playwright light/dark checks.

### Task 4: Verification and delivery
- [x] Run appropriate import regression suites and project checks; record unrelated failures explicitly.
- [x] Review full diff for source path exposure, authorization, atomicity, legacy behavior and history selection.
- [x] Report verified screens/states and migration/deployment limits. Leave changes reviewable in the user's existing checkouts; do not publish or alter unrelated existing changes.

## Completion record

Implemented and verified in the existing authorized FE/BE checkouts, with unrelated pre-existing changes preserved. The user subsequently requested committing and pushing this feature to `origin/dev` in both repositories. Production deployment remains outside this task. See `docs/qa/import-result-history-2026-11-14.md` for exact checks and limitations. PostgreSQL at 127.0.0.1:5432 refused the connection, so the development migration remains unapplied; its up/down/backfill were tested against disposable SQLite.
