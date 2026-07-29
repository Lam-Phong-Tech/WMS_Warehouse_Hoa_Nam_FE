# WWHN-29 Acceptance Evidence

Status: repo-side evidence refreshed for PL01-02, external Jira transition/sign-off pending
Date: 2026-07-29

## Traceability

| Jira | Evidence |
| --- | --- |
| Contract Item PL01-02 | UX design system, responsive app frame and RBAC navigation evidence |
| Epic Temp Key HN-EPIC-02 | Parent epic trace for WMS FE standardization |
| BA Pin HN-PIN-02 | BA baseline trace from `08_DATA_API_UI_TECHNICAL_HANDOFF`, `HoaNam_Handoff_v3_9`, BRD v3.9 |
| WWHN-12 | Specification input for Module 1 app shell and RBAC |
| WWHN-29 | Parent implementation acceptance package |
| HN-UX-001 | Parent Temp Key for FE reusable app frame and RBAC navigation |
| HN-UX-001-ST01 | Dependency baseline for design-system/component standardization |
| WWHN-144 | FE implementation: app shell, navigation, shared components, route/action guards, design-system docs |
| WWHN-145 | QA smoke: responsive viewport matrix, RBAC matrix, Playwright/unit/build results |

## Acceptance Criteria Matrix

| AC | Implementation/evidence | Result |
| --- | --- | --- |
| Design tokens/component inventory | `docs/design-system/DESIGN_TOKENS.md`, `docs/design-system/COMPONENT_INVENTORY.md`, `src/app/theme.ts`, `src/shared/design-tokens.ts` | Pass pending Jira attachment |
| Responsive app shell | App layout/components plus viewport checklist below | Pass pending screenshot artifacts |
| Menu by RBAC | `MENU` permission fields, `filterMenu`, `SideNav` tests, `access.test.ts` route/menu parity | Pass |
| Route guard and 403 handling | `RequirePermission`, `NoPermissionPage`, `NoPermissionState`, axios 403 marker, tests | Pass |
| Shared UI states | Component inventory shared-state table | Pass |
| Component reuse Wave 2-3 | form/table/scan/status/audit baseline in component inventory | Pass |
| Test/CI | lint/build/API mapping/targeted unit/Playwright results below | Pass with noted existing full-suite/mock debt |
| Review/traceability/sign-off | Jira comment template below | Pending external Jira update |

## HN-UX-001 FE1 Reusable Frame Update

Implementation date: 2026-07-29
Role: FE1 - Quang Nguyen Thanh
Output: Khung FE tai su dung

| Area | Evidence | Result |
| --- | --- | --- |
| Reusable app frame | `src/shared/components/layout/AppShell.tsx` now exposes reusable `sider`, `header`, `breadcrumb`, `footer`, content and body slots without business logic | Pass |
| App layout integration | `src/app/layouts/MainLayout.tsx` composes authenticated shell through `AppShell` while keeping profile loading, responsive drawer, preload and RBAC outside the shared component | Pass |
| Navigation metadata | `src/app/layouts/menu.tsx` remains the single source for sidebar, selected key, open keys and breadcrumb; profile route metadata added | Pass |
| RBAC route contract | `src/app/router/access.ts` explicitly marks `ROUTES.PROFILE` as authenticated/no extra permission; other WMS permissions unchanged | Pass |
| Disabled UI state | `src/app/layouts/AppHeader.tsx` notification button is disabled with tooltip because no approved backend notification endpoint exists | Pass |
| Test coverage | `src/app/layouts/SideNav.test.tsx`, `src/shared/components/shared-components.test.tsx` cover RBAC filtering, navigation metadata and `AppShell` slots | Pass |
| Contract mismatch | No API endpoint/payload changed. Notification remains disabled because backend contract is absent | Disposition: no FE blocker |

## PL01-02 Scope Lock

| Required output | Repo artifact | Notes |
| --- | --- | --- |
| Danh sach design token/component | `docs/design-system/DESIGN_TOKENS.md`, `docs/design-system/COMPONENT_INVENTORY.md` | Minimal shared token and component baseline for one FE; source of truth stays in `src/app/theme.ts` and `src/shared/design-tokens.ts` |
| Khung ung dung responsive | `src/shared/components/layout/AppShell.tsx`, `src/app/layouts/MainLayout.tsx`, `layout.styles.ts` | Desktop fixed sider; tablet/mobile drawer; stable content padding and page body |
| Evidence dieu huong theo RBAC | `src/app/router/access.ts`, `src/app/layouts/menu.tsx`, `src/app/router/access.test.ts`, `SideNav.test.tsx`, `RequirePermission.test.tsx` | Menu hide and direct route block share the same route permission map |
| Shared UI states | `Loading`, `PageSkeleton`, `EmptyState`, `ApiErrorAlert`, `NoPermissionState`, `ConfirmButton`, `confirmDialog`, `sonner` toaster | Loading, empty, error, confirm, success/toast, disabled and 403 baseline defined |
| Wave2-3 reuse baseline | `Form*`, `TableContainer`, `DataTable`, `ScanInput`, `StatusTag`, `AuditLogsTable`, `AuditLogDetailDrawer` | Form/table/scan/status/audit reuse path documented |

No endpoint, payload, validation rule, API error code, inventory mutation, CI/CD dependency, or business rule was changed for PL01-02.

## Validation Run

Local validation on 2026-07-28 plus HN-UX-001 FE1 refresh on 2026-07-29:

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run lint` | Pass | ESLint completed with exit code 0 |
| `npm.cmd run format:check` | Pass | All matched `src` files use Prettier style |
| `npm.cmd run build` | Pass | TypeScript and Vite production build completed |
| `npm.cmd run check:api-mapping` | Pass | 0 errors; 1 warning because WWHN-29 has no endpoint rows and Swagger has 288 routes |
| `npm.cmd run test -- src/shared/components/shared-components.test.tsx src/app/router/RequirePermission.test.tsx src/app/layouts/SideNav.test.tsx src/shared/components/permission/ActionButton.test.tsx src/shared/components/data-display/TableContainer.test.tsx` | Pass | 34 tests passed, covers shared states, ScanInput, route 403, SideNav RBAC, action guard and table baseline |
| `npm.cmd run test -- src/app/router/access.test.ts` | Pass | Locks PL01-02 WMS route permission matrix and menu/route parity |
| `npm.cmd run test -- src\app\layouts\SideNav.test.tsx src\shared\components\shared-components.test.tsx` | Pass | 11 tests passed on 2026-07-29; covers reusable frame slots, RBAC filtering, selected/open key and profile breadcrumb |
| `npm.cmd run lint` | Pass | Re-run on 2026-07-29 after FE reusable frame update |
| `npm.cmd run build` | Pass | Re-run on 2026-07-29 after `MainLayout` moved to `AppShell` composition |
| `npx.cmd playwright test` | Pass | 4 passed, 1 skipped; skipped test requires `QA_ADMIN_EMAIL`/`QA_ADMIN_PASSWORD` against real QA backend |
| `npm.cmd run test` | Existing fail | Re-run on 2026-07-29: 25 files passed / 5 failed; 245 passed / 28 failed. Failures remain in API/auth test harness suites (`shared/api/axios*`, `shared/api/http`, `ContextSwitcher`, `LoginPage`) outside the FE reusable frame update |

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
CI run: `npm.cmd run lint` PASS; `npm.cmd run format:check` PASS; `npm.cmd run build` PASS; `npm.cmd run check:api-mapping` PASS; targeted WWHN-29 component/RBAC tests PASS
Playwright run: `npx.cmd playwright test` PASS, 4 passed / 1 skipped for missing QA credentials
Design token artifact: `docs/design-system/DESIGN_TOKENS.md`
Component inventory: `docs/design-system/COMPONENT_INVENTORY.md`
Responsive evidence: attach screenshots/report for 1440x900, 768x1024, 375x812
RBAC evidence: attach matrix above and test output
403 evidence: `RequirePermission.test.tsx`, `NoPermissionPage.tsx`, screenshot of `/errors/403`
Known limitations: Jira state/subtask transitions require project permission; full `npm.cmd run test` still exposes repository-level mock/test-harness debt outside the targeted WWHN-29 acceptance slice
P0/P1 disposition: repo-side P0 evidence added; external Jira status/sign-off pending
Reviewer/sign-off: FE, QA, BA
