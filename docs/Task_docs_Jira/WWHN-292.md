# WWHN-292 — FE UI/responsive/RBAC remediation evidence

Date: 2026-08-18 (ICT)  
Branch: `m1` only  
Parent: `WWHN-78`  
Dependency chain: `HN-UAT-003` / `WWHN-76`, `WWHN-286`, `WWHN-287`, `WWHN-288`, `WWHN-293`

## 1. Scope and truth boundary

WWHN-292 owns FE fixes and FE-controlled evidence for UI, responsive layout, route/menu RBAC UX, API error states and regression checks. FE evidence must not be represented as an independent QA2 UAT retest or as proof of backend authorization.

At remediation start, the current `m1` HEAD was `b26c8ff95de83eaade5ec47b677b05044d4be56d`. The Jira assessment that referenced `99fae...` / CI `#488` is therefore historical and must not be reused as the identity of the final build. Final evidence must bind to the exact `GITHUB_SHA` of the successful WWHN-292 workflow run.

Observed external state during remediation:

- `WWHN-76` — Blocked/Pending; no UAT defect register attached.
- `WWHN-286` — Blocked/Pending; QA1 triage/retest pending.
- `WWHN-287` — Blocked/Pending; QA2 DEV/UAT retest pending.
- `WWHN-288` — Blocked/Pending; BA expected/waiver disposition pending.
- `WWHN-293` — Blocked/Pending; independent pair verification pending.
- `WWHN-20` — To Do; BA Pin is not a closed baseline gate.
- `WWHN-28`, `WWHN-140`, `WWHN-141`, `WWHN-142` — DONE REDFLAG at review time; this is not treated as an unconditional production/UAT approval.

Therefore cross-role acceptance remains fail-closed until those owners publish valid evidence. No FE document or automated test may manufacture those independent results.

## 2. Latest P0/P1/P2 remediation register

| ID | Sev | Finding | Root-cause / remediation | Current disposition |
| --- | --- | --- | --- | --- |
| FE292-P0 | P0 | No new FE-owned P0 in latest review | Keep fail-closed acceptance; do not promote external P1 gates to PASS. | No FE P0 identified |
| FE292-P1-01 | P1 | Missing real defect register from WWHN-78/HN-UAT-003 | Source UAT chain currently has no published defect rows. Closure requires per defect: module/route, account-role, viewport, env/build, expected, actual, severity, before evidence, fix SHA/files and after evidence. | **Blocked external — BA/QA + FE handoff** |
| FE292-P1-02 | P1 | Latest assessment bound to stale SHA/CI | A dedicated WWHN-292 workflow now verifies format, lint, typecheck, tests, build, task register and task-specific E2E on the exact runtime `GITHUB_SHA`. Never reuse CI `#488` as final evidence after HEAD changed. | FE control implemented; successful final run still required |
| FE292-P1-03 | P1 | WWHN-293 has no independent retest | QA2 must run exact deployed FE/BE build with browser, account/role and required viewport matrix. FE-controlled mock tests are only handoff evidence. | **Blocked external — QA2** |
| FE292-P1-04 | P1 | Evidence is controlled, not real DEV/UAT | Dedicated FE evidence captures immutable metadata but does not claim DEV/UAT. QA2 must attach real DEV/UAT before/after and direct API/backend-deny evidence where applicable. | **Blocked external — QA2/BE/DevOps** |
| FE292-P1-05 | P1 | Canonical task-specific artifact absent; tooling could fall back to WWHN-156 | Added this document, `docs/evidence/wwhn-292/WWHN-292_CLOSURE_REGISTER.json`, task verifier and dedicated WWHN-292 E2E/workflow. | FE source closed |
| FE292-P2-01 | P2 | Invalid/stale branch URL or SHA references can recur | Canonical branch is `m1`; workflow artifact writes exact `GITHUB_SHA`, run ID/attempt and SHA256 sums. Jira final comment must use those generated identities only. | FE control implemented |
| FE292-P2-02 | P2 | Generic controlled suite used tablet 1024x768 while assessment requires 768x1024 | Dedicated WWHN-292 matrix uses exactly `1440x900`, `768x1024`, `375x812`. | FE source closed; successful workflow evidence still required |

## 3. FE-controlled evidence matrix

The dedicated suite `e2e/wwhn-292-ui-responsive-rbac.spec.ts` covers:

1. Responsive shell/login at `1440x900`, `768x1024`, `375x812`, including horizontal-overflow guard.
2. Shared UI states: loading, empty, error/no-permission, API field errors, confirm and disabled state.
3. Limited-role menu filtering and direct protected URL -> `/errors/403`.
4. Controlled login API `422` and retry-safe enabled state.
5. Evidence metadata: exact source SHA, environment, build version, browser project, role, route, viewport, timestamp and screenshot filename.

Controlled mocks validate FE behavior only. They do not prove that a deployed backend returns 403, enforces warehouse/data scope, or that a named UAT account possesses the intended permission set.

## 4. Backend boundary review

BE `m1` is the authoritative authorization boundary. Current source uses `auth:api` and `permission:*` middleware on protected business routes, with dedicated warehouse/data-scope middleware on inventory/outbound routes. WWHN-292 therefore does not add duplicate client-side authorization as a substitute for BE enforcement.

Independent backend evidence still required before UAT closure:

- named account/role/warehouse scope;
- raw direct API request with UI bypassed;
- 401/403 result and request ID for unauthorized/forbidden cases;
- data-scope denial where applicable;
- exact BE SHA and deployed environment identity.

## 5. Final verification commands

Run against the exact FE SHA under review:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run wwhn-292:verify
npm run build
npm run test:e2e:wwhn-292
```

The dedicated GitHub Actions workflow performs the same fail-fast gates and uploads an immutable artifact named from the exact commit SHA.

## 6. Required external closure before final PASS

Final WWHN-292 acceptance must remain **FE SOURCE REMEDIATED / EXTERNAL UAT GATES PENDING** until all of the following exist on the same deployment identity:

- QA/BA-owned real UAT defect register or an explicit independently approved zero-defect disposition;
- QA2 independent browser/role/viewport retest on real DEV/UAT;
- backend direct-API authorization/data-scope evidence where the scenario depends on permission enforcement;
- exact FE SHA, BE SHA, build/environment identity and immutable evidence links;
- disposition of remaining P0/P1 defects and parent/dependency gates.

Do not claim 100% project/UAT acceptance from FE-controlled evidence alone.
