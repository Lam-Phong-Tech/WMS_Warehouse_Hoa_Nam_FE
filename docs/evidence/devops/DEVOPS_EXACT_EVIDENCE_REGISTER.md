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

That FE SHA is the snapshot the previous review was asked to inspect. The current artifact for this register is the
exact SHA recorded in `docs/evidence/WWHN-296/RUNTIME_IDENTITY_PIN.json`.

Current remediation adds:

- `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json` — authority register with pinned baseline hashes;
- M1/M3 wording that anchors the no-Stocktake boundary to `REQ-SRS-037` in the adopted SRS/FRD v1.12 baseline while
  keeping the standalone `WWHN-25 / DEC-STK-001` Decision Record explicitly pending;
- `scripts/run-wwhn-296-evidence.mjs` + `scripts/verify-wwhn-296-closure.mjs` — executed evidence and closure gate;
- BE `security.browser_runtime_contract` in `php artisan wms:golive-check` — deployed-environment config matrix;
- `.github/workflows/exact-sha-evidence.yml` for historical immutable SHA execution.

### Environment boundary

Source evidence proves the expected contract only:

- canonical base path ends in `/api/v1`;
- sample local `VITE_API_BASE_URL=http://localhost:8080/api/v1`;
- DEV/UAT/PROD values must be injected outside source;
- production domain/secret must not be hard-coded.

Source evidence does **not** prove the actual deployed UAT/PROD `VITE_API_BASE_URL`, CORS allow-list, cookie attributes, TLS, static-cache policy, rollback execution or deployed health. Those remain DevOps/runtime evidence.

### Stocktake governance boundary (corrected — WWHN-296 / FE296-P1-01)

The no-Stocktake guard is anchored to the adopted requirement baseline, not to a standalone Decision ID:

- Controlling requirement: `REQ-SRS-037` (**Must**) in `docs/HN_SRS_FRD_v1.12_FULL.md` — HN-SRS-FRD-001 v1.12,
  SHA-256 `02cd010cdc40036b62ec23a0d3aa645e4cce813497edf8b0e851ba6fcb512ff2`.
- Baseline adoption: `WWHN-334`, status `DONE REDFLAG` / resolution `Done` (observed 18/08/2026). SRS section 0.1
  defines the effective date as that transition.
- Data baseline: `docs/HoaNam_ERD_Moi_Nhat.md` SHA-256 `c81381546d580edf50f4e327fbd859af72f9d3a190814043c00daa27511a06d3`,
  section 0.1 excludes `Stocktake_Session`, `Stocktake_Snapshot`, `Stocktake_Count`, `Variance_Line`, `Adjustment`.
- UI baseline: `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` SHA-256
  `107a2b4de0f5763e39278ec130758d57e772e004e525416c088018cf9ddba658` — no Stocktake screen/menu/stock-edit action.
- Standalone Decision Record `WWHN-25 / DEC-STK-001` is still `In Progress`, so `DEC-NO-STOCKTAKE-001` is **not**
  cited as an approved Decision ID and no approval date/hash is claimed from FE source.
- Machine-readable status: `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json`; enforced by
  `npm run check:api-mapping` and `npm run wwhn-296:verify` (both re-read the baselines and pin their hashes).

### WWHN-296 current artifact vs ATT-11432

`ATT-11432` (01/08/2026) is a historical Jira attachment and is superseded for source review. The current
artifact is the repository tree at the exact FE SHA recorded in `docs/evidence/WWHN-296/RUNTIME_IDENTITY_PIN.json`,
together with `docs/evidence/WWHN-296/SHA256SUMS` and the per-command logs under `docs/evidence/WWHN-296/logs/`.
Those files are generated by `npm run wwhn-296:evidence`, which records the real exit code of every gate command
plus the FE SHA, BE SHA, branch, build id and timestamps. Canonical branch is `m1`.

### Deployed environment evidence (still DevOps-owned)

Run on the deployed environment itself, on the exact BE SHA:

```bash
php artisan wms:golive-check --json=build/evidence/wwhn-296/golive-check.json
```

The `security.browser_runtime_contract` dimension emits the sanitized config matrix required by FE296-P1-03
(APP_URL, health URL, CORS allow-list, `supports_credentials`, refresh-cookie name/path/domain/Secure/SameSite)
and fails closed on an empty or wildcard allow-list, a plaintext origin, a non-HTTPS `APP_URL`, a non-Secure
cookie, a cookie path outside `/api/v1/auth`, or a cross-site frontend still served with `SameSite=lax`.
Attach the JSON plus the deploy/rollback log to `WWHN-294`.

## Evidence integrity rule

Use only these result states:

- `SOURCE VERIFIED` — exact immutable repo contents were inspected;
- `CI VERIFIED` — exact SHA run URL + raw logs + artifact + required exit codes 0 were inspected;
- `RUNTIME VERIFIED` — named deployed build/environment health/smoke/security evidence was inspected;
- `PENDING` — any required evidence above is missing.

Never replace `PENDING` with `VERIFIED` based on a command list, source test file, placeholder or sibling-task comment.
