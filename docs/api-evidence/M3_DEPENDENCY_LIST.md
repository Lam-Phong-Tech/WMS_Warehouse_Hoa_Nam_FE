# M3 Dependency List

Updated: 2026-08-18 ICT  
Scope: late-core and high-risk workflow dependencies reconciled against the current `m1` MVP implementation for `WWHN-296`.

## Contract-Ready Rows

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Inventory (WWHN-211) | src/modules/inventory/services/inventoryService.ts | List inventory balances | GET | `/inventory/balances` | Present in current BE `m1`; protected by `inventory.view` + warehouse data scope. |
| Inventory (WWHN-211) | src/modules/inventory/services/inventoryService.ts | Load balance item/container subledger | GET | `/inventory/balances/{id}/subledger` | Present in current BE `m1`; same permission/data-scope boundary. |
| Stock movements | src/modules/inventory/services/inventoryService.ts | List stock movements | GET | `/stock-movements` | Present in current BE `m1`. |
| Stock movements | src/modules/inventory/services/inventoryService.ts | Load movement detail | GET | `/stock-movements/{id}` | Present in current BE `m1`. |
| Stock movements | src/modules/inventory/services/inventoryService.ts | Trace source document | GET | `/stock-movements/{id}/trace-source` | Present in current BE `m1`; protected by `inventory.trace` + warehouse scope. |
| Inventory trace (WWHN-211) | src/modules/inventory/services/inventoryService.ts | Trace by physical code (item/container/SKU) | GET | `/stock-movements/trace-by-code` | Present in current BE `m1`; resolves ITEM/CONTAINER/SKU and enforces `inventory.trace`. |
| Reports | src/shared/api/endpoints.ts (`REPORTS_XNT`) | Load inventory XNT | GET | `/reports/inventory-xnt` | Present in current BE `m1`; active enhanced screen may use `/reports/inventory-xnt-enhanced`. |
| Reports | src/shared/api/endpoints.ts (`REPORTS_XNT_EXPORT_EXCEL`) | Export inventory XNT | GET | `/reports/inventory-xnt/export-excel` | Present in current BE `m1`; export requires `report.export`. |
| Reports hub | src/shared/api/endpoints.ts (`REPORTS_HUB`) | Load report hub | GET | `/reports/hub` | Present in current BE `m1`; no longer a missing-contract item. |
| Warranty defects report | src/modules/reports/pages/AlignedReportsPage.tsx | Warranty defect report | GET | `/reports/warranty-defects` | Present in current BE `m1`; read uses `report.view`, export uses `report.export`. |
| Reversal documents | src/modules/reverse/services/reversalService.ts | List/create reversal | GET | `/reversal-documents` | Present in current BE `m1`; correction after Post is append-only reversal, not direct stock edit. |
| Reversal lines | src/modules/reverse/services/reversalService.ts | Read reversal lines | GET | `/reversal-documents/{id}/lines` | Present in current BE `m1`. |
| Warranty cases | src/modules/warranty/services/warrantyService.ts | List warranty cases | GET | `/warranty-cases` | Present in current BE `m1`; canonical path is `/warranty-cases`, not legacy `/warranty/cases`. |
| Warranty events | src/modules/warranty/services/warrantyService.ts | Case timeline | GET | `/warranty-cases/{id}/events` | Present in current BE `m1`. |
| Warranty status | src/modules/warranty/services/warrantyService.ts | Transition/update case status | POST | `/warranty-cases/{id}/status` | Present in current BE `m1`; mutation remains permission guarded. |

## Current implementation boundary: Stocktake (formal governance pending)

Current FE/BE runtime intentionally has no Stocktake Session, Snapshot, Count, Variance Adjustment, `stocktake.*` permission or direct stock-edit route. Historical `/stocktake*` dependency rows are therefore not represented as active runtime dependencies.

This implementation disposition is traced to **WWHN-25 / DEC-STK-001**:

- BA comment `14791`: `NO-GO FOR MVP/BETA / DEFERRED-LATER PHASE`;
- BA comment `15251`: formal Process Owner/Client + PM/PO confirmation requested;
- formal approver/current-hash/effective-date evidence remains pending.

`DEC-NO-STOCKTAKE-001` must not be cited as an approved Decision ID. Current no-Stocktake behavior is an implementation/source-consistency state, while formal governance remains fail-closed and pending. Machine-readable status is stored at `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json`.

Any reintroduction requires approved Later Phase/Change Request/current Decision and synchronized FE/BE/OpenAPI/permission/test updates.

## High-risk rules retained

- Inbound/Outbound posting is full-document only; no partial posting.
- Stock changes occur only at approved posting/reversal boundaries.
- Reversal is append-only correction; no generic inventory UPDATE/DELETE path.
- Warranty intake/updates and component issue remain permission-guarded and stock-neutral until the
  explicit component Post operation.
- Report export remains a separate permission from report view.
- FE route/action guards are defense-in-depth; direct API 403/data-scope authority remains BE-owned.

## External evidence boundary

This file proves source-level alignment only. WWHN-296 cannot self-sign formal Stocktake governance,
production domain/SSL, actual PROD `VITE_API_BASE_URL`, CORS origin allow-list, cookie attributes,
deployment cache policy, rollback execution, or QA1 runtime results. Those require approver/DevOps/QA
evidence on the same exact build/environment identity.
