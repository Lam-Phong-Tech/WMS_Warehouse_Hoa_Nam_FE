# M2 Dependency List

Updated: 2026-08-18 ICT  
Scope: dependency and contract evidence supporting current `m1` runtime/build verification for `WWHN-296` and `WWHN-148`.

## Safe Stock

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Inventory | src/modules/inventory/services/inventoryService.ts | Load safe stock alerts | GET | `/safe-stock-alerts` | **Fail-closed pending contract** — current BE `m1` does not register a canonical safe-stock route; do not wire this orphan helper into production UI. |
| Inventory | src/modules/inventory/services/inventoryService.ts | Load safe stock history | GET | `/safe-stock-alerts/history` | **Fail-closed pending contract** — current BE `m1` does not register this route. |

**WWHN-211/WWHN-296 scope note:** `fetchSafeStockAlerts`, `fetchSafeStockConfigs`,
`createSafeStockConfig` and duplicate scan-batch helpers in `inventoryService.ts` are not a
production contract by themselves. Safe-stock calls remain fail-closed until BA/BE publish a
canonical route/formula/permission contract. Scan batch ownership remains in
`src/modules/scan/services/scanService.ts`.

## Audit Logs

| Screen | FE service/source | UI action | Method | Path | Contract disposition |
| --- | --- | --- | --- | --- | --- |
| Audit Logs | src/modules/audit-logs/services/audit-logs.service.ts | List audit logs with pagination/filter | GET | `/audit-logs` | Contract-ready; endpoint remains part of the authenticated API surface and is covered by FE service tests. |

## Runtime dependency reconciliation — 2026-08-18

| Area | FE source | Method | Path | Owner | Current disposition |
| --- | --- | --- | --- | --- | --- |
| Scan classify | `src/modules/scan/services/scanService.ts` | POST | `/scan/classify` | FE1 + BE1 | **Canonical.** FE constant and `ScanController` OpenAPI both use `/api/v1/scan/classify`. WWHN-296 restores this authenticated BE runtime alias while retaining `/scan-batches/classify` only for backward compatibility. |
| Scan batches | `src/modules/scan/services/scanService.ts` | GET | `/scan/batches` | FE1 + BE1 | **Contract-ready.** Current BE `m1` registers the route via `WmsContractController::scanBatches`. |
| Scan events | `src/modules/scan/services/scanService.ts` | GET | `/scan/events` | FE1 + BE1 | **Contract-ready.** Current BE `m1` registers the route via `WmsContractController::scanEvents`. |
| Physical codes | `src/shared/api/endpoints.ts` | GET | `/physical-codes` | FE1 + BE1 | **Contract-ready.** Current BE `m1` registers list/detail plus controlled create/update permissions. `fetchPhysicalCodes()` itself remains fail-closed until its response mapping is formally consumed. |
| Putaway tasks | `src/modules/putaway/services/putawayService.ts` | GET | `/putaway-tasks` | FE1 + BE1 | **Canonical.** Current FE uses `/putaway-tasks`; BE keeps both canonical `/putaway-tasks` and legacy `/putaway/tasks`. |
| Putaway history | `src/modules/putaway/services/putawayService.ts` | GET | `/putaway/history` | FE1 + BE1 | **Contract-ready.** Current BE route exists and FE asserts stock-neutral response semantics. |
| Safe stock config | `src/modules/inventory/services/inventoryService.ts` | GET | `/safe-stock-configs` | BA + BE1 + FE1 | **Fail-closed pending contract.** No current BE route; helper must not be activated until route, payload, permission and formula are approved. |

## Boundary

This register records observable FE/BE `m1` contract alignment. It does not replace independent
DevOps production-domain/CORS/cookie evidence, BE sign-off, QA runtime execution, or BA Go/No-Go.
Production-only values must be injected by deployment configuration and must not be invented or
hard-coded into this repository.
