# M3 Dependency List

Updated: 2026-08-01 ICT  
Scope: late-core and high-risk workflow dependencies for `WWHN-148`.

## Contract-Ready Rows

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Stock movements | src/modules/inventory/services/inventoryService.ts | Load movement detail | GET | `/stock-movements/{id}` | Present in local Swagger snapshot. |
| Stock movements | src/modules/inventory/services/inventoryService.ts | Trace source document | GET | `/stock-movements/{id}/trace-source` | Present in local Swagger snapshot. |
| Reports | src/modules/reports/services/reportsService.ts | Load inventory XNT | GET | `/reports/inventory-xnt` | Present in local Swagger snapshot. |
| Reports | src/modules/reports/services/reportsService.ts | Export inventory XNT | GET | `/reports/inventory-xnt/export-excel` | Present in local Swagger snapshot. |

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
| Reports hub | src/modules/reports/services/reportsService.ts | reports hub endpoint uses `/reports/hub` | BE1/BA | Not present in local Swagger snapshot; FE should keep XNT as the contract-ready report row. |
| Warranty defects report | src/modules/reports/services/reportsService.ts | warranty defects report endpoint uses `/reports/warranty-defects` | BE1/BA | Not present in local Swagger snapshot; endpoint/export permission needs sign-off. |
