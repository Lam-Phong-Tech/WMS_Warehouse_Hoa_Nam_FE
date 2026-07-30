# HN-DEVOPS-001 - FE1 Build/Env/Health Evidence

## Traceability

| Field | Value |
| --- | --- |
| Parent Task | WWHN-32 - [DEVOPS] Moi truong local/DEV/UAT, CI/CD va baseline secret |
| Parent Temp Key | HN-DEVOPS-001 |
| Epic Temp Key | HN-EPIC-03 |
| Dependency | HN-DEVOPS-001-ST01 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Owner FE | Quang Nguyen Thanh |
| Output | Deployable frontend |
| Review date | 2026-07-30 |

## Scope

FE1 standardized the frontend build/env/health surface without changing backend
API contracts or business rules.

## Delivered

| Area | Evidence |
| --- | --- |
| Runtime env | `src/shared/config/env.ts` validates `VITE_APP_ENV`, `VITE_API_BASE_URL`, `VITE_API_HEALTH_PATH`, `VITE_API_TIMEOUT_MS`, storage URL, and feature flags. |
| API integration | `src/shared/api/axios.ts` now reads base URL and timeout from `runtimeConfig`; services continue using shared `http` and endpoint constants. |
| Storage URL | `src/shared/utils/storage-url.ts` uses centralized env config and avoids direct `import.meta.env` access. |
| Health artifact | `public/health.json` is copied to `dist/health.json`; `scripts/check-frontend-health.mjs` verifies deployable frontend artifacts. |
| CI/CD gate | `.github/workflows/ci.yml` runs `npm run health:check` after build. |
| Documentation | `.env.example`, `README.md`, and `docs/WMS_FRONTEND_STANDARDIZATION.md` document FE env/build/health expectations. |

## Contract Notes

- FE does not define backend health response semantics. Backend health remains
  owned by DevOps/BE through `VITE_API_BASE_URL + VITE_API_HEALTH_PATH`.
- No API endpoint/payload was renamed in this task.
- No RBAC/business rule was inferred in FE.
- Secrets are not introduced. `.env.example` contains only non-secret defaults.

## Acceptance Criteria Mapping

| Acceptance Criteria | Result |
| --- | --- |
| Output "Deployable frontend" reviewed/verified | Build artifact includes `index.html` and `/health.json`; CI has health check gate. |
| UI handles states and follows spec | Existing shared UI/RBAC/API error foundations are preserved; this task does not alter module UI behavior. |
| Permission/RBAC and API error display | Existing route guard/API interceptor behavior preserved. |
| No hard-code data/rules contrary to contract | Env is centralized; no business data or API contract was hard-coded in modules. |
| Lint/build/test suitable pass | Run results should be attached below after verification. |
| BA/QA evidence | This file plus README/env docs provide FE1 evidence for HN-DEVOPS-001. |

## Verification Log

Run on 2026-07-30:

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run lint` | Pass | ESLint passed for `src/`. |
| `npm.cmd run test -- --run src/shared/config/env.test.ts src/shared/api/axios.test.ts src/shared/api/http.test.ts` | Pass | 3 test files, 24 tests passed. |
| `npm.cmd run build` | Pass | `tsc -b` and Vite production build completed. Initial run was blocked by old `dist` filesystem permissions; regenerated after cleaning generated `dist`. |
| `npm.cmd run health:check` | Pass | Verified `dist/index.html` and `dist/health.json`. |
| `npm.cmd run check:api-mapping` | Pass with warning | No method/path conflict. Runtime catalog fetch skipped because `VITE_TEST_EMAIL`/`VITE_TEST_PASSWORD` are intentionally unset. |
| `npm.cmd run format:check` | Existing fail outside scope | Fails only on pre-existing `src/modules/master-data/pages/MasterPage.tsx`; new env files were formatted. |

## Open Blockers

None in FE1 build/env/health scope after verification. Backend/DevOps still own
the real API health endpoint implementation and environment-specific secret
provisioning.
