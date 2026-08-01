# M1 API Mapping Evidence

Updated: 2026-08-01 ICT  
Scope: FE readiness mapping for core WMS screens used by `WWHN-148`.

This file is intentionally contract-facing: endpoint rows below must exist in
`swagger-api.json` and be consumed through src/shared/api/endpoints.ts plus the
module service layer. FE route/action permissions remain UX gates; BE remains
the authority for RBAC and data scope.

## Dashboard And Inventory

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Dashboard | src/modules/dashboard/services/dashboardService.ts | Load KPI cards | GET | `/reports/dashboard-quick` | Present in local Swagger snapshot. |
| Dashboard | src/modules/dashboard/services/dashboardService.ts | Load recent document status | GET | `/document-status-history` | Present in local Swagger snapshot. |
| Dashboard | src/modules/dashboard/services/dashboardService.ts | Load reconcile health | GET | `/inventory-snapshots` | Present in local Swagger snapshot. |
| Dashboard | src/modules/dashboard/services/dashboardService.ts | Load safe stock alerts | GET | `/safe-stock-alerts` | Present in local Swagger snapshot. |
| Inventory | src/modules/inventory/services/inventoryService.ts | Load inventory balances | GET | `/inventory/balances` | Present in local Swagger snapshot. |
| Inventory | src/modules/inventory/services/inventoryService.ts | Load stock movements | GET | `/stock-movements` | Present in local Swagger snapshot. |
| Inventory | src/modules/inventory/services/inventoryService.ts | Open stock movement detail | GET | `/stock-movements/{id}` | Present in local Swagger snapshot. |
| Inventory | src/modules/inventory/services/inventoryService.ts | Trace movement source | GET | `/stock-movements/{id}/trace-source` | Present in local Swagger snapshot. |

## Master Data SKU/Product

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Master Data | src/modules/master-data/services/master-data.service.ts | List products/SKU baseline | GET | `/products` | Canonical replacement for legacy `/skus`. |
| Master Data | src/modules/master-data/services/master-data.service.ts | Create product | POST | `/products` | Present in local Swagger snapshot. |
| Master Data | src/modules/master-data/services/master-data.service.ts | Update product | PUT | `/products/{id}` | FE currently uses status/enable/disable paths for status actions. |
| Master Data | src/modules/master-data/services/master-data.service.ts | Disable product | PATCH | `/products/{id}/disable` | Present in local Swagger snapshot. |
| Master Data | src/modules/master-data/services/master-data.service.ts | Enable product | PATCH | `/products/{id}/enable` | Present in local Swagger snapshot. |
| Master Data | src/modules/master-data/services/master-data.service.ts | Update product status fallback | PATCH | `/products/{id}/status` | Present in local Swagger snapshot. |
| Master Data | src/modules/master-data/services/master-data.service.ts | List product categories | GET | `/product-categories` | Present in local Swagger snapshot. |
| Master Data | src/modules/master-data/services/master-data.service.ts | Create product category | POST | `/product-categories` | Present in local Swagger snapshot. |
| Master Data | src/modules/master-data/services/master-data.service.ts | List UOMs | GET | `/uoms` | Present in local Swagger snapshot. |
| Master Data | src/modules/master-data/services/master-data.service.ts | List suppliers | GET | `/suppliers` | Present in local Swagger snapshot. |

## Inbound Receiving

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Receiving | src/modules/receiving/services/receivingService.ts | List inbound documents | GET | `/inbound-documents` | Present in local Swagger snapshot. |
| Receiving | src/modules/receiving/services/receivingService.ts | Create inbound document | POST | `/inbound-documents` | Present in local Swagger snapshot. |
| Receiving | src/modules/receiving/services/receivingService.ts | Open inbound detail | GET | `/inbound-documents/{id}` | Present in local Swagger snapshot. |
| Receiving | src/modules/receiving/services/receivingService.ts | Update inbound document | PATCH | `/inbound-documents/{id}` | Present in local Swagger snapshot. |
| Receiving | src/modules/receiving/services/receivingService.ts | Submit inbound document | POST | `/inbound-documents/{id}/submit` | Present in local Swagger snapshot. |
| Receiving | src/modules/receiving/services/receivingService.ts | Approve inbound document | POST | `/inbound-documents/{id}/approve` | Present in local Swagger snapshot. |
| Receiving | src/modules/receiving/services/receivingService.ts | Post receipt | POST | `/inbound-documents/{id}/post-receipt` | Present in local Swagger snapshot; risky mutation must keep confirm/idempotency evidence. |
| Receiving | src/modules/receiving/services/receivingService.ts | Reject inbound document | POST | `/inbound-documents/{id}/reject` | Present in local Swagger snapshot. |
| Receiving | src/modules/receiving/services/receivingService.ts | Cancel inbound document | POST | `/inbound-documents/{id}/cancel` | Present in local Swagger snapshot. |

## Outbound Shipping

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Shipping | src/modules/shipping/services/shippingService.ts | List outbound documents | GET | `/outbound-documents` | Present in local Swagger snapshot. |
| Shipping | src/modules/shipping/services/shippingService.ts | Create outbound document | POST | `/outbound-documents` | Present in local Swagger snapshot. |
| Shipping | src/modules/shipping/services/shippingService.ts | Open outbound detail | GET | `/outbound-documents/{id}` | Present in local Swagger snapshot. |
| Shipping | src/modules/shipping/services/shippingService.ts | Update outbound document | PATCH | `/outbound-documents/{id}` | Present in local Swagger snapshot. |
| Shipping | src/modules/shipping/services/shippingService.ts | Submit outbound document | POST | `/outbound-documents/{id}/submit` | Present in local Swagger snapshot. |
| Shipping | src/modules/shipping/services/shippingService.ts | Approve outbound document | POST | `/outbound-documents/{id}/approve` | Present in local Swagger snapshot. |
| Shipping | src/modules/shipping/services/shippingService.ts | Post issue | POST | `/outbound-documents/{id}/post-issue` | Present in local Swagger snapshot; risky mutation must keep confirm/idempotency evidence. |
| Shipping | src/modules/shipping/services/shippingService.ts | Reject outbound document | POST | `/outbound-documents/{id}/reject` | Present in local Swagger snapshot. |
| Shipping | src/modules/shipping/services/shippingService.ts | Cancel outbound document | POST | `/outbound-documents/{id}/cancel` | Present in local Swagger snapshot. |

## Reports

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Reports | src/modules/reports/services/reportsService.ts | Load inventory XNT report | GET | `/reports/inventory-xnt` | Present in local Swagger snapshot. |
| Reports | src/modules/reports/services/reportsService.ts | Export inventory XNT Excel | GET | `/reports/inventory-xnt/export-excel` | Present in local Swagger snapshot. |

## Known Mismatch / Conditional Contract Items

| Area | FE source | Endpoint constant or behavior | Disposition |
| --- | --- | --- | --- |
| Inbound scan | `receivingService.ts` | inbound scan endpoint uses `/inbound-documents/:id/scan` | Not present in local Swagger snapshot; BE sample needed before production sign-off. |
| Inbound close remainder | `receivingService.ts` | inbound close remainder endpoint uses `/inbound-documents/:id/close-remainder` | Not present in local Swagger snapshot; keep as conditional. |
| Inbound reverse | `receivingService.ts` | inbound reverse endpoint uses `/inbound-documents/:id/reverse` | Not present in local Swagger snapshot; keep as conditional. |
| Outbound scan | `shippingService.ts` | outbound scan endpoint uses `/outbound-documents/:id/scan` | Not present in local Swagger snapshot; BE sample needed. |
| Outbound close remainder | `shippingService.ts` | outbound close remainder endpoint uses `/outbound-documents/:id/close-remainder` | Not present in local Swagger snapshot; keep as conditional. |
| Outbound reverse | `shippingService.ts` | outbound reverse endpoint uses `/outbound-documents/:id/reverse` | Not present in local Swagger snapshot; keep as conditional. |
| Legacy SKU/import | endpoint constants | Legacy sku/import constants retained for reference only | Do not use for production until BE adds/locks these paths. |
