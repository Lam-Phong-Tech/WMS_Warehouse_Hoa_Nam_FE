# M3 Dependency List

Updated: 2026-08-01 ICT  
Scope: late-core and high-risk workflow dependencies for `WWHN-148`.

## Contract-Ready Rows

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Inventory (WWHN-211) | src/modules/inventory/services/inventoryService.ts | List inventory balances | GET | `/inventory/balances` | Present in local Swagger snapshot (tag "07. Inventory"); FE `fetchInventoryBalances`, covered by `inventoryService.test.ts`. |
| Inventory (WWHN-211) | src/modules/inventory/services/inventoryService.ts | Load balance item/container subledger | GET | `/inventory/balances/{id}/subledger` | Present in local Swagger snapshot; FE `fetchBalanceSubledger`, covered by `inventoryService.test.ts` and `BalanceDetailModal.test.tsx`. |
| Stock movements | src/modules/inventory/services/inventoryService.ts | List stock movements | GET | `/stock-movements` | Present in local Swagger snapshot; FE `fetchStockMovements`, covered by `inventoryService.test.ts`. |
| Stock movements | src/modules/inventory/services/inventoryService.ts | Load movement detail | GET | `/stock-movements/{id}` | Present in local Swagger snapshot. |
| Stock movements | src/modules/inventory/services/inventoryService.ts | Trace source document | GET | `/stock-movements/{id}/trace-source` | Present in local Swagger snapshot. |
| Inventory trace (WWHN-211) | src/modules/inventory/services/inventoryService.ts | Trace by physical code (item/container/SKU) | GET | `/stock-movements/trace-by-code` | Present in local Swagger snapshot (tag "07. Inventory", permission `inventory.trace`); resolves `resolved_type` ITEM/CONTAINER/SKU per BE `StockMovementController::traceByPhysicalCode` — not a SKU-only approximation. FE `traceByPhysicalCode`, covered by `inventoryService.test.ts` and `TraceModal.test.tsx`. |
| Reports | src/shared/api/endpoints.ts (`REPORTS_XNT`) | Load inventory XNT | GET | `/reports/inventory-xnt` | Present in local Swagger snapshot. Hằng số vẫn giữ; màn hình báo cáo đang chạy (`AlignedReportsPage.tsx`) dùng biến thể `/reports/inventory-xnt-enhanced` theo §13.10. |
| Reports | src/shared/api/endpoints.ts (`REPORTS_XNT_EXPORT_EXCEL`) | Export inventory XNT | GET | `/reports/inventory-xnt/export-excel` | Present in local Swagger snapshot. Tương tự trên: đường export đang dùng là `/reports/inventory-xnt-enhanced/export-excel`. |

## Known Mismatch / High-Risk Workflow Dependencies

| Area | FE source | Endpoint constant or behavior | Owner | Disposition |
| --- | --- | --- | --- | --- |
| Stocktake sessions | src/modules/stocktake/services/stocktakeService.ts | stocktake sessions endpoint uses `/stocktake/sessions` | BE1/BA | Not present in local Swagger snapshot; FE list/state exists but final pass needs contract. |
| Stocktake count | src/modules/stocktake/services/stocktakeService.ts | stocktake count endpoint uses `/stocktake/sessions/:sessionId/count` | BE1/BA | Not present in local Swagger snapshot; payload, validation, and sample 422 required. |
| Stocktake apply adjustment | src/modules/stocktake/services/stocktakeService.ts | stocktake apply adjustment endpoint uses `/stocktake/sessions/:sessionId/apply-adjustment` | BE1/BA | Not present in local Swagger snapshot; risky mutation requires confirm, idempotency, 409/422 samples. |
| Stocktake variance | src/modules/stocktake/services/stocktakeService.ts | Uses `/stocktake/sessions/{sessionId}/variance` inline | BE1/BA | Not present in local Swagger snapshot; should become a shared endpoint constant when contract is locked. |
| Warranty cases | src/modules/warranty/services/warrantyService.ts | warranty cases endpoint uses `/warranty/cases` | BE1/BA | Not present in local Swagger snapshot; status enum and PII/export rules remain conditional. |
| Warranty events | src/modules/warranty/services/warrantyService.ts | warranty case events endpoint uses `/warranty/cases/:caseId/events` | BE1/BA | Not present in local Swagger snapshot; needs sample timeline response. |
| Warranty status | src/modules/warranty/services/warrantyService.ts | warranty update status endpoint uses `/warranty/cases/:id/status` | BE1/BA | Not present in local Swagger snapshot; risky status transition needs final status catalog. |
| Reversal documents | src/modules/reverse/services/reversalService.ts | reversal documents endpoint uses `/reversal-documents` | BE1/BA | Not present in local Swagger snapshot; reversible quantity/conflict/audit response needed. |
| Reversal lines | src/modules/reverse/services/reversalService.ts | Uses `/reversal-documents/{id}/lines` inline | BE1/BA | Not present in local Swagger snapshot; should become a shared endpoint constant when contract is locked. |
| Reports hub | src/shared/api/endpoints.ts (`REPORTS_HUB`) | reports hub endpoint uses `/reports/hub` | BE1/BA | Hằng số còn khai báo nhưng chưa màn hình nào tiêu thụ sau khi gộp về `AlignedReportsPage.tsx`; route BE `GET reports/hub` (permission `report.view`) đã có. |
| Warranty defects report | src/modules/reports/pages/AlignedReportsPage.tsx | warranty defects report endpoint uses `/reports/warranty-defects` | BE1/BA | Đã nối: trang báo cáo gọi `REPORTS_WARRANTY_DEFECTS` + bản export, guard `EXPORT_REPORT` phía FE và `report.export` phía BE. |
