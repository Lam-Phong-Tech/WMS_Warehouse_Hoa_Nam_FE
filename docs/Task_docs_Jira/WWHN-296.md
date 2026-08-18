# WWHN-296 — FE prod check / runtime-build remediation evidence

Date: 2026-08-18 (ICT)  
Branch: `m1` only  
Latest reviewed Jira assessment at start of remediation: **74/100 — CHANGES REQUIRED**

## 1. Scope and truth boundary

WWHN-296 owns FE build/runtime configuration verification and source-level FE evidence. It does **not** self-sign production infrastructure, runtime deployment, backend role approval, QA execution or parent Go/No-Go.

Current external dependencies observed in Jira during this remediation:

- `WWHN-294` DevOps prod provisioning/hardening: `Blocked/Pending`.
- `WWHN-295` BE runtime/config/health: `In Progress`.
- `WWHN-297` QA1 security/health readiness: `Blocked/Pending`.
- Parent `WWHN-79`: `Blocked/Pending`.

Therefore final Done/production Go remains fail-closed until independent evidence exists on the same build/environment identity.

## 2. P0/P1/P2 remediation register

| ID | Sev | Review finding / newly discovered root cause | Remediation | Current status |
| --- | --- | --- | --- | --- |
| W296-P1-01 | P1 | API mapping gate missing/stale M1/M2/M3 evidence | Refreshed `M1_API_MAPPING.md`, `M2_DEPENDENCY_LIST.md`, `M3_DEPENDENCY_LIST.md`; current paths, explicit fail-closed rows and external boundary are now recorded. | FE source closed |
| W296-P1-02 | P1 | BE runtime route drift: OpenAPI/FE use `/api/v1/scan/classify` but Laravel route exposed only legacy `/api/v1/scan-batches/classify` | BE `m1` now restores authenticated canonical `/api/v1/scan/classify` to the same read-only `ScanController::classify` handler; legacy path remains for backward compatibility. | BE source closed; BE runtime sign-off still independent |
| W296-P1-03 | P1 | Health configuration drift: BE `.env.example` advertised legacy `/api/health` while actual versioned health is `/api/v1/health` | Aligned example to `/api/v1/health`; FE `.env.example` and env verifier already use base `/api/v1` + `/health`. | Source closed; deployed URL still DevOps-owned |
| W296-P1-04 | P1 | `wms-contract:verify` read deleted Stocktake service and asserted removed `stocktake.*` permission/endpoint | Reworked current CI contract guard so historical WWHN-181 evidence remains fail-closed but current MVP verifier enforces **no Stocktake** and append-only Reversal correction. | FE source closed |
| W296-P1-05 | P1 | `wwhn-148:verify` still required historical Stocktake mapping/test text | Aligned verifier with `REQ-SRS-037 / DEC-NO-STOCKTAKE-001` and current response-normalization tests. | FE source closed |
| W296-P1-06 | P1 | `wwhn-181:verify` exact-SHA source list still required deleted Stocktake files | Removed deleted Stocktake sources from current evidence list and added Reversal source; external WWHN-180/182/183 gates remain blocked. | FE source closed |
| W296-P1-07 | P1 | PROD `VITE_API_BASE_URL`, exact FE origin/CORS, cookie/domain/SSL/cache/rollback values are not available in source and cannot be invented | Source now documents required injection and fail-closed boundary. | **External — WWHN-294/DevOps** |
| W296-P1-08 | P1 | QA1 security/health runtime evidence missing | No self-sign. QA1 must execute against exact FE/BE SHA + deployed env. | **External — WWHN-297/QA1** |
| W296-P2-01 | P2 | Vite future-warning from `__dirname` | Already fixed on current `m1` using `fileURLToPath(import.meta.url)`; re-verified during remediation. | Closed |
| W296-P2-02 | P2 | README scripts/runtime config drift | README lists `test:e2e`, `test:coverage` and now correctly documents credentialed refresh-cookie behavior + `/api/v1/health`. | Closed |

No current FE-owned P0 was identified in the latest WWHN-296 review. External P1 gates are intentionally not marked PASS by FE.

## 3. Exact remediation identity

FE remediation tip created by this work:

- `a451d01262c90cfdd55b76a0fd2d6548286777ae`

BE remediation tip created by this work:

- `abb0cea8c27250f6d7b75c9994e002df13e2b37f`

Because `m1` is shared, reviewer/QA must bind evidence to the exact SHA actually deployed/tested and re-check the tip if later commits are added.

## 4. Changed source/evidence

### BE `m1`

- `routes/api.php` — canonical authenticated `POST /api/v1/scan/classify` alias.
- `.env.example` — versioned health endpoint `/api/v1/health`.
- Existing `app/Http/Controllers/HealthController.php` remains the public readiness check with DB/migration/seed probes and 200/503 semantics.
- Existing `config/cors.php` remains credential-safe: exact-origin allow-list, no wildcard, `supports_credentials=true`.

### FE `m1`

- `README.md`
- `docs/api-evidence/M1_API_MAPPING.md`
- `docs/api-evidence/M2_DEPENDENCY_LIST.md`
- `docs/api-evidence/M3_DEPENDENCY_LIST.md`
- `scripts/check-api-mapping.mjs`
- `scripts/verify-wms-contract-signoff.mjs`
- `scripts/verify-wwhn-148-closure.mjs`
- `scripts/verify-wwhn-181-exact-sha.mjs`

## 5. Required verification commands

Run against the exact FE SHA that will be reviewed/deployed:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run env:verify
npm run uat:p0p1:verify
npm run wms-contract:verify
npm run wwhn-148:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:evidence
```

BE runtime reviewer should additionally prove on the exact BE SHA/environment:

- `GET /api/v1/health` returns 200 only when app/database/migrations/seed readiness checks pass, otherwise 503.
- `POST /api/v1/scan/classify` reaches the read-only classifier and enforces auth + `scan.execute|scan.classify` + warehouse data scope.
- Direct unauthorized/forbidden requests remain 401/403; FE guards are not treated as backend authorization evidence.

## 6. Production evidence required before final closure

DevOps/QA must provide one coherent identity for:

- deployed FE SHA/build ID and BE SHA;
- actual PROD/UAT FE URL and API base URL;
- exact allowed CORS origin(s), refresh-cookie `Secure`/`SameSite`/domain behavior;
- SSL/HTTPS, static deploy/cache behavior and rollback evidence;
- `/api/v1/health` result on deployed environment;
- QA1 direct security/health checks and evidence artifacts;
- parent WWHN-79 Go/No-Go disposition.

Until those independent items exist, the correct disposition is **FE SOURCE REMEDIATED / EXTERNAL PROD+QA GATES PENDING**, not a fabricated 100% production PASS.
