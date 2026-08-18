# DevOps Exact Evidence Register — WWHN-325 / WWHN-311 / WWHN-296

Updated: 2026-08-18 ICT

This register separates source evidence from executed CI/runtime evidence. A source link or test implementation is never treated as proof that the command actually exited with code 0.

## WWHN-325 — PWA/cache

- Final reviewed FE SHA: `5cc27970d36edd2063fd3ce4181d2108dd0077d0`.
- Implementation ancestor: `651d037569ac8beb1f2440475f96ec66982f826c`.
- BE baseline paired for review: `0a7bd392f4510f3ad5d5be7394173695463f2b6e`.
- Chromium evidence source:
  - `e2e/wwhn-325-pwa-offline.spec.ts` at exact `5cc27970...`;
  - `src/shared/pwa/pwa-assets.test.ts` at exact `5cc27970...`.
- Covered in source: manifest/icons, service-worker registration, cache inventory, no `/api` cache, offline write lock, no background sync, versioned cache cleanup.
- CI execution status: `PENDING CI EXECUTION / EXACT RUN NOT PINNED`.

To create immutable CI evidence, run `.github/workflows/exact-sha-evidence.yml` with:

- `source_sha=5cc27970d36edd2063fd3ce4181d2108dd0077d0`
- `run_pwa_gate=true`

Required closure evidence after the run:

- workflow run URL/ID;
- artifact `exact-fe-evidence-5cc27970d36edd2063fd3ce4181d2108dd0077d0` ID/digest;
- `ci-evidence/exact-sha-evidence-manifest.json`;
- `ci-evidence/SHA256SUMS`;
- exit-code files equal `0` for lint, typecheck, unit/integration, production build, health, API mapping, Chromium install and PWA runtime;
- raw command logs and Playwright report/test-results.

## WWHN-311 — Frontend handover

- Exact handover SHA: `13ef8b6f85afeba147f83bb593e493ddfc522e8e`.
- Canonical file: `docs/Task_docs_Jira/WWHN-311.md` at that SHA.
- BE baseline recorded by handover: `0a7bd392f4510f3ad5d5be7394173695463f2b6e`.
- Source contract contains Node.js 22, install/build/test commands, required `VITE_*` environment contract, build outputs and health/API-mapping commands.
- CI/runtime execution status: `PENDING CI EXECUTION / EXACT RUN NOT PINNED`.

To create immutable build evidence, run `.github/workflows/exact-sha-evidence.yml` with:

- `source_sha=13ef8b6f85afeba147f83bb593e493ddfc522e8e`
- `run_pwa_gate=false`

Do not convert source review into CI/runtime VERIFIED until the exact run and artifact are pinned.

## WWHN-296 — Runtime/API mapping

Historical Jira attachment `ATT-11432` is not current source evidence.

Requested exact repository snapshot:

- FE SHA: `b26c8ff95de83eaade5ec47b677b05044d4be56d`.
- `docs/Task_docs_Jira/WWHN-296.md`.
- `docs/api-evidence/M1_API_MAPPING.md`.
- `docs/api-evidence/M2_DEPENDENCY_LIST.md`.
- `docs/api-evidence/M3_DEPENDENCY_LIST.md`.
- `.env.example`.

Current remediation adds:

- `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json`;
- corrected M1/M3 wording that traces implementation disposition to `WWHN-25 / DEC-STK-001` and keeps formal PM/PO/Process Owner approval pending;
- `.github/workflows/exact-sha-evidence.yml` for historical immutable SHA execution.

### Environment boundary

Source evidence proves the expected contract only:

- canonical base path ends in `/api/v1`;
- sample local `VITE_API_BASE_URL=http://localhost:8080/api/v1`;
- DEV/UAT/PROD values must be injected outside source;
- production domain/secret must not be hard-coded.

Source evidence does **not** prove the actual deployed UAT/PROD `VITE_API_BASE_URL`, CORS allow-list, cookie attributes, TLS, static-cache policy, rollback execution or deployed health. Those remain DevOps/runtime evidence.

### Stocktake governance boundary

- Actual Jira source: `WWHN-25 / DEC-STK-001`.
- BA business disposition: comment `14791` — no Stocktake for current MVP/Beta, deferred/later phase.
- Formal approval request: comment `15251`.
- Formal PM/PO/Process Owner current-hash approval: `PENDING`.
- `DEC-NO-STOCKTAKE-001` is not an approved Decision ID and must not be cited as one.

## Evidence integrity rule

Use only these result states:

- `SOURCE VERIFIED` — exact immutable repo contents were inspected;
- `CI VERIFIED` — exact SHA run URL + raw logs + artifact + required exit codes 0 were inspected;
- `RUNTIME VERIFIED` — named deployed build/environment health/smoke/security evidence was inspected;
- `PENDING` — any required evidence above is missing.

Never replace `PENDING` with `VERIFIED` based on a command list, source test file, placeholder or sibling-task comment.
