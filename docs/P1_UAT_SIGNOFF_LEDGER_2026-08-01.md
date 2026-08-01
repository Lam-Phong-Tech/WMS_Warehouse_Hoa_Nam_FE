# P1 UAT Sign-off Ledger

Updated: 2026-08-01 ICT  
Scope: HN-UX-002-ST01, WWHN-146, WWHN-147, QA2 review, API mapping, contract/permission/sample-data disposition, and runtime evidence for the Hoa Nam WMS FE handoff.

## Executive Status

| P1 item | Current status | Owner | Evidence in repo | Closure condition |
| --- | --- | --- | --- | --- |
| HN-UX-002-ST01 actual sign-off is not final | Conditional, not closed | BAS + BA | This ledger; `docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md`; `docs/api-evidence/M1_API_MAPPING.md` | BAS completes field/state matrix in WWHN-146 and BA completes rule/label/validation in WWHN-147. FE must not mark final UX pass before both are attached or explicitly approved. |
| QA2 has not reviewed testability | Ready for QA2 review, not self-approved by FE | QA2 | `e2e/auth-role-navigation-qa2.spec.ts`; targeted Vitest results captured below | QA2 comments pass/fail for UI state, responsive, RBAC, API error, and testability. Any fail must create a linked blocker with route, role, viewport, API response, and expected result. |
| API mapping script previously failed because `docs/api-evidence/M1_API_MAPPING.md` was missing | Resolved for hard check | FE1 + BE/BA | `docs/api-evidence/M1_API_MAPPING.md`; `docs/api-evidence/M2_DEPENDENCY_LIST.md`; `docs/api-evidence/M3_DEPENDENCY_LIST.md`; `scripts/check-api-mapping.mjs` | `npm.cmd run check:api-mapping -- --no-live` must pass with 0 hard errors after every mapping update. Runtime catalog fetch should be rerun when BE provides UAT credentials. |
| Contract, permission, and sample data remain conditional | Conditional by design | BE1/BE2 | Known mismatch tables in M1/M2/M3 evidence docs; `src/test/wms-contract-signoff-guards.test.ts` | BE1/BE2 confirms endpoint, payload, error code, permission catalog, and sample 403/409/422/idempotency response. FE only removes conditional labels after evidence is attached. |
| Runtime evidence is not sufficient yet | Partially covered by automated checks, screenshots/videos still required | FE1 + QA | Capture scripts in `scripts/capture-*.mjs`; Playwright config retains video/trace on failure | Attach desktop/tablet/mobile screenshots or videos for main role scenarios, no-permission state, and API error states against the intended UAT or approved local mock environment. |

## HN-UX-002-ST01 Gate

HN-UX-002-ST01 is not considered practically closed until both upstream UX/business artifacts are complete:

| Dependency | Required output | Owner | FE disposition |
| --- | --- | --- | --- |
| WWHN-146 | Field/state matrix: loading, empty, success, disabled, error, confirm, state transition labels, and responsive expectations per screen | BAS | FE can implement and test known states, but final state naming/order remains conditional until BAS signs off. |
| WWHN-147 | Rule, label, validation, enum/status wording, required/optional field decisions, and error text | BA | FE must keep wording/validation aligned with the approved artifact; no hidden FE-only business rule is accepted. |

Acceptance rule: if WWHN-146 or WWHN-147 is absent, the FE artifact may be marked "implementation ready" or "QA ready", but not "actual UX signed off".

## QA2 Review Matrix

| Review area | Minimum QA2 check | Current automated coverage | QA2 result |
| --- | --- | --- | --- |
| UI state | Loading, empty, error, success, disabled, confirm for impacted workflows | Shared UI/error/permission tests plus component catalog route | Pending QA2 pass/fail comment |
| Responsive | 1440x900, 1366x768, 768x1024, 390x844 for app shell, table, form, drawer/modal, state panels | `e2e/auth-role-navigation-qa2.spec.ts` has desktop/mobile smoke coverage; screenshot evidence still required | Pending QA2 pass/fail comment |
| RBAC route/menu | Anonymous redirect, authenticated no-permission redirect, menu filtering, super-admin bypass | `e2e/auth-role-navigation-qa2.spec.ts`; `src/test/auth-security-rbac-audit.test.ts` | Pending QA2 pass/fail comment |
| RBAC action | Buttons/dropdowns/forms hidden or disabled by permission and scope | `PermissionGuard.test.tsx`; `ActionButton.test.tsx`; RBAC audit tests | Pending QA2 pass/fail comment |
| API error | 401 refresh/logout, 403 no-permission, PASSWORD_CHANGE_REQUIRED, 422 validation, 409 conflict, 500/network display behavior | `src/shared/api/api-error.test.ts`; `src/shared/api/axios*.test.ts`; contract guard tests | Pending QA2 pass/fail comment |
| Testability | Scenario has deterministic account/role, route, viewport, API mock/sample, and expected result | Playwright API mocks and targeted Vitest suite are deterministic | Pending QA2 pass/fail comment |

QA2 comment format requested:

| Scenario | Route/surface | Role/account | Viewport | API response/sample | Expected | Actual | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## API Mapping Evidence

Current mapping files are present:

| File | Purpose | Hard-check status |
| --- | --- | --- |
| `docs/api-evidence/M1_API_MAPPING.md` | Core M1 endpoint-to-service mapping for dashboard, inventory, master data, receiving, shipping, reports | Passes method/path check against `swagger-api.json` |
| `docs/api-evidence/M2_DEPENDENCY_LIST.md` | Additional dependency rows and known mismatch items | Passes method/path check for contract-ready rows |
| `docs/api-evidence/M3_DEPENDENCY_LIST.md` | Late-core/high-risk dependencies and contract-ready report/movement rows | Passes method/path check for contract-ready rows |

Latest command run on 2026-08-01 ICT:

```text
npm.cmd run check:api-mapping -- --no-live
Result: PASS, 0 hard errors.
Warning: runtime permission catalog was not fetched because VITE_TEST_EMAIL or VITE_TEST_PASSWORD was not set; fallback FE catalog was used.
Warning: M1+M2+M3 mapped rows are fewer than all Swagger routes. This is acceptable only because these files are scoped evidence, not a full Swagger inventory.
```

## Contract, Permission, Sample Data

BE1/BE2 must confirm the following before conditional rows become production-ready:

| Evidence type | Required sample | Why it matters |
| --- | --- | --- |
| Endpoint | Final method/path and OpenAPI operationId/tag | Prevents FE from shipping legacy or guessed endpoints. |
| Payload | Request and response body for success and validation failure | Keeps form mapping, table columns, and optimistic refresh correct. |
| Error code | 403, 409, 422, and expected 5xx/network behavior where relevant | Ensures `ApiErrorAlert`, field errors, and retry/confirm UX are correct. |
| Permission catalog | Code, label, scope, and action mapping | Keeps route/menu/action RBAC consistent with BE authority. |
| Sample 403 | Backend-denied response for missing permission | Proves FE displays no-permission UX even if UI guard is bypassed. |
| Sample 409 | Conflict/lock/idempotency duplicate sample | Prevents FE from masking a business conflict as generic error. |
| Sample 422 | Field-level validation sample | Allows field errors to bind to the correct inputs. |
| Idempotency | Header/key rule and duplicate mutation response | Required for risky mutations such as post receipt, post issue, apply adjustment, reversal, status transition. |

FE disposition rule: a conditional dependency may remain visible in UI only as a clearly non-final/demo surface or behind approved feature gating. It must not be represented as production contract-ready in evidence until the relevant BE/BA sample is attached.

## Runtime Evidence Checklist

| Evidence package | Required artifacts | Owner |
| --- | --- | --- |
| Desktop | Screenshot/video at 1440x900 and 1366x768 for impacted modules, including table/form/action state | FE1 + QA |
| Tablet | Screenshot/video at 768x1024 for app shell, toolbar, table overflow, drawer/modal footer | FE1 + QA |
| Mobile | Screenshot/video at 390x844 for navigation, scan/form flows, state panels, confirm dialogs | FE1 + QA |
| Role scenarios | Anonymous, authenticated without permission, permission-limited user, super admin, context switch if applicable | QA2 + FE1 |
| API error states | 403, 409, 422, 500/network, refresh/session edge cases | QA2 + FE1 + BE sample owner |
| Traceability | Command, date/time, environment/base URL, build version or commit, account/role, viewport | FE1 |

## Verification Snapshot

Commands run on 2026-08-01 ICT:

```text
npm.cmd run check:api-mapping -- --no-live
Result: PASS, 0 hard errors.

npm.cmd test -- --run src/test/wms-contract-signoff-guards.test.ts src/test/auth-security-rbac-audit.test.ts src/shared/api/api-error.test.ts src/shared/components/permission/PermissionGuard.test.tsx src/shared/components/permission/ActionButton.test.tsx
Result: PASS, 5 files, 50 tests.
```

Commands still required for final P1 closure after evidence capture:

```text
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e -- e2e/auth-role-navigation-qa2.spec.ts
```

Additional verification run on 2026-08-01 ICT after QA2 harness hardening:

```text
npm.cmd run lint
Result: PASS.

npm.cmd run build
Result: PASS.

npm.cmd test -- --run src/app/router/ProtectedRoute.test.tsx src/shared/api/axios.test.ts src/test/auth-security-rbac-audit.test.ts
Result: PASS, 3 files, 40 tests.

npm.cmd run test:e2e -- e2e/auth-role-navigation-qa2.spec.ts
Result: PASS for 11 runnable scenarios, 1 skipped scenario.
Skipped scenario: PASSWORD_CHANGE_REQUIRED browser e2e. Source of truth remains unit/integration coverage in `src/shared/api/axios.test.ts`, `src/app/router/ProtectedRoute.test.tsx`, and `src/test/auth-security-rbac-audit.test.ts`.
```

## Do Not Close Criteria

Do not close the P1 bundle if any of these remain true:

| Condition | Required action |
| --- | --- |
| WWHN-146 or WWHN-147 is missing | Keep HN-UX-002-ST01 conditional and request BAS/BA attachment. |
| QA2 has not commented pass/fail | Keep QA2 review open; FE automated checks are not a QA sign-off substitute. |
| BE samples for 403/409/422/idempotency are absent for risky mutations | Keep contract/sample-data conditional and do not mark production-ready. |
| Runtime screenshots/videos are absent | Keep runtime evidence open even if unit/e2e tests pass. |
| Any `check:api-mapping` hard error appears | Fix mapping doc, Swagger snapshot, or approved script logic before sign-off. |
