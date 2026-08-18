# M1 API Mapping Evidence — WWHN-148

Cập nhật: 2026-08-04 ICT  
Phạm vi: `WWHN-148` / `HN-UX-002` — evidence ánh xạ FE cho khả năng triển khai, tái sử dụng, RBAC và API error.

## Ranh giới thẩm quyền

Tài liệu này là evidence do FE sở hữu, không thay thế phê duyệt contract độc lập từ BE1/BE2, BA/BAS hoặc QA2. Endpoint constants là đường dẫn tương đối so với `VITE_API_BASE_URL`. Vì base URL chuẩn kết thúc bằng `/api/v1`, `SCAN_BATCHES_CLASSIFY = "/scan/classify"` tạo runtime URL đúng là `POST /api/v1/scan/classify`; thêm `/api/v1` vào constant sẽ gây double prefix.

Final sign-off của `WWHN-148` vẫn fail-closed cho đến khi `WWHN-146`, `WWHN-147`, `WWHN-149` và bộ contract/permission/sample data của BE có evidence độc lập.

## Critical flow mappings

| Flow | FE service | Method | Endpoint constant path | Effective runtime path | Permission | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Scan classify | `scanService.ts` | POST | `/scan/classify` | `/api/v1/scan/classify` | `scan.classify` | FE implemented; BE1 + BA + QA2 sign-off pending. |
| Post receipt | `receivingService.ts` | POST | `/inbound-documents/{id}/post-receipt` | `/api/v1/inbound-documents/{id}/post-receipt` | `inbound.post` | FE enforces `Idempotency-Key`, `If-Match` and success evidence; BE sign-off pending. |
| Post issue | `shippingService.ts` | POST | `/outbound-documents/{id}/post-issue` | `/api/v1/outbound-documents/{id}/post-issue` | `outbound.post` | FE enforces `Idempotency-Key`, `If-Match` and success evidence; BE sign-off pending. |
| Apply adjustment | `stocktakeService.ts` | POST | `/stocktake/sessions/{sessionId}/apply-adjustment` | `/api/v1/stocktake/sessions/{sessionId}/apply-adjustment` | `stocktake.adjust` | Action-level permission; blocked until BE registers canonical stocktake session routes (2026-08-13 dev snapshot: route absent). |

## Warranty & Component Issue mappings (luồng 04)

| Flow | FE service | Method | Endpoint constant path | Effective runtime path | Permission | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Warranty list (WAR-01) | `warrantyService.ts` | GET | `/warranty-cases` | `/api/v1/warranty-cases` | `warranty.manage` | Implemented; BE route present in dev Swagger snapshot 2026-08-13. |
| Warranty intake (WAR-02) | `warrantyService.ts` | POST | `/warranty-cases` | `/api/v1/warranty-cases` | `warranty.manage` (+`warranty.temp_only` for TEMP_ONLY) | FE enforces `Idempotency-Key` and `stock_effect=NONE`. |
| Warranty detail (WAR-03) | `warrantyService.ts` | GET | `/warranty-cases/{id}` | `/api/v1/warranty-cases/{id}` | `warranty.manage` | Implemented; ETag/version surfaced for CAS. |
| Warranty update (WAR-03) | `warrantyService.ts` | PATCH | `/warranty-cases/{id}` | `/api/v1/warranty-cases/{id}` | `warranty.manage` | FE sends `If-Match` + persists confirmed_defect / received_condition / accessories_received / cancel_reason. |
| Warranty events | `warrantyService.ts` | GET | `/warranty-cases/{id}/events` | `/api/v1/warranty-cases/{id}/events` | `warranty.manage` | Implemented; ERD event taxonomy. |
| Attachments list | `warrantyService.ts` | GET | `/warranty-cases/{id}/attachments` | `/api/v1/warranty-cases/{id}/attachments` | `warranty.manage` | Implemented (WAR-P1-01 closed at BE dev SHA). |
| Attachments upload | `warrantyService.ts` | POST | `/warranty-cases/{id}/attachments` | `/api/v1/warranty-cases/{id}/attachments` | `warranty.manage` | Multipart upload, `stock_effect=NONE`. |
| Attachment download | `warrantyService.ts` | GET | `/warranty-attachments/{id}/download` | `/api/v1/warranty-attachments/{id}/download` | `warranty.manage` | Implemented. |
| Attachment delete | `warrantyService.ts` | DELETE | `/warranty-attachments/{id}` | `/api/v1/warranty-attachments/{id}` | `warranty.manage` | Logical delete. |
| Component issues list | `componentIssueService.ts` | GET | `/warranty-component-issues` | `/api/v1/warranty-component-issues` | `warranty.component_issue` | Supports `warranty_case_id` filter. |
| Component issue create | `componentIssueService.ts` | POST | `/warranty-component-issues` | `/api/v1/warranty-component-issues` | `warranty.component_issue` | FE forces `purpose=WARRANTY`; DRAFT stock-neutral. |
| Component issue detail | `componentIssueService.ts` | GET | `/warranty-component-issues/{id}` | `/api/v1/warranty-component-issues/{id}` | `warranty.component_issue` | WAR-P0-01 closed: BE GET detail route present at dev SHA. |
| Component issue scan | `componentIssueService.ts` | POST | `/warranty-component-issues/{id}/scans` | `/api/v1/warranty-component-issues/{id}/scans` | `warranty.component_issue` | `If-Match` CAS; scan stock-neutral. |
| Component issue cancel | `componentIssueService.ts` | POST | `/warranty-component-issues/{id}/cancel` | `/api/v1/warranty-component-issues/{id}/cancel` | `warranty.component_issue` | Reason required. |
| Component issue post | `componentIssueService.ts` | POST | `/warranty-component-issues/{id}/post` | `/api/v1/warranty-component-issues/{id}/post` | `warranty.component_issue` | Full-post; `Idempotency-Key`; FE asserts `stock_effect=DECREASE` + `movement_ids`. |

## Dashboard and reports disposition

| Screen/action | Method | Path | FE runtime behavior | Canonical disposition |
| --- | --- | --- | --- | --- |
| Dashboard quick KPI | GET | `/reports/dashboard-quick` | Not wired to any page (`dashboardService.ts`/`DashboardKPI` unreferenced by `DashboardPage.tsx`) | WWHN-328: field set corrected 2026-08-18 to match BE `OperationalReportController::dashboardQuick` exactly (`period/available_qty/receipt_qty/issue_qty/component_issue_qty/reversal_net/warranty_cases_by_status/reconciliation_warnings`); OpenAPI locked same SHA. Independent BA/QA2/Tech Lead sign-off still pending — see WWHN-328 comment thread. |
| Inventory XNT | GET | `/reports/inventory-xnt` | Active | Mapping implemented; independent BE approval pending. |
| Export XNT | GET | `/reports/inventory-xnt/export-excel` | Active and action-gated by `report.export` | Mapping implemented; independent BE approval pending. |
| Reports hub | GET | `/reports/hub` | Fail-closed before network | Blocked until BE1/BE2 + BA publish canonical contract disposition. |
| Warranty defects report | GET | `/reports/warranty-defects` | Active | Mapping implemented; BE route + PII-mask + export audit present at dev SHA (Swagger snapshot 2026-08-13). |

WWHN-328 scan finding (out of this ticket's BE scope, flagged for BA/PM/FE1 disposition — not fixed here): `dashboardService.ts` also defines `fetchRecentDocuments()` / `fetchReconcileHealth()` / `fetchAlerts()` against `DASHBOARD_RECONCILE_HEALTH = "/inventory-snapshots"` and `DASHBOARD_ALERTS = "/safe-stock-alerts"`. Neither route exists anywhere in `WMS_Warehouse_Hoa_Nam_BE` (`Modules/Warehouse/routes/api.php`); both would 404 if ever called. All three functions are currently unreferenced dead code, so this does not fail any runtime path today. Building those two endpoints requires BA-approved formulas/thresholds first (same class of decision as DEV328-P1-01) — no code change made against them in this pass.

## RBAC mapping

Route permission is a page-entry UX gate only. Backend authorization remains the authority for HTTP 403 and data scope.

| Area | Route-entry permission | Sensitive action permission |
| --- | --- | --- |
| Scan | `inventory.trace` OR `scan.classify` | `scan.inbound`, `scan.outbound`, or `scan.warranty` by context |
| Stocktake | `stocktake.count` | `stocktake.adjust` for apply adjustment |
| Warranty | `warranty.manage` | `warranty.temp_only` for TEMP_ONLY creation |
| Reports | `report.view` | `report.export` for export |

Legacy permission names are normalized only through the explicit alias catalog. Broad permissions such as `stocktake.manage` are not silently promoted to `stocktake.adjust`.

## Error and idempotency evidence boundary

| Scenario | FE guard/evidence | Independent evidence still required |
| --- | --- | --- |
| 403 | Route/action guards, backend-error rendering and controlled browser role scenario | Direct backend 403 sample by BE/RBAC + QA2 |
| 409 | Shared API error parser and conflict-safe UI contract | Canonical module-specific 409 payload/sample from BE1/BE2 |
| 422 | Field-error extraction plus controlled browser 422 retry-safe state | Canonical field pointers/copy from BE + BA |
| Idempotency | Critical mutations require `Idempotency-Key`; tests assert headers and complete success evidence | Replay/conflict sample against named backend build |

## Evidence commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run env:verify
npm run uat:p0p1:verify
npm run master-sku:verify
npm run wms-contract:verify
npm run wwhn-148:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:evidence
```

CI packages source SHA, execution SHA, build/env metadata, screenshots, video and traces into the WMS closure artifact. That artifact proves FE-owned checks only; it does not self-sign BAS/BA/BE/QA evidence.
