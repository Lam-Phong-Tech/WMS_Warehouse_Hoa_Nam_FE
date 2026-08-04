# [FE1] Chuan hoa Build/env/health - WWHN-156

Ngay cap nhat: 2026-08-02

## Ket luan Remove Flag

| Muc | Van de reviewer neu | Xu ly trong lan nay | Owner | Trang thai |
| --- | --- | --- | --- | --- |
| P0 | N/A cho FE1, khong thay P0 truc tiep thuoc FE build/env/health | Doi chieu lai scope: khong co P0 code blocker thuoc FE1. Bo sung guard de tranh tai phat loi build/env/health. | FE1 | Done |
| P1 | QA smoke chua dong | FE1 bo sung contract smoke co the verify trong repo: FE artifact `/health.json`, backend health path, login endpoint, master API smoke paths. QA1 van phai attach log DEV/UAT that. | QA1 | FE ready, cho QA evidence |
| P1 | Parent gate chua dong | FE1 bo sung env/health/secret baseline gate vao CI de DevOps co log build/deploy ro rang. DevOps van phai xac nhan URL DEV/UAT, config matrix va secret runtime that. | DevOps | FE ready, cho DevOps evidence |
| P1 | `npm run build` chua co pass sach | Chay lai build tren runner/quyen sach: pass. Sandbox local bi EPERM khi Vite xoa `dist`, nhung build ngoai sandbox pass va da sinh artifact moi. | FE1 + DevOps | Done cho FE local evidence; CI can attach build ID/log |

## Code da cap nhat

| Hang muc | File | Noi dung |
| --- | --- | --- |
| Env/health contract gate | `scripts/verify-env-health-contract.mjs` | Kiem tra `.env.example` co du key runtime, validate URL/timeout/boolean/env name, chan key/value co dau hieu secret, xac nhan `public/health.json`, va co smoke contract cho `/health.json`, `/auth/login`, master API paths. |
| NPM script | `package.json` | Them `npm run env:verify`. |
| CI gate | `.github/workflows/ci.yml` | Them step `Verify env and smoke contract` sau test va truoc build. |

## Contract hien tai

### Static FE health

Source: `public/health.json`

```json
{
  "status": "ok",
  "service": "wms-hoa-nam-frontend",
  "component": "frontend",
  "healthcheck": "static"
}
```

Deploy artifact bat buoc sau build:

| Artifact | Yeu cau |
| --- | --- |
| `dist/index.html` | Ton tai, khong rong, co module entry script. |
| `dist/health.json` | Ton tai, khong rong, JSON hop le, match FE static health contract. |

### Runtime env matrix

| Key | Required | Rule |
| --- | --- | --- |
| `VITE_APP_ENV` | Yes | Chi nhan `local`, `dev`, `uat`, `prod`, `test`. |
| `VITE_APP_TITLE` | Yes | Ten ung dung runtime. |
| `VITE_APP_VERSION` | Yes | Version/build label runtime. |
| `VITE_API_BASE_URL` | Yes | URL `http/https`, khong co trailing slash. |
| `VITE_API_HEALTH_PATH` | Yes | Bat dau bang `/`, default trong app la `/health`. |
| `VITE_API_TIMEOUT_MS` | Yes | So duong. |
| `VITE_API_WITH_CREDENTIALS` | Yes | `true/false/1/0`; bat true chi khi BE CORS/cookie cho phep origin FE. |
| `VITE_STORAGE_URL` | Yes | Co the rong; neu co gia tri phai la URL `http/https`, khong trailing slash. |
| `VITE_ENABLE_ANALYTICS` | Yes | Boolean string. |
| `VITE_ENABLE_DEBUG` | Yes | Boolean string. |
| `VITE_ENABLE_PERF_MONITOR` | Yes | Boolean string. |

Secret baseline: khong commit token, password, private key, API key hoac client secret vao `.env.example`/source. Credential smoke phai inject qua CI/runtime secret.

### Smoke path handoff

| Smoke item | FE contract | Evidence can attach |
| --- | --- | --- |
| FE artifact | `GET <FE_URL>/health.json` tra payload static health o tren. | QA1/DevOps log hoac screenshot DEV/UAT. |
| Backend health | `VITE_API_BASE_URL + VITE_API_HEALTH_PATH`. | DevOps/QA1 response log theo URL DEV/UAT that. |
| Login | `POST /auth/login`. | QA1 smoke login bang test credential tu secret. |
| Master API | `GET /products`, `/product-categories`, `/uoms`, `/suppliers`. | QA1 log status/response/request-id tren DEV/UAT. |

## Verification da chay

Ngay chay: 2026-08-02

| Command | Ket qua | Ghi chu |
| --- | --- | --- |
| `npm.cmd run env:verify` | Pass | FE env matrix, static health, secret baseline, smoke path contract valid. |
| `npm.cmd run test -- src/shared/config/env.test.ts` | Pass | 1 file, 2 tests. |
| `npm.cmd run lint` | Pass | ESLint `src/` sach. |
| `npm.cmd run build` | Pass | Chay ngoai sandbox/quyen sach; Vite build thanh cong va sinh `dist/*`. |
| `npm.cmd run health:check` | Pass | `dist/index.html` va `dist/health.json` match contract. |

Luu y: Lan chay build trong sandbox Windows bi `EPERM` khi unlink file cu trong `dist/assets`. Khi chay lai voi quyen runner sach, `npm.cmd run build` pass. Vi vay blocker "npm run build chua co pass sach" da co local evidence pass, nhung DevOps van can attach CI build ID/log/artifact cho parent gate.

## Phan con can QA1/DevOps dong co

| Owner | Can lam de go flag hoan toan |
| --- | --- |
| QA1 | Attach smoke log DEV/UAT cho FE artifact, `/health.json`, login, va master API smoke paths. Log nen co env, FE URL, API base URL da mask neu can, build ID/commit, account role, status code/request-id. |
| DevOps | Xac nhan URL DEV/UAT, build/deploy log, artifact, config matrix theo cac key tren, secret baseline trong CI/runtime, va health/smoke pass. |
| FE1 | Da cung cap guard code/CI va evidence local. Neu CI fail do env thieu/sai, sua `.env.example`/pipeline config theo log `env:verify`. |

## Ket luan FE1

FE1 da xu ly sau vao code thay vi chi disposition bang tai lieu:

- Co gate `env:verify` de bat loi env matrix, static health, secret baseline va smoke path contract.
- CI da chay gate moi truoc build.
- `npm run build` da pass tren runner/quyen sach, sau do `health:check` pass tren artifact moi.
- Khong con P0/P1 code blocker thuoc FE1 cho scope build/env/health.

Flag chi nen con mo neu QA1/DevOps chua attach evidence DEV/UAT that theo bang tren.

## Remove Flag P0/P1 bo sung theo review WWHN-78/HN-UAT-003

Ngay cap nhat bo sung: 2026-08-02 ICT

Baseline code tai thoi diem cap nhat: local HEAD `ef7c9ff`. Khi tao PR/merge, FE1 phai thay bang PR URL, commit SHA merge, CI build ID va deployed build/version thuc te. CI da co gate de bat thieu evidence contract truoc build.

### 1. Danh sach loi UAT can trace tu WWHN-78/HN-UAT-003

| UAT defect id | Module | Route | Role/account | Viewport | Expected | Actual before | Severity | Before evidence | FE disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WWHN-78/HN-UAT-003-001 | Auth/session/RBAC | `/errors/403`, protected routes | Anonymous, authenticated thieu permission, password-change-required | Desktop/tablet/mobile | Anonymous ve login; thieu permission ve 403; password-change-required ve `/change-password` | QA2 test password-change-required dang bi skip nen chua verify duoc | P1 | `e2e/auth-role-navigation-qa2.spec.ts` truoc sua co `test.skip` | Fixed in code: unskip QA2 scenario va sua mock `/auth/me` tra dung 403 `PASSWORD_CHANGE_REQUIRED`. |
| WWHN-78/HN-UAT-003-002 | UI/responsive/RBAC evidence package | Tat ca route/module trong WWHN-292 | Role du quyen/thieu quyen/super admin/context | 1440x900, 768x1024, 390x844 | Moi loi co module, route, role/account, viewport, expected/actual, severity, before evidence | Artifact truoc do chi la checklist, chua co gate bat buoc du field | P1 | `docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md` | Fixed in repo gate: `npm run uat:p0p1:verify` fail neu thieu traceability/evidence/disposition core. BA/QA van phai dien tung defect that tu WWHN-78. |
| WWHN-78/HN-UAT-003-003 | Build/env/health proof | CI/build artifact | FE1/DevOps | N/A | Artifact noi ro file/PR/commit/build/SHA va surface da sua | Doc chua gan gate UAT P0/P1 vao code/CI | P1 | Reviewer comment Remove Flag | Fixed in code: them verifier P0/P1 va CI step `Verify UAT P0/P1 readiness contract`. PR/build ID thuc te cho DevOps attach sau deploy. |

### 2. Code/PR/build/SHA va surface da sua

| Surface | File | Ly do sua | Trang thai |
| --- | --- | --- | --- |
| Env/health contract | `scripts/verify-env-health-contract.mjs` | Chung minh `.env.example`, `public/health.json`, smoke path va secret baseline co guard bang code. | Done |
| UAT P0/P1 readiness gate | `scripts/verify-uat-p0-p1-readiness.mjs` | Chan viec dong task khi thieu defect traceability, after evidence UI/responsive/RBAC, QA2 WWHN-293 disposition, parent WWHN-78 disposition, DEC-UAT baseline, backend RBAC evidence. | Done |
| NPM scripts | `package.json` | Them `env:verify` va `uat:p0p1:verify` de FE/CI/QA chay cung mot contract. | Done |
| CI gate | `.github/workflows/ci.yml` | Chay env contract va UAT P0/P1 readiness truoc build de artifact khong con la note thu cong. | Done |
| QA2 RBAC/session retest | `e2e/auth-role-navigation-qa2.spec.ts` | Mo lai test password-change-required va sua mock `/auth/me` de 403 dac biet khong bi coi la 401/generic 403. | Done |

### 3. After evidence UI/responsive/RBAC can attach

| Evidence nhom | Command/script | Viewport/role/state bat buoc | Trang thai |
| --- | --- | --- | --- |
| Desktop/tablet/mobile UI | `npm run test:e2e -- e2e/auth-role-navigation-qa2.spec.ts` hoac capture script tu `scripts/capture-*.mjs` | Desktop 1440x900, tablet 768x1024, mobile 390x844 | FE code ready; QA2 can retest on build/env/browser thuc |
| RBAC route/action | `e2e/auth-role-navigation-qa2.spec.ts`, `scripts/capture-role-scopes-screenshots.mjs` | Anonymous, user thieu quyen, user du quyen, super admin/context | FE mock/evidence path ready; QA2 can attach screenshot/video |
| API 403/backend deny display | `scripts/capture-permission-403-evidence.mjs`, `docs/Task_docs_Jira/HN-FND-001-FE-AUTH-SESSION-403.md` | Sample 403, request id, permission code, role/scope | FE render path ready; BE/RBAC owner phai cung cap direct API 403 doc lap |
| UI states | `docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md` checklist + module tests/capture tuong ung | loading, empty, error, success, disabled, confirm | Gate bat buoc co checklist; screenshot/video sau sua can attach theo tung defect |

### 4. QA2 WWHN-293 retest disposition

| Item | Required fix | Disposition |
| --- | --- | --- |
| QA2 WWHN-293 chua verify | QA2 retest dung build/env/browser/role va comment pass/fail kem evidence | FE da bo sung code/test path. QA2 phai chay tren deployed build that, ghi browser, env, build ID/SHA, role/account, pass/fail va attach screenshot/video. FE khong tu ky thay QA2. |

### 5. Parent WWHN-78 Blocked/Pending disposition

| Blocker parent | Required disposition | Owner | Trang thai FE |
| --- | --- | --- | --- |
| WWHN-78 con Blocked/Pending | Lead/FE/QA ghi disposition cho toan bo blocker parent truoc khi Done | Lead + FE1 + QA2 | FE da co code gate va defect table mau. Lead/QA2 phai doi chieu tat ca defect con trong parent, dong hoac ghi owner/ETA. |
| Thieu danh sach loi UAT that | Moi loi gan module/route/role/account/viewport/expected/actual/severity/before evidence | BA/QA + FE1 | FE gate bat yeu cau cau truc; BA/QA can dien defect source register tu WWHN-78/HN-UAT-003. |

### 6. BA Pin/DEC-UAT baseline

| Baseline | Required fix | Owner | Disposition |
| --- | --- | --- | --- |
| WWHN-20 | Approval/traceability/source register ro | BA + BAS + PM/QA | FE khong tu baseline nghiep vu; can link approval hoac ghi blocker co owner/ETA. |
| WWHN-28 | Approval/traceability/source register ro | BA + BAS + PM/QA | Can pin DEC-UAT truoc khi xem Done. |
| WWHN-140 | Approval/traceability/source register ro | BA + BAS + PM/QA | FE chi implement theo baseline da duyet. |
| WWHN-141 | Approval/traceability/source register ro | BA + BAS + PM/QA | Neu chua duyet, parent WWHN-78 khong nen Done. |
| WWHN-142 | Approval/traceability/source register ro | BA + BAS + PM/QA | Can source register ro cho QA trace. |

### 7. RBAC/backend authorization doc lap

| Required fix | FE evidence | BE/RBAC required evidence | Trang thai |
| --- | --- | --- | --- |
| Permission catalog | `src/app/router/access.ts`, `src/shared/components/permission/*`, `docs/Task_docs_Jira/HN-FND-001-FE-AUTH-SESSION-403.md` | Catalog permission backend da duyet, mapping route/action/API, data scope | FE ready, BE/RBAC owner can sign-off |
| Sample 403 | `ApiErrorAlert`, `NoPermissionState`, `e2e/auth-role-navigation-qa2.spec.ts`, `scripts/capture-permission-403-evidence.mjs` | Direct API call bang token thieu quyen tra HTTP 403, co request id va permission/data-scope reason | FE render ready; backend deny doc lap chua the thay bang UI hidden |
| Backend deny independent | FE guard chi la UX gate | BE xac nhan API deny ngay ca khi bypass UI/button | BE1/BE2 + QA required |

### 8. Verification commands moi

| Command | Muc dich |
| --- | --- |
| `npm.cmd run env:verify` | Verify env/health/smoke/secret baseline. |
| `npm.cmd run uat:p0p1:verify` | Verify artifact co du P0/P1 readiness contract theo reviewer. |
| `npm.cmd run test -- src/app/router/RequirePermission.test.tsx src/app/router/ProtectedRoute.test.tsx src/shared/api/api-error.test.ts src/shared/api/axios.test.ts` | Verify route/RBAC/API 403 foundation. |
| `npm.cmd run test:e2e -- e2e/auth-role-navigation-qa2.spec.ts` | QA2 UI role/navigation retest path cho browser/viewport/role. |
| `npm.cmd run build && npm.cmd run health:check` | Verify production artifact va `/health.json`. |
