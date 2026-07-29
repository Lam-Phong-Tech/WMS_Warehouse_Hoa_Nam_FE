# HN-FND-001 - FE Auth Session 403 Evidence

## Traceability

| Field | Value |
| --- | --- |
| Parent Task | WWHN-35 - [FOUNDATION] Xac thuc, RBAC, audit va cau truc loi chuan |
| Parent Temp Key | HN-FND-001 |
| Epic Temp Key | HN-EPIC-03 |
| Dependency | HN-FND-001-ST01 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output | Tich hop xac thuc FE |

## Scope Verified

- Login uses approved `POST /auth/login` contract through `authService.login`.
- Access token remains memory-only; persisted auth state stores only non-sensitive
  session hints.
- Session bootstrap rehydrates persisted hints, then restores access through
  `POST /auth/refresh` with HttpOnly refresh cookie.
- Protected routes wait for bootstrap and `GET /auth/me` profile/permission load
  before rendering protected UI.
- Anonymous users are redirected to `/login` with the attempted URL preserved in
  router state.
- Successful login now restores the attempted protected URL, including query
  string and hash, instead of always forcing `/dashboard`.
- Route-level RBAC still uses `RequirePermission`; missing permissions redirect
  to `/errors/403`.
- `/errors/403` is protected by session guard, so anonymous users do not see a
  permission page before authentication.
- API 403 responses are marked by the axios interceptor and rendered consistently
  by `ApiErrorAlert` / `NoPermissionState`.
- `PASSWORD_CHANGE_REQUIRED` remains a special 403 flow and redirects to
  `/change-password` without clearing the session.

## Acceptance Criteria Mapping

| Acceptance Criteria | Evidence |
| --- | --- |
| Output "Tich hop xac thuc FE" reviewed/verified | `auth.store.ts`, `bootstrap-auth.ts`, `axios.ts`, `ProtectedRoute.tsx`, `RequirePermission.tsx`, `use-login.ts` |
| Loading/error/disabled states | `ProtectedRoute` loading gates; `LoginPage` submitting overlay and disabled fields; `ApiErrorAlert` for API error states |
| Permission/RBAC and API error display | Route guard redirects to `/errors/403`; API 403 renders `NoPermissionState`; password-change 403 keeps dedicated redirect |
| No hard-coded business rules outside contract | FE only mirrors route/action permission hints; backend remains source of truth for auth/RBAC/data scope |
| Endpoint/payload aligned with contract | `auth.service.ts` uses `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/refresh`, `/auth/switch-context`, `/auth/change-password` via shared endpoint constants |
| Lint/build/test pass | Verification log below |
| BA/QA evidence available | This file documents traceability, scope, disposition, and verification commands |

## Changed Files

- `src/modules/auth/hooks/use-login.ts`
- `src/app/router/index.tsx`
- `src/modules/auth/hooks/use-login.test.tsx`
- `docs/evidence/HN-FND-001-FE-AUTH-SESSION-403.md`

## Blockers / Disposition

- No FE1 P0/P1 blocker remains for login/session/403 integration.
- No API contract mismatch found in the implemented FE scope.
- Remaining BE-owned enforcement stays on backend by design: token validity,
  refresh cookie rotation, role/data-scope authorization, audit, and structured
  error payloads.

## Verification Log

Executed on 2026-07-29 in `C:\ERP_HOA_NAM\Hoa_Nam_Tools`:

```text
npm.cmd test -- --run src/modules/auth/hooks/use-login.test.tsx src/app/router/ProtectedRoute.test.tsx src/app/router/RequirePermission.test.tsx src/shared/api/axios.test.ts src/shared/api/axios.refresh.integration.test.ts src/shared/api/api-error.test.ts
Result: PASS - 6 test files, 42 tests

npm.cmd run lint
Result: PASS

npm.cmd run build
Result: PASS - tsc -b and vite build completed
```
