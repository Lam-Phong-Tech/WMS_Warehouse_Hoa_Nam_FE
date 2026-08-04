# WWHN-156 - Chuan hoa FE build, env, health va closure P0/P1/P2

## 1. Pham vi

Ho so ky thuat nay ap dung cho nhanh `m1`, theo `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`.

FE chiu trach nhiem:

- khoa env/build/health contract;
- them CI fail-fast va immutable trace theo exact source SHA;
- cung cap QA1 smoke runner cho DEV/UAT;
- tao controlled evidence responsive/UI state/RBAC UX/API error;
- ghi ro FE khong duoc tu ky thay QA1, QA2, DevOps/Lead, BA/BAS/PM/QA hoac BE/RBAC owner.

Khong co P0 code blocker rieng WWHN-156, nhung parent gate va cross-role acceptance van chua duoc xem la dong.

## 2. Root cause CI

CI cu cua source SHA `387e81b2352b33d3cc2be6d12719e231ecba92de`, run `30891359169`, da pass format, lint, typecheck, env contract va **38 test files / 325 tests**.

Run fail tai `npm run uat:p0p1:verify` vi verifier doi file khong ton tai:

`docs/Task_docs_Jira/[FE1] Chuan hoa Xay dung_env_health.md`

Ho so dung la `docs/Task_docs_Jira/WWHN-156.md`. Do fail som, build, health, API mapping va Playwright bi skip. Khong duoc dung run cu de tuyen bo runtime/build PASS.

Fix:

1. verifier doc dung va closure register co schema;
2. CI them `wwhn-156:verify` va smoke contract-only;
3. build sinh `dist/build-manifest.json`;
4. health checker bat buoc health + build manifest;
5. artifact dat theo source SHA, retention 90 ngay.

## 3. Thay doi ky thuat

### Environment

- `.env.example` chi chua public build-time config, khong chua password/token/private key.
- `VITE_API_BASE_URL` phai la HTTP(S), khong credential/trailing slash, path ket thuc `/api/v1`.
- `VITE_API_HEALTH_PATH=/health`.
- timeout phai duong; boolean chi nhan `true|false|1|0`.
- CI inject bien bat buoc, khong dua vao fallback mo ho.

### Build va CI

`npm run build` chay `tsc -b`, `vite build`, sau do `scripts/write-build-manifest.mjs`.

Build manifest ghi task, source SHA, execution SHA, artifact version, env, timestamp va health path. CI theo thu tu: format, lint, typecheck, test, env contract, UAT readiness, WWHN-156 register, smoke contract, cac WMS gate hien huu, build, health, API mapping, Playwright evidence va artifact upload. Manifest evidence van chay voi `if: always()` de luu raw disposition.

## 4. Health contract versioned

Contract version: `WWHN-156-health-v1`.

| Thanh phan | Gia tri |
|---|---|
| FE static health | `GET /health.json` |
| API base | `/api/v1` |
| Relative backend health | `/health` |
| Canonical resolved health | `GET /api/v1/health` |
| Legacy rejected | `/api/health` |

`VITE_API_BASE_URL=https://host/api/v1` + `VITE_API_HEALTH_PATH=/health` phai resolve thanh `https://host/api/v1/health`.

`/api/health` chi duoc dung neu WWHN-155 co OpenAPI version/hash/changelog moi hoac waiver BE1 + BA + QA phe duyet, co thoi han va test version.

Backend success phai co `status`, `version`, `environment`, `server_time`, `request_id` o root hoac envelope data.

## 5. QA1 smoke handoff

Script: `scripts/run-wwhn-156-smoke.mjs`; command: `npm run smoke:wwhn-156`.

CI contract-only:

```bash
npm run smoke:wwhn-156 -- --contract-only --env ci \
  --source-sha "$SOURCE_SHA" \
  --api-base-url "$VITE_API_BASE_URL" \
  --health-path "$VITE_API_HEALTH_PATH"
```

QA1 runtime DEV/UAT, credential chi inject tu secret store:

```bash
QA_SMOKE_EMAIL="<secret>" QA_SMOKE_PASSWORD="<secret>" \
FE_BASE_URL="https://<fe-env>" \
API_BASE_URL="https://<api-env>/api/v1" \
VITE_API_HEALTH_PATH="/health" \
npm run smoke:wwhn-156 -- --env uat --source-sha "<deployed-sha>"
```

Smoke kiem FE health, backend health, login, `/products`, `/product-categories`, `/uoms`, `/suppliers`. Raw JSON chi ghi method, sanitized URL, status, duration, request ID, pass/fail va missing fields; khong ghi password/token.

WWHN-157 chi dong khi QA1 attach DEV/UAT raw JSON tren exact deployed SHA va comment pass/fail.

## 6. Responsive, UI state va RBAC

`e2e/wms-runtime-evidence.spec.ts` tao screenshot/video/trace cho:

- desktop `1440x900`, tablet `1024x768`, mobile `390x844`;
- loading, empty, error, no-permission, field error, disabled, confirm;
- limited role bi route guard chuyen 403;
- login API 422 va retry-safe state.

Day la FE controlled evidence, khong thay direct API 403 khi bypass UI, data-scope deny cua backend hoac QA2 retest tren named backend. FE guard chi la UX gate; backend/RBAC la enforcement boundary.

## 7. Immutable GitHub/CI trace

Final run phai co repository/ref, source SHA 40 ky tu, execution/merge SHA, PR number, run ID/number/attempt/job, artifact `wms-fe-closure-evidence-<source_sha>`, `build-manifest.json`, `health.json`, doc/register hash va danh sach screenshot/video/trace.

Khong chap nhan local HEAD hoac ephemeral media reference. Filename runtime evidence:

`WWHN-156_<env>_<sha>_<role>_<scenario>_<viewport>_<timestamp>.<ext>`

## 8. External gate register

| ID | Sev | Van de | FE disposition | Evidence con bat buoc | State |
|---|---:|---|---|---|---|
| WWHN156-P0-01 | P0 | Khong co P0 code blocker rieng | Env/build/health fail-fast da code hoa | Final CI | FE_CONTROL_IMPLEMENTED_NO_P0_CODE_BLOCKER |
| WWHN156-P1-01 | P1 | QA1 smoke chua dong | Secret-safe smoke runner + JSON schema | QA1 WWHN-157 DEV/UAT pass/fail | BLOCKED_EXTERNAL |
| WWHN156-P1-02 | P1 | WWHN-32 chua dong | Immutable build manifest/artifact | DevOps/Lead URL, deploy log, config/secret, health, blocker disposition | BLOCKED_EXTERNAL |
| WWHN156-P1-03 | P1 | WWHN-78, WWHN-292, WWHN-293 blocked | Controlled responsive/UI/RBAC/API-error suite | Lead/QA2 defect list, before-after, real retest | BLOCKED_EXTERNAL |
| WWHN156-P1-04 | P1 | DEC-UAT chua baseline | Dependency fail-closed | BA/BAS/PM/QA approval, source register, traceability | BLOCKED_EXTERNAL |
| WWHN156-P1-05 | P1 | Backend deny chua evidence | FE guard UX-only | BE1/BE2/QA permission catalog, direct API 403, data-scope deny | BLOCKED_EXTERNAL |
| WWHN156-P1-06 | P1 | CI trace chua immutable | Source/execution SHA, run, artifact, manifest da code hoa | Final successful CI run | FE_CONTROL_IMPLEMENTED_PENDING_RUNTIME_RUN |
| WWHN156-P2-01 | P2 | Media khong truy vet | Artifact + manifest + naming convention | Dung immutable attachment | FE_CONTROL_IMPLEMENTED |
| WWHN156-P2-02 | P2 | Health conflict WWHN-155 | Lock `/api/v1/health`, reject `/api/health` | OpenAPI/waiver versioned neu override | FE_CONTROL_IMPLEMENTED_CONTRACT_LOCKED |

## 9. Jira handoff

- WWHN-157: QA1 chay smoke DEV/UAT.
- WWHN-32: DevOps/Lead chot URL, deploy/build log, config matrix, secret baseline, health/smoke va blocker disposition.
- WWHN-78, WWHN-292, WWHN-293: Lead/FE1/QA2 duy tri defect list that, after evidence va QA2 retest.
- WWHN-20, WWHN-28, WWHN-140, WWHN-141, WWHN-142: BA/BAS/PM/QA baseline DEC-UAT/source register/traceability.
- WWHN-155: BE1/BA/QA chot OpenAPI hoac waiver health endpoint.

## 10. Validation

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run env:verify
npm run uat:p0p1:verify
npm run wwhn-156:verify
npm run smoke:wwhn-156 -- --contract-only --env ci --source-sha <40-char-sha> --api-base-url http://127.0.0.1:5173/api/v1 --health-path /health
npm run master-sku:verify
npm run wms-contract:verify
npm run wwhn-148:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:evidence
```

Final evidence phai lay tu GitHub Actions tren exact commit; local check chi la preflight.

## 11. Definition of Done

FE-owned:

- [x] Sua root cause filename mismatch.
- [x] Env/secret validation fail-fast.
- [x] Khoa `/api/v1/health`, reject legacy path.
- [x] Build manifest va immutable CI trace.
- [x] WWHN-156 gate + smoke contract.
- [x] Controlled responsive/UI/RBAC/API-error evidence.
- [x] Closure register co schema va fail-closed boundary.
- [ ] Final CI run tren commit hoan thien PASS.

Cross-role acceptance:

- [ ] QA1 WWHN-157 DEV/UAT smoke PASS.
- [ ] DevOps/Lead dong WWHN-32.
- [ ] QA2 dong retest WWHN-78, WWHN-292, WWHN-293.
- [ ] BA/BAS/PM/QA baseline WWHN-20, WWHN-28, WWHN-140, WWHN-141, WWHN-142.
- [ ] BE1/BE2/QA co permission catalog, direct API 403, data-scope deny.
- [ ] BE1/BA/QA version health contract/waiver WWHN-155.

Ket luan: FE-owned controls chi duoc ghi 100% sau final CI PASS. Acceptance tong the khong duoc ghi 100% cho den khi nam gate P1 doc lap co evidence tren cung deployed source SHA.
