# M2 Dependency List

Updated: 2026-08-01 ICT  
Scope: dependency and contract evidence that supports `WWHN-148` beyond the
M1 happy-path mapping.

## Safe Stock

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Inventory | src/modules/inventory/services/inventoryService.ts | Load safe stock alerts | GET | `/safe-stock-alerts` | Blocked until BE registers canonical safe-stock routes (2026-08-13 dev snapshot: route absent). |
| Inventory | src/modules/inventory/services/inventoryService.ts | Load safe stock history | GET | `/safe-stock-alerts/history` | Blocked until BE registers canonical safe-stock routes (2026-08-13 dev snapshot: route absent). |

**WWHN-211 scope note (DEV211-P2-01):** `fetchSafeStockAlerts`, `fetchSafeStockConfigs`,
`createSafeStockConfig` and the scan-batch helpers (`fetchScanBatches`, `createScanBatch`,
`fetchScanEvents`) exist in `inventoryService.ts` but are not called by any inventory
component/page (`InventoryPage.tsx`, `BalanceDetailModal.tsx`, `TraceModal.tsx`). Scan batch
functionality is otherwise owned by `src/modules/scan/services/scanService.ts` (see "Known
Mismatch" below), so the `inventoryService.ts` scan helpers duplicate responsibility rather than
extend it. These functions are orphaned/unused code as of this review and were never in scope for
WWHN-211's list/detail/trace deliverable. Disposition needed from BA: (a) delete the unused
functions, or (b) confirm a future ticket that will wire Safe-stock alerts/config UI and retire
the duplicate scan helpers in favor of `scanService.ts`. Owner: BA + DEV (FE1).

## Audit Logs

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Audit Logs | src/modules/audit-logs/services/audit-logs.service.ts | List audit logs with pagination/filter | GET | `/audit-logs` | Present in local Swagger snapshot and covered by targeted service test. |

## Known Mismatch / Dependency Items

| Area | FE source | Endpoint constant or behavior | Owner | Disposition |
| --- | --- | --- | --- | --- |
| Scan classify | src/modules/scan/services/scanService.ts | scan classify endpoint uses `/scan-batches/classify` | BE1/BE2 | Not present in local Swagger snapshot; FE state machine exists but final pass needs duplicate/unknown/invalid samples. |
| Scan batches | src/modules/scan/services/scanService.ts | scan batches endpoint uses `/scan/batches` | BE1/BE2 | Not present in local Swagger snapshot; route must be locked or FE endpoint adjusted. |
| Scan events | src/modules/scan/services/scanService.ts | scan events endpoint uses `/scan/events` | BE1/BE2 | Not present in local Swagger snapshot; needed for history/evidence. |
| Physical codes | src/modules/scan/services/scanService.ts | physical codes endpoint uses legacy `/physical-codes` | BE1/BA | Not present in current local Swagger snapshot; treat as non-production until canonical contract is provided. |
| Putaway tasks | src/modules/putaway/services/putawayService.ts | putaway tasks endpoint uses `/putaway/tasks` | BE1/BA | Not present in local Swagger snapshot; business rule and permission still conditional. |
| Putaway history | src/modules/putaway/services/putawayService.ts | putaway history endpoint uses `/putaway/history` | BE1/BA | Not present in local Swagger snapshot; needs sample data and action rule confirmation. |
| Safe stock config | src/modules/inventory/services/inventoryService.ts | safe stock configs endpoint uses `/safe-stock-configs` | BE1/BA | Not present in local Swagger snapshot; UI must remain conditional if enabled. |
