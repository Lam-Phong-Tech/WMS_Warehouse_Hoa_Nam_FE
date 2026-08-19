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
| FE292-P2-02 | P2 | Generic controlled suite used tablet 1024x768 while assessment requires 768x1024 | Dedicated WWHN-292 matrix uses exactly `1440x900`, `768x1024`, `375x812`, plus `1280x900` for the NFR-SRS-006 desktop minimum. | FE source closed; successful workflow evidence still required |
| FE292-P1-06 | P1 | Responsive evidence was described as shell/login but only `/login` was exercised; the authenticated shell was unproven | Added authenticated-shell responsive tests at `1440x900`, `1280x900`, `768x1024`, `375x812` asserting no horizontal overflow plus the wireframe shell contract (fixed 300px aside above 980px, stacked full-width aside at or below 980px). | FE source closed |
| FE292-P2-03 | P2 | Route fail-closed was proven on one sample route only | Added a 13-route direct-URL matrix for a role holding only `inventory.view` (403 + no-permission state + hidden menu entry) and a positive control proving `/inventory` stays reachable. | FE source closed |

## 3. FE-controlled evidence matrix

The dedicated suite `e2e/wwhn-292-ui-responsive-rbac.spec.ts` covers:

1. Login screen at `1440x900`, `768x1024`, `375x812` with a horizontal-overflow guard.
2. Authenticated application shell at `1440x900`, `1280x900`, `768x1024` and `375x812`. Each viewport asserts the primary navigation and screen heading render, that the page has no horizontal overflow, and that the shell honours the BA wireframe breakpoint: above `980px` the aside stays `position: fixed` at `300px` with a matching `300px` main offset; at or below `980px` the aside becomes `position: static`, full width, with no main offset. `1280x900` is included specifically as the NFR-SRS-006 desktop minimum.
3. Shared UI states: loading, empty, error/no-permission, API field errors, confirm and disabled state.
4. Limited-role menu filtering and direct protected URL -> `/errors/403`.
5. A 13-route direct-URL fail-closed matrix for a role holding only `inventory.view` (`/system/users`, `/master-data/skus`, `/master-data/catalog`, `/master-data/warehouse`, `/master-data/agencies`, `/master-data/defects`, `/inbound`, `/putaway`, `/outbound`, `/warranty`, `/reverse`, `/reports`, `/audit-logs`). Each route must land on `/errors/403`, render the explicit no-permission state and keep its navigation entry hidden.
6. A positive control proving the same limited role still reaches `/inventory`, so the guard is not over-blocking granted permissions.
7. Controlled login API `422` and retry-safe enabled state.
8. Evidence metadata: exact source SHA, environment, build version, browser project, role, route, viewport, timestamp and screenshot filename.

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

## 7. R2 closure (2026-08-19) — đối chiếu review 80/100

Review R2 chấm 80/100 với 4 mục OPEN (FE292-P1-01..04). Trạng thái lịch sử ở các mục trên
("FE SOURCE REMEDIATED / EXTERNAL UAT GATES PENDING") được giữ nguyên làm trace; trạng thái
hiện hành sau R2 nằm trong `WWHN-292_CLOSURE_REGISTER.json` và các evidence dưới đây.

| ID | Đóng bằng | Evidence |
| --- | --- | --- |
| FE292-P1-01 | Real defect register từng dòng, pin controlling source hiện hành (BRD v3.20 + SRS/FRD v1.12 + wireframe aligned v3.20/v1.12; BRD v3.9 = HISTORICAL/SUPERSEDED theo SRS L225), đủ 14 trường before → fix SHA/files → after → retest cho 6 defect thật của chuỗi review | `docs/evidence/wwhn-292/WWHN-292_DEFECT_REGISTER.json` |
| FE292-P1-02 | Candidate đóng băng + chạy đủ chuỗi gate fail-fast tại exact SHA ở LOCAL (GitHub Actions quota 3000/3000 đã cạn — cấm trigger CI); identity pack EXACT_GIT_SHA + LOCAL_RUN_ID + SHA256SUMS + RC_PIN; disposition CI ghi fail-closed, không claim GITHUB_RUN_ID nào | `docs/evidence/wwhn-292/final/` |
| FE292-P1-03 | QA2 retest matrix chạy thật tại exact candidate SHA: chromium, theo defect/role/viewport, 13-route deny + 2 positive control, screenshot/log đầy đủ; evidence class QA2_LOCAL_RETEST_NOT_UAT_ENV | `docs/evidence/wwhn-292/QA2_RETEST_MATRIX.md`, `docs/evidence/wwhn-292/qa2/<sha>/` |
| FE292-P1-04 | Raw direct-API bỏ qua UI trên BE runtime thật (BE SHA pin): 401 no-token, 403 permission-deny, data-scope disposition, positive control 200 — mỗi probe kèm raw request/response + request_id + env identity; QA1 chạy độc lập lượt 2 | `docs/evidence/wwhn-292/BE_AUTHZ_EVIDENCE_REF.md` → BE repo `docs/evidence/WWHN-292/BE_AUTHZ_EVIDENCE.md` |

Điều chỉnh ma trận RBAC trong R2: WWHN-242 xác lập REV-00 là màn ĐỌC (SRS §3 cấp V qua
`inventory.view`; BE mở `GET /reversal-documents` bằng `inventory.view`), nên `/reverse`
chuyển từ deny matrix sang positive control thứ 2; suất deny thay bằng IAM-02
`/system/roles`, ma trận giữ nguyên 13 route deny.

Residual duy nhất sau R2 là ENVIRONMENTAL: rerun đúng các matrix đã publish trên môi trường
DEV/UAT do DevOps dựng (WWHN-287/WWHN-293) — không còn hạng mục thiết kế/bằng chứng mới nào
thuộc FE. Không được trình bày local-execution evidence như UAT-environment evidence.
