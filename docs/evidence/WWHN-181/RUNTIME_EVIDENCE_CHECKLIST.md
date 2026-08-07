# WWHN-181 — Runtime Evidence Checklist

> Release evidence only. Unit tests and mocked Playwright are regression evidence, **not** QA2 runtime sign-off.

## 1. Exact identity — mandatory

- Task: `WWHN-181`.
- Contract gate: `WWHN-180`.
- Contract version: `1.7.0`.
- Exact BE SHA: `fc534ed8c00dadd91ce60e7bac5a8660dda74d08`.
- BE immutable manifest SHA256: `ba8bc5841b5865095e51d21064ead90ad4c37129ee28142a3f507b497ddcc776`.
- BE release-pack SHA256: `a20b0d8d8a9145bceb2e797c51befa20d7da9e6439be512b39f72f3d8010cdb9`.
- BE repository `SHA256SUMS` SHA256: `0f4dcd23ceb84e39799fae5cb3f112932e6260a34ccff63b1ab7c623c839cb36`.
- FE SHA: **the exact commit that contains this checklist**; never substitute an earlier FE SHA.
- Build ID, environment, CI URL, artifact name/digest and FE manifest digest must all resolve to that FE SHA.

If any identity field differs, stop and create a new evidence set. Do not merge evidence from different builds.

## 2. Contract-source review gate — WWHN-180

Independent source comparison on BE SHA `fc534ed...` found two handoff drifts that must be reconciled before PASS:

1. `docs/api-contract/WWHN-180-posting-openapi.yaml` declares Scan context `WARRANTY`, while exact runtime `Modules/Warehouse/app/Http/Controllers/ScanController.php` validates `WARRANTY_TEMP_ONLY`.
2. The focused WWHN-180 TEMP_ONLY artifact omits a request body, while exact runtime `WarrantyController.php` requires `temporary_item_code`, `missing_code_reason`, `condition_status` and `Idempotency-Key`.

FE keeps the exact runtime `WARRANTY_TEMP_ONLY` behavior and does not guess a replacement contract. `WWHN-180` must publish/approve one canonical source, version, changelog and digest.

## 3. FE exact-SHA CI evidence

Workflow: `.github/workflows/wwhn-181-signoff.yml`.

Required PASS gates:

- formatting check, lint, typecheck;
- focused WWHN-181 Vitest regression suite;
- `npm run wms-contract:verify`;
- production build and build manifest;
- health check and API mapping;
- direct-runtime contract validation;
- live-UI evidence contract validation;
- `npm run wwhn-181:verify`;
- `sha256sum -c` for source files, `SHA256SUMS` and `manifest.json`.

Expected artifact name:

```text
wwhn-181-exact-sha-evidence-<EXACT_FE_SHA>
```

Record all of the following in Jira: CI URL, artifact ID, artifact URL, `artifact-digest`, FE manifest SHA256, `SHA256SUMS` verification result, FE SHA, BE SHA and environment/build identity.

`WWHN-337` currently records the GitHub Actions runner/provisioning blocker. A pre-runner failure with zero executable steps is **not** evidence that code gates failed, but it is also **not** a CI PASS.

## 4. QA2 direct runtime — WWHN-182

Use the existing secret-redacting direct HTTP runner on DEV/UAT, never `local`, `ci`, `mock`, `test` or `synthetic`.

First validate its contract without secrets:

```bash
npm run wwhn-153:runtime -- --contract-only
```

Then execute the real non-production run with exact environment variables required by `scripts/run-wwhn-153-runtime-evidence.mjs`.

QA2 must attach raw request/response evidence and effect proof for all of these categories on the same exact identity:

- happy path;
- negative validation/business error;
- backend permission deny `403` using a direct API call;
- warehouse/data-scope deny;
- idempotency replay: same key + same payload => same business result, no second side effect;
- idempotency conflict: same key + different payload => `409`;
- stale/CAS conflict;
- concurrent/double-post/race proof;
- DB before/after proof for stock-changing actions;
- inventory reconciliation reaches zero mismatch after committed effects.

FE route/action guards are UX/defense-in-depth only. They never replace backend authorization evidence.

## 5. Canonical WWHN-180 v1.7 runtime expectations

### Scan + line validation

Raw code UI flow is two-stage:

1. `POST /api/v1/scan/classify` with `raw_code`, context and warehouse UUID; response must have `stock_effect=NONE`, `movement_created=false`, `posting_event_created=false`, `idempotency_cache_written=false`.
2. Resolve exactly one remaining document line by returned `product_id`, then send `POST .../:id/scan` with `{ "line_id": "...", "qty": n }`.

The obsolete `{ "codes": [...] }` line-scan body is forbidden.

### Post receipt / post issue

- Header: `Idempotency-Key` only.
- Request body: none.
- FE preflight requires all planned lines fully scanned because exact BE posts the whole document atomically.
- Success evidence comes from `data.movements[]` plus envelope `meta.request_id`.
- Do not use FE-local stock mutation.

### Stocktake apply adjustment

- Canonical path: `/api/v1/stocktake-sessions/{id}/apply-adjustment`.
- Header: `Idempotency-Key` only.
- Body: `session_version`, **complete APPROVED** `variance_ids[]`, `reason`.
- CAS is `session_version` in the body, not `If-Match`.
- Re-read APPROVED variances immediately before apply.
- Success must be `APPLIED`; zero-effect dimensions may legitimately return an empty `movement_ids` list, but envelope `meta.request_id` is still mandatory.

## 6. P2 live UI evidence — no mocks

Validate collector contract:

```bash
npm run wwhn-181:ui-runtime -- --contract-only
```

For the real run provide:

- `WWHN_181_UI_BASE_URL` — real DEV/UAT origin;
- `WWHN_181_ENVIRONMENT` — non-local/non-mock environment;
- `WWHN_181_SOURCE_SHA` — exact 40-hex FE SHA;
- `WWHN_181_BUILD_ID`;
- `WWHN_181_QA2_ACCOUNT` and `WWHN_181_QA2_ROLE`;
- `WWHN_181_TEST_DATA_CLASSIFICATION=SANITIZED_NON_PROD`;
- `WWHN_181_STORAGE_STATE_PATH`, or a per-scenario `storage_state_env` pointing to a storage-state file;
- `WWHN_181_UI_SCENARIOS_JSON`.

Scenario set must cover at least these viewports:

| Viewport | Required |
|---|---|
| `1920x1080` | yes |
| `1366x768` | yes |
| `1024x768` | yes |
| `768x1024` | yes |
| `390x844` | yes |

The live collector does not install route interception. It records screenshot + video and a sanitized HAR-like trace containing only scenario, HTTP method, API path, status, `error_code` and `request_id`. It never writes authorization headers, cookies, query strings, request bodies or response bodies.

P2 is PASS only when every required viewport scenario passes and at least one **real** API error response contains a non-empty `request_id`.

## 7. Final sign-off — fail closed

Copy `docs/evidence/WWHN-181/FINAL_GATE_EVIDENCE.template.json` to a runtime evidence file and fill it only from independently accessible evidence. Never edit PENDING to PASS without the cited source.

Final check:

```bash
npm run wwhn-181:final -- path/to/FINAL_GATE_EVIDENCE.json
```

`final_allowed=true` is possible only when all of these share the same FE SHA, BE SHA and manifest digest:

- exact-SHA CI + artifact + `SHA256SUMS`: PASS;
- `WWHN-180`: PASS with independent reviewer separated from publisher;
- `WWHN-182`: PASS for the full runtime matrix above;
- `WWHN-183`: `GO`, open P0=`0`, open P1=`0`;
- live UI evidence: PASS.

Until then the correct release status is **BLOCKED / fail-closed**, not a synthetic 100% PASS.
