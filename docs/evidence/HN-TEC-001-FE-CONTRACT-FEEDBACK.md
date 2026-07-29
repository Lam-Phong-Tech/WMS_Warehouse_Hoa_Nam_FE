# HN-TEC-001 - FE Contract Feedback

## Traceability

| Field | Value |
| --- | --- |
| Parent Task | WWHN-31 - [TECH] Kien truc, ERD, Tu dien du lieu va OpenAPI v1 |
| Parent Temp Key | HN-TEC-001 |
| Epic Temp Key | HN-EPIC-03 |
| Dependency | HN-TEC-001-ST01 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Owner FE | Quang Nguyen Thanh |
| Output | FE contract feedback |
| Review date | 2026-07-29 |
| Baseline source | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`; `swagger-api.json`; `docs/WMS_FRONTEND_STANDARDIZATION.md`; current FE implementation |

## Review Scope

FE1 reviewed the contract/UI surface against the technical baseline:

- React/Vite/TypeScript Web Admin must consume approved API contracts through the shared API layer.
- UI must cover loading, empty, error, success, disabled, confirm, and permission denied states where applicable.
- Route/action RBAC in FE is only a UX gate; backend remains the authority for permission and data scope.
- FE must not hard-code production data or infer inventory/business rules outside the contract.
- Contract mismatch must be raised with owner/ETA instead of silently changing the UI or API path.

## Executive Status

| Area | FE status | Disposition |
| --- | --- | --- |
| Shared API envelope/error handling | Verified | `src/shared/api/http.ts`, `src/shared/api/axios.ts`, and `ApiEnvelopeError` preserve `message`, `error_code`, field `errors`, pagination `meta`, 403 classification, and request context. |
| Route-level RBAC | Verified with caveat | `src/app/router/access.ts` maps WMS routes to permission codes as UX guard only. Backend permission catalog for WMS codes still needs BE confirmation. |
| Master Data UI/API | Partially integrated | SKU/item/physical-code list and SKU create/status/import use shared services. Needs OpenAPI confirmation because `swagger-api.json` snapshot does not expose `/skus`, `/items`, `/physical-codes`. |
| Dashboard UI/API | Contract mismatch | FE calls `/dashboard/kpi`, `/dashboard/recent-documents`, `/dashboard/reconcile-health`, `/dashboard/alerts`; OpenAPI snapshot exposes `/reports/dashboard-quick`. Needs BE/BA disposition. |
| Inbound/Outbound UI/API | Contract mismatch and mock UI | FE constants/services use `/inbound/documents` and `/outbound/documents`, while OpenAPI exposes `/inbound-documents` and `/outbound-documents` plus workflow actions. Current route pages use mock data. |
| Inventory/Stocktake/Warranty/Reverse/Scan/Reports/Putaway | Not production-integrated | Several pages are visual/mock surfaces. They should stay blocked from Done as "integrated UI" until approved endpoint, payload, validation, RBAC, and sample data are delivered. |

## Contract Mapping Review

| UI/module | Current FE evidence | OpenAPI / baseline expectation | Status | Required disposition |
| --- | --- | --- | --- | --- |
| App shell, protected route, 403 UX | `src/app/router/index.tsx`; `src/app/router/access.ts`; `NoPermissionPage` | FE route guard allowed as UX aid; BE enforces RBAC/data scope | OK | No blocker for FE foundation. |
| API envelope and field errors | `src/shared/api/http.ts`; `src/shared/api/api-error.ts`; `src/shared/types/api-response.ts` | Standard success/error envelope with `success`, `message`, `data`, `meta`, `error_code`, `errors` | OK | Keep all services on `http`; do not bypass axios wrapper. |
| Dashboard | `src/modules/dashboard/services/dashboardService.ts`; endpoints in `src/shared/api/endpoints.ts` | OpenAPI snapshot has `GET /reports/dashboard-quick`, not FE's four `/dashboard/*` endpoints | P1 mismatch | BE1/BA confirm whether Dashboard contract is split endpoints or quick report endpoint. ETA: before FE integration Done. |
| Master Data - SKU | `getSkus`, `createSku`, `updateSkuStatus`, `importSkus` in `master-data.service.ts` | Guide suggests `GET/POST /skus`; OpenAPI snapshot does not include `/skus` | P1 dependency | BE1 to provide approved OpenAPI route/payload/status enum/import response. FE should not rename fields until confirmed. |
| Master Data - Item | `getItems` calls `/items` | Guide suggests `/items`; OpenAPI snapshot only shows price-list item routes, not master item list | P1 dependency | BE1/BA confirm Item endpoint and fields. |
| Master Data - Physical Code | `getPhysicalCodes` calls `/physical-codes` | Guide suggests `/physical-codes`; OpenAPI snapshot does not expose it | P1 dependency | BE1 confirm code list/classify endpoint, duplicate/unknown fields, and permission code. |
| Scan classify | `PhysicalCodesPage.tsx` uses `mockPhysicalCodes` and `mockScanResults` | Guide expects `POST /scan-batches/classify` and states waiting/scanned/duplicate/unknown/invalid/success/error | P0 blocker for integrated scan | BE1 provide endpoint/payload/error codes. FE1 wire real state machine after contract sign-off. |
| Inbound list/detail/lines | FE service exists under `src/modules/receiving`, but active route `src/modules/inbound/pages/InboundPage.tsx` uses `mockInboundDocs/mockInboundLines`; endpoints are `/inbound/documents` | OpenAPI exposes `/inbound-documents`, `/{id}`, submit/approve/post-receipt/reject/cancel | P0 blocker for integrated inbound | BE1/BA decide path naming and workflow payloads; FE1 must replace mock page with service/query only after approval. |
| Inbound post receipt | No FE mutation wired in active page | Baseline requires idempotent post receipt, transaction, no local stock mutation | P0 dependency | BE1 provide `idempotency_key` contract and error codes; FE1 show confirm/loading/success/error only, no inventory calculation in FE. |
| Outbound list/detail/lines | FE service exists under `src/modules/shipping`, but active route `src/modules/outbound/pages/OutboundPage.tsx` uses `mockOutboundDocs/mockOutboundLines`; endpoints are `/outbound/documents` | OpenAPI exposes `/outbound-documents`, `/{id}`, submit/approve/post-issue/reject/cancel | P0 blocker for integrated outbound | BE1/BA decide path naming and workflow payloads; FE1 wire real API after sign-off. |
| Outbound post issue | No FE mutation wired in active page | Baseline requires backend lock/recheck to prevent negative stock | P0 dependency | FE must display backend `WMS_INSUFFICIENT_STOCK` or equivalent; must not calculate final inventory locally. |
| Putaway | Service calls `/putaway/tasks`, `/putaway/history`; active page uses mock data | Guide architecture mentions putaway only indirectly; OpenAPI snapshot has no putaway routes | P2/open scope | BA/BE confirm whether putaway is in WWHN-31 scope. Keep as demo until contract exists. |
| Inventory balance/movement | `InventoryPage.tsx` uses `mockInventory/mockMovements`; no service bound | OpenAPI exposes `/inventory/balances`; guide also expects inventory movements | P1 blocker | BE1 confirm movement endpoint, filters, pagination, reconcile status fields. |
| Stocktake | `StocktakePage.tsx` uses `mockStocktakeSessions/mockCountLines` | Guide expects sessions/count/apply-adjustment, snapshot + variance | P1 blocker | BE1/BA provide endpoint, status enum, variance payload, apply-adjustment idempotency/error codes. |
| Warranty | `WarrantyPage.tsx` uses mock data | Guide expects `POST /warranty-cases`, `PATCH /status`, TEMP_ONLY support | P1 blocker | BE1/BA provide status enum, defect codes, TEMP_ONLY field rules, permission. |
| Reverse | `ReversalPage.tsx` uses mock data | Guide says reverse changes inventory through backend transaction/audit | P1 blocker | BE1 provide reverse endpoint, reference document rules, idempotency, error codes. |
| Reports | Service calls `/reports` and `/reports/xnt`; active page uses mock reports | OpenAPI exposes `/reports/inventory-xnt`, `/reports/inventory-xnt/export-excel`, `/reports/revenue` | P1 mismatch | BE1/BA align report hub vs inventory-xnt paths and export behavior. |
| Audit logs | `audit-logs.service.ts` uses `http.getPage('/audit-logs')` | OpenAPI exposes `/audit-logs` | OK | Keep pagination meta behavior; already covered by unit test. |

## UI State Review

| State requirement | Current evidence | FE conclusion |
| --- | --- | --- |
| Loading | Route lazy fallback uses `PageSkeleton`; Master Data table uses query loading; shared `Loading`/`PageSkeleton` exists | Foundation OK; mock pages need query loading when real API is wired. |
| Empty | Shared `EmptyState`; Ant Design `Table` empty defaults; component catalog demonstrates empty state | OK at component level; module-specific empty copy should be added during API integration. |
| Error | Shared `ErrorState`, `ApiErrorAlert`, `ErrorBoundary`, API error parser | OK at foundation; Dashboard currently lacks explicit query error rendering and should add it with real contract. |
| Success | Toast/App provider and mutation success invalidation exist in Master Data | OK where mutations exist; workflow actions need success messages after endpoint approval. |
| Disabled | Shared `ActionButton` supports hide/disable by permission/scope; Master Data action buttons disable while pending/loading | OK pattern; mock pages must not expose enabled destructive workflow actions before contract. |
| Confirm | Shared `ConfirmButton`/`ConfirmDialog`; Master Data status change uses confirm | OK for current mutation; post/apply/reverse actions must use confirm after contract approval. |
| Permission denied | `RequirePermission`, menu filtering, `NoPermissionPage`, `NoPermissionState`, axios 403 classification | OK as FE UX; backend remains authority. |
| Scan states | `PhysicalCodesPage` visually shows duplicate/unknown/invalid/success-like states through mocks | Not Done for integration; must bind to `POST /scan-batches/classify` or approved equivalent. |

## RBAC Review

Current FE route permissions:

| Route | FE permission gate | Status |
| --- | --- | --- |
| Dashboard | Authenticated user | Needs BA/BE confirmation if dashboard has role restrictions. |
| Master Data | `sku.manage` OR `master.manage` | Needs BE permission catalog confirmation. |
| Scan | `inventory.trace` OR `scan.classify` | Needs BE permission catalog confirmation. |
| Inbound | `inbound.create` OR `inbound.post` | Needs BE permission catalog confirmation. |
| Putaway | `putaway.manage` | Needs BE permission catalog confirmation or scope removal. |
| Outbound | `outbound.create` OR `outbound.post` | Needs BE permission catalog confirmation. |
| Inventory | `inventory.view` | Needs BE permission catalog confirmation. |
| Stocktake | `stocktake.count` | Needs BE permission catalog confirmation. |
| Warranty | `warranty.manage` | Needs BE permission catalog confirmation. |
| Reverse | `inventory.reversal.post` | Needs BE permission catalog confirmation. |
| Reports | `report.view` | Needs BE permission catalog confirmation. |
| Audit logs | `AUDIT_LOG_VIEW` | Existing catalog evidence from prior task; OK. |

Disposition: FE route guards are acceptable for UX, but WMS permission codes above cannot be considered contract-verified until BE returns them from `/permissions` or includes them in OpenAPI/Jira field specification.

## Blockers and Owners

| ID | Severity | Blocker | Owner | ETA / Disposition |
| --- | --- | --- | --- | --- |
| FE-CF-001 | P0 | Active inbound/outbound/scan workflow pages use mock data and are not wired to approved workflow endpoints/payloads. | BE1 + BA/BAS for contract; FE1 after sign-off | Before marking WWHN-31 FE integration Done. |
| FE-CF-002 | P1 | Endpoint path mismatch: FE constants use `/inbound/documents`, `/outbound/documents`, `/reports/xnt`, `/dashboard/*`; OpenAPI snapshot uses `/inbound-documents`, `/outbound-documents`, `/reports/inventory-xnt`, `/reports/dashboard-quick`. | BE1 + BA/BAS | Confirm canonical OpenAPI v1 paths; FE1 will update constants/services only after disposition. |
| FE-CF-003 | P1 | WMS permission codes in route guards are not confirmed against runtime permission catalog in current evidence. | BE2/RBAC owner | Provide catalog or Jira field spec; FE1 updates mapping/evidence. |
| FE-CF-004 | P1 | Inventory movement, stocktake apply adjustment, warranty, reverse, and report export contracts are missing or not represented in current FE services. | BE1/BE2 + BA/BAS | Provide endpoint, payload, validation, error code, sample data. |
| FE-CF-005 | P2 | Dashboard query error/empty states should be rendered explicitly once final contract is chosen. | FE1 | Same PR as dashboard contract integration. |

## Acceptance Criteria Mapping

| Acceptance Criteria | Review result |
| --- | --- |
| Output "FE contract feedback" reviewed/verified and attached to HN-TEC-001 | This file is the FE contract feedback artifact for HN-TEC-001. |
| UI follows business rules, field specification, responsive, and handles states | Shared foundation supports required states; current integrated Master Data partially complies; mock WMS pages remain blocked until contracts are approved. |
| Permission/RBAC and API error displayed correctly | Foundation verified; WMS route permission codes need BE catalog confirmation. |
| No hard-coded data/rules contrary to contract | Hard-coded mock data exists in active WMS pages; classified as blocker and must not be treated as production integration. |
| Integrated approved endpoint/payload; lint/build/test pass | Endpoint integration is partial; mismatches listed above. Lint/build/test passed for current branch. |
| BA/QA has evidence; no P0/P1 blocker without disposition | All identified P0/P1 blockers have owner and disposition above. |

## FE Decision Log

- FE1 did not change API paths to match `swagger-api.json` in this review because the task explicitly forbids unilateral API contract changes.
- FE1 did not remove mock pages because they may serve as visual/UX evidence, but they are marked as not production-integrated.
- FE1 treats React/Vite/TypeScript as the approved baseline per the technical guide; no Next.js migration is required for this task.
- FE1 will only wire post/apply/reverse mutations after BE provides idempotency, validation, error-code, and permission contracts.

## Verification Log

Executed on 2026-07-29 in `C:\ERP_HOA_NAM\Hoa_Nam_Tools`:

```text
npm.cmd run lint
Result: PASS

npm.cmd run build
Result: PASS - tsc -b and vite build completed

npm.cmd run test
Result: PASS - 32 test files, 276 tests

npm.cmd run check:api-mapping -- --no-live
Result: PASS with warning - mapping docs currently expose 0 endpoint rows while `swagger-api.json` has 288 unique routes; endpoint-level mapping evidence is incomplete and must be completed before closing contract traceability.
```

Because this task is primarily a contract review artifact and current blockers are contract-level, passing lint/build/test alone does not close FE-CF-001 through FE-CF-004.
