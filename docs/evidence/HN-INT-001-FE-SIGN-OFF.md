# HN-INT-001 - FE Sign-off

## Traceability

| Field | Value |
| --- | --- |
| Parent Task | WWHN-40 - [G1] Ra soat contract FE/BE/QA va cong kiem soat payload mau |
| Parent Temp Key | HN-INT-001 |
| Epic Temp Key | HN-EPIC-03 |
| Dependency | HN-INT-001-ST01 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Owner FE | Quang Nguyen Thanh |
| Output | FE sign-off |
| Review date | 2026-07-29 |
| Baseline source | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`; `docs/WMS_FRONTEND_STANDARDIZATION.md`; `docs/api-evidence/*.md`; current FE implementation |

## Review Objective

FE1 reviewed endpoint mapping, request/response payload handling, error display,
UI states, RBAC gates, and contract traceability for the current React/Vite/TypeScript
Web Admin baseline. This sign-off does not approve backend business rules that
are missing from HN-INT-001-ST01, and it does not silently change any endpoint,
payload, enum, or API error contract.

## Baseline Rules Applied

| Rule from technical guide | FE verification standard |
| --- | --- |
| FE must consume approved API contract from Postman/Jira/OpenAPI | Services must call `src/shared/api/http.ts` and `src/shared/api/endpoints.ts`; mismatches are recorded as blockers instead of being patched locally. |
| Backend owns RBAC, data scope, inventory mutation, transaction, lock, and idempotency | FE route/action guards are UX only; FE must not calculate inventory changes, bypass scope, or infer post/apply/reverse behavior. |
| API response envelope must preserve `success`, `message`, `data`, `meta`, `error_code`, and `errors` | Shared API layer must unwrap success and preserve business errors/field errors for UI rendering. |
| Scan UI must expose waiting/scanned/duplicate/unknown/invalid/success/error states | Existing scan UI may be used as visual evidence only until `POST /scan-batches/classify` payload/error contract is delivered. |
| Done requires evidence and no unresolved P0/P1 blocker without disposition | Every P0/P1 item below has owner and disposition; FE sign-off is conditional where dependency input is missing. |

## Executive Result

| Area | Result | Evidence / disposition |
| --- | --- | --- |
| API envelope and error bridge | Verified | `src/shared/api/http.ts`, `src/shared/api/api-error.ts`, `src/shared/types/api-response.ts`; tests cover flat `error_code`, nested `error.code`, field `errors`, and API envelope errors. |
| FE endpoint constants and services | Partially verified | Implemented services use shared endpoint constants, but several WMS paths lack approved dependency evidence or differ from the technical guide naming. |
| Payload field handling | Partially verified | Master Data SKU sends backend-style payload through `SkuPayload`; generic field-error extraction supports snake_case and raw field names. Workflow payloads for inbound/outbound/stocktake/reverse are not approved yet. |
| UI states | Foundation verified; module integration conditional | Shared loading, empty, error, success, disabled, confirm, no-permission components exist. Mock WMS pages are not production integration evidence. |
| RBAC | UX guard verified; catalog confirmation required | `src/app/router/access.ts`, `RequirePermission`, menu filtering, and permission tests cover FE gates; backend/runtime permission catalog for WMS-specific codes is still required. |
| Contract mismatch handling | Verified as process | Mismatches are documented below with owners/ETA; no unilateral API contract change was made by FE1. |

## Endpoint, Payload, and Error Mapping

| Module / UI surface | Current FE mapping | Baseline / expected contract | Payload / error handling reviewed | FE result |
| --- | --- | --- | --- | --- |
| Auth/session | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/refresh`, `/auth/switch-context`, `/auth/change-password` | Existing foundation contract | Login/change-password hooks use shared API; axios interceptor handles 401 refresh and 403 classification; password-change 403 remains distinct from no-permission. | Pass in current FE scope. |
| App shell / 403 UX | Route guard and menu RBAC only | FE UX guard; BE remains authority | Direct route block redirects to no-permission state and carries required permission list. | Pass with BE authority caveat. |
| API envelope | All services should use `http` wrapper | Success envelope `{ success, message, data, meta }`; error envelope `{ success:false, message, error_code, errors }` | `ApiEnvelopeError`, `getApiErrorMessage`, `extractFieldErrors`, `extractFieldErrorsRaw`, `normalizeError`, request-id extraction. | Pass. |
| Dashboard | `GET /dashboard/kpi`, `/dashboard/recent-documents`, `/dashboard/reconcile-health`, `/dashboard/alerts` | Technical guide lists report/dashboard style APIs; prior evidence mentions `/reports/dashboard-quick` as possible approved route | No mutation payload. Query error/empty rendering should be explicit when canonical endpoint is confirmed. | P1 mismatch pending BE1/BA disposition. |
| Master Data - SKU | `GET/POST /skus`, `PATCH /skus/:id`, `POST /skus/import-excel` | Guide suggests `/skus`; final OpenAPI/Jira field spec still required | `SkuPayload` sends contract-named fields; create/status/import show mutation errors and status confirmation. Import result displays backend result without deciding rollback/partial-write rule. | Conditional pass; P1 dependency remains for official fields/enums/import response. |
| Master Data - Item | `GET /items` | Guide suggests `/items`; dependency evidence not sufficient for final field list | List only; no local business rule inference found. | Conditional; BE1/BA must confirm fields/filter/pagination. |
| Physical Codes / Scan | `GET /physical-codes`; active scan page has mock classify results | Guide expects `POST /scan-batches/classify` with duplicate/unknown/source states | Shared parser can display error_code/field errors; scan state machine not integrated to approved endpoint yet. | P0 blocker for production-integrated scan. |
| Inbound | Service uses `/inbound/documents`, `/inbound/documents/:id`, `/lines`; active `InboundPage` uses mock data | Guide expects `/inbound-documents`, `/scan`, `/post-receipt`; Post Receipt requires idempotency, backend transaction, no FE inventory mutation | No approved post-receipt payload/error/idempotency contract in current FE evidence. | P0 blocker; do not mark integrated Done. |
| Outbound | Service uses `/outbound/documents`, `/outbound/documents/:id/lines`; active `OutboundPage` uses mock data | Guide expects `/outbound-documents`, `/scan`, `/post-issue`; backend prevents negative stock | FE must display backend insufficient-stock error, not compute final stock locally. Contract not present. | P0 blocker; do not mark integrated Done. |
| Inventory | Active page uses mock balances/movements; no concrete service bound | Guide expects balances and movement audit; reports must reconcile movement | No approved filters/status/pagination/movement error contract. | P1 blocker. |
| Stocktake | Active page uses mock sessions/count lines | Guide expects session snapshot, count, variance, apply adjustment | Apply Adjustment requires backend idempotency and error codes; not approved. | P1 blocker. |
| Warranty | Active page uses mock data | Guide expects `POST /warranty-cases`, `PATCH /status`, TEMP_ONLY support | TEMP_ONLY rules, defect/status enum, and validation errors not confirmed. | P1 blocker. |
| Reverse | Active page uses mock data | Guide expects backend reverse transaction/audit with reference | No endpoint/payload/idempotency/error code confirmed. | P1 blocker. |
| Reports | Service uses `/reports` and `/reports/xnt` | Guide expects `/reports/xnt`; prior evidence mentions `/reports/inventory-xnt` and export endpoint alternatives | Export behavior and error payload for queued export not confirmed. | P1 mismatch pending BE1/BA. |
| Audit logs | `GET /audit-logs` through `http.getPage` | Existing endpoint evidence | Unit tests verify pagination params and no stray query string. | Pass. |

## UI State and RBAC Evidence

| Acceptance point | FE evidence | Result |
| --- | --- | --- |
| Loading | `PageSkeleton`, route lazy fallback, `Loading`, query loading in integrated pages | Pass at foundation; module pages must use query loading when real APIs are wired. |
| Empty | `EmptyState`, `TableContainer`, component catalog baseline | Pass at component level; module-specific copy remains per BA when contracts are final. |
| Error | `ApiErrorAlert`, `ErrorState`, `ErrorBoundary`, shared API parser | Pass at foundation; dashboard/workflow pages need explicit API error surfaces during integration. |
| Success | Ant Design App provider, toast integration, mutation success invalidation in Master Data | Pass for existing mutations. |
| Disabled | `ActionButton`, pending/loading disabled states, disabled notification button where endpoint is absent | Pass; destructive workflow buttons must remain disabled/absent until contract is approved. |
| Confirm | `ConfirmButton`, `ConfirmDialog`, SKU status confirm | Pass pattern; required for post/apply/reverse once endpoints are approved. |
| Permission/RBAC | `ROUTE_PERMISSIONS`, `RequirePermission`, `PermissionGuard`, `NoPermissionState`, menu filtering | Pass as FE UX; BE2/RBAC owner must confirm WMS permission catalog. |
| Responsive | Shared app shell, drawer/sidebar layout, table/container foundation | Pass at foundation; final screenshots per module required after real API integration. |

## WMS Route Permission Review

| Route | Current FE permission gate | FE disposition |
| --- | --- | --- |
| Dashboard | Authenticated user | Confirm with BA/BE whether dashboard requires role-specific visibility. |
| Master Data | `sku.manage` OR `master.manage` | Needs backend permission catalog confirmation. |
| Scan | `inventory.trace` OR `scan.classify` | Needs backend permission catalog confirmation. |
| Inbound | `inbound.create` OR `inbound.post` | Needs backend permission catalog confirmation. |
| Putaway | `putaway.manage` | Scope open; confirm whether putaway belongs to HN-INT-001. |
| Outbound | `outbound.create` OR `outbound.post` | Needs backend permission catalog confirmation. |
| Inventory | `inventory.view` | Needs backend permission catalog confirmation. |
| Stocktake | `stocktake.count` | Needs backend permission catalog confirmation. |
| Warranty | `warranty.manage` | Needs backend permission catalog confirmation. |
| Reverse | `inventory.reversal.post` | Needs backend permission catalog confirmation. |
| Reports | `report.view` | Needs backend permission catalog confirmation. |
| Audit logs | `AUDIT_LOG_VIEW` | Existing catalog evidence; no FE blocker. |

## Blockers, Owners, and Disposition

| ID | Severity | Blocker | Owner | ETA / disposition |
| --- | --- | --- | --- | --- |
| FE-SO-001 | P0 | HN-INT-001-ST01 does not provide approved scan classify endpoint/payload/error-code sample for production integration. | BE1 + BA/BAS | Provide `POST /scan-batches/classify` or approved equivalent, request/response samples, duplicate/unknown/invalid error codes before FE integration Done. |
| FE-SO-002 | P0 | Inbound/outbound active pages use mock data and endpoint naming is not confirmed against approved contract. | BE1 + BA/BAS; FE1 after sign-off | Confirm canonical paths, workflow actions, idempotency key location/header/body, validation and RBAC before FE wiring. |
| FE-SO-003 | P1 | Dashboard/report endpoint variants are not reconciled across FE constants, guide, and prior evidence. | BE1 + BA/BAS | Confirm dashboard quick vs split endpoints and report XNT/export route names before FE final sign-off. |
| FE-SO-004 | P1 | WMS permission codes in FE route guards are not confirmed against runtime `/permissions` or OpenAPI/Jira catalog. | BE2/RBAC owner | Provide permission catalog and scope rules; FE1 updates `ROUTE_PERMISSIONS` and evidence. |
| FE-SO-005 | P1 | Inventory movement, stocktake apply-adjustment, warranty TEMP_ONLY/status, and reverse contracts are absent from current FE evidence. | BE1/BE2 + BA/BAS | Provide endpoint, payload, enum, validation, error code, sample data, and permission contract. |
| FE-SO-006 | P2 | Module-level responsive screenshots and API error screenshots are incomplete for mock-only pages. | FE1 + QA after contract delivery | Capture after real API wiring; current foundation evidence is acceptable only for shared UI. |

## Acceptance Criteria Mapping

| Acceptance Criteria | FE sign-off result |
| --- | --- |
| Output "FE sign-off" reviewed/verified and attached to HN-INT-001; no FE1 blocker remains | This file is the FE sign-off artifact. FE-owned foundation items are verified; contract dependencies above remain with owners/disposition. |
| UI follows business rules, field specification, responsive, and state handling | Shared UI baseline passes. Production module sign-off is conditional on receiving approved field specs and replacing mock pages with real API/query states. |
| Permission/RBAC and API error display correctly; no hard-code contrary to contract | API/RBAC foundation passes. Mock WMS data is explicitly marked non-production evidence and must not be treated as integrated contract fulfillment. |
| Integrated approved endpoint/payload; lint/build/test pass | Approved auth/audit/foundation paths pass. WMS workflow endpoint/payload integration is blocked until HN-INT-001-ST01 provides final contracts. |
| BA/QA has evidence; no P0/P1 blocker without disposition | Evidence and blocker table above provide BA/QA traceability; all P0/P1 blockers have owner and disposition. |

## FE Decision Log

- FE1 did not rename endpoint constants or modify services during this review because the task forbids unilateral API contract changes.
- FE1 treats mock WMS pages as UI prototype/evidence only, not production integration evidence.
- FE1 will wire scan/post/apply/reverse mutations only after BE provides endpoint, payload, validation, idempotency, error-code, permission, and sample-data contracts.
- FE1 will update component/build documentation only where implementation changes occur; this review adds traceability evidence without changing runtime behavior.

## Verification Log

Commands to execute for final FE sign-off evidence in this workspace:

```text
npm.cmd run lint
npm.cmd run build
npm.cmd run test -- src/shared/api/api-error.test.ts src/shared/types/api-response.test.ts src/shared/api/http.test.ts src/app/router/access.test.ts src/app/router/RequirePermission.test.tsx src/shared/components/permission/ActionButton.test.tsx src/modules/audit-logs/services/audit-logs.service.test.ts
npm.cmd run check:api-mapping -- --no-live
```

| Command | Result | Evidence |
| --- | --- | --- |
| `npm.cmd run lint` | Pass | ESLint completed with no reported errors. |
| `npm.cmd run build` | Pass | `tsc -b` and Vite production build completed. |
| Targeted tests above | Pass | 7 test files, 54 tests passed; covers API error payload bridge, envelope, RBAC route/action guard, audit endpoint pagination. |
| `npm.cmd run check:api-mapping -- --no-live` | Pass with warning | 0 errors; 1 warning because `docs/api-evidence` currently has 0 endpoint rows while swagger snapshot has 288 unique routes. This remains traceability debt owned by contract/evidence completion, not a runtime FE failure. |

## Final FE Sign-off Position

FE1 can sign off the shared FE foundation for error parsing, RBAC UX gates,
state components, and current approved auth/audit-style integrations.

FE1 cannot honestly sign off production integration for scan, inbound, outbound,
inventory movement, stocktake apply adjustment, warranty, reverse, dashboard, or
reports until HN-INT-001-ST01 supplies the approved endpoint/payload/validation/
error-code/permission/sample-data contracts listed above. These are recorded as
contract blockers with owners, so they are not hidden FE blockers.
