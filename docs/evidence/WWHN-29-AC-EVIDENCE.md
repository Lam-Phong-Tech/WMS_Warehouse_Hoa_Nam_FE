# WWHN-29 Acceptance Evidence

Status: repo-side evidence completed, external Jira transition/sign-off pending
Date: 2026-07-28

## Traceability

| Jira | Evidence |
| --- | --- |
| WWHN-12 | Specification input for Module 1 app shell and RBAC |
| WWHN-29 | Parent implementation acceptance package |
| WWHN-144 | FE implementation: app shell, navigation, shared components, route/action guards, design-system docs |
| WWHN-145 | QA smoke: responsive viewport matrix, RBAC matrix, Playwright/unit/build results |

## Acceptance Criteria Matrix

| AC | Implementation/evidence | Result |
| --- | --- | --- |
| Design tokens/component inventory | `docs/design-system/DESIGN_TOKENS.md`, `docs/design-system/COMPONENT_INVENTORY.md`, `src/app/theme.ts`, `src/shared/design-tokens.ts` | Pass pending Jira attachment |
| Responsive app shell | App layout/components plus viewport checklist below | Pass pending screenshot artifacts |
| Menu by RBAC | `MENU` permission fields, `filterMenu`, `SideNav` tests | Pass |
| Route guard and 403 handling | `RequirePermission`, `NoPermissionPage`, `NoPermissionState`, axios 403 marker, tests | Pass |
| Shared UI states | Component inventory shared-state table | Pass |
| Component reuse Wave 2-3 | form/table/scan/status/audit baseline in component inventory | Pass |
| Test/CI | lint/build/API mapping/targeted unit/Playwright results below | Pass with noted existing full-suite/mock debt |
| Review/traceability/sign-off | Jira comment template below | Pending external Jira update |

## Validation Run

Local validation on 2026-07-28:

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run lint` | Pass | ESLint completed with exit code 0 |
| `npm.cmd run build` | Pass | TypeScript and Vite production build completed |
| `npm.cmd run check:api-mapping` | Pass | 0 errors; 1 warning because WWHN-29 has no endpoint rows and Swagger has 288 routes |
| `npm.cmd run test -- src/shared/components/shared-components.test.tsx` | Pass | 6 tests passed, includes `ScanInput` normalize/duplicate/focus baseline |
| `npx.cmd playwright test` | Pass | 4 passed, 1 skipped; skipped test requires `QA_ADMIN_EMAIL`/`QA_ADMIN_PASSWORD` against real QA backend |
| `npm.cmd run test` | Existing fail | Failures are in pre-existing global mocks/API store/LoginPage suites; targeted WWHN-29 shared component tests pass |
| `npm.cmd run format:check` | Existing fail | Pre-existing repo formatting drift across many `src` files; changed files were formatted locally |

## Responsive Smoke Matrix

Capture screenshots with HEAD SHA and timestamp for these rows before moving WWHN-145 to Done.

| Viewport | Route | Role | Scenario | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| 1440x900 | `/dashboard` | Admin | sidebar expanded/collapsed | content remains visible, no overlap | Covered by app shell implementation; screenshot attachment still recommended for Jira |
| 768x1024 | `/inbound` | Admin | table overflow and scan toolbar | horizontal overflow stays inside content area | Covered by app shell/table baseline; screenshot attachment still recommended for Jira |
| 375x812 | `/inbound` | Admin | mobile drawer open/close | menu usable, content not hidden behind drawer | Covered by responsive shell baseline; screenshot attachment still recommended for Jira |
| 375x812 | `/errors/403` | limited role | direct blocked route | 403 guidance shows back/home action | Covered by `RequirePermission` and 403 page tests |
| 768x1024 | form/modal route | Admin | long label, validation error | label/error wrap without overlap | Covered by form wrapper and validation baseline tests |
| 1440x900 | audit logs | Admin | empty/loading/error/detail drawer | shared states render consistently | Covered by audit page/table/detail drawer implementation |

## RBAC Matrix

| Role | Menu visibility | Direct URL | Action visibility | API result | Expected UX |
| --- | --- | --- | --- | --- | --- |
| Super admin | visible | allowed | visible | 2xx | opens screen |
| Limited role with route permission | visible for allowed modules only | allowed for matching permission | allowed actions visible/disabled by scope | 2xx or scoped 403 | opens allowed screen, scoped denial explains action |
| Limited role without route permission | hidden | blocked by `RequirePermission` | hidden/disabled by `ActionButton`/`PermissionGuard` | 403 marked `_isNoPermission` | `/errors/403` guidance with back/home |
| No permission | hidden | blocked | hidden | 403 | no blank page, no redirect loop |

## Jira Comment Template

Implementation HEAD: `<HEAD_SHA>`
PR: `<PR_URL>`
CI run: `npm.cmd run lint` PASS; `npm.cmd run build` PASS; `npm.cmd run check:api-mapping` PASS; targeted shared component tests PASS
Playwright run: `npx.cmd playwright test` PASS, 4 passed / 1 skipped for missing QA credentials
Design token artifact: `docs/design-system/DESIGN_TOKENS.md`
Component inventory: `docs/design-system/COMPONENT_INVENTORY.md`
Responsive evidence: attach screenshots/report for 1440x900, 768x1024, 375x812
RBAC evidence: attach matrix above and test output
403 evidence: `RequirePermission.test.tsx`, `NoPermissionPage.tsx`, screenshot of `/errors/403`
Known limitations: Jira state/subtask transitions require project permission; full `npm.cmd run test` and `format:check` still expose pre-existing repository-level mock/format debt outside the new WWHN-29 changes
P0/P1 disposition: repo-side P0 evidence added; external Jira status/sign-off pending
Reviewer/sign-off: FE, QA, BA
