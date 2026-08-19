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

## Removed-from-MVP boundary: Stocktake (rule anchored to REQ-SRS-037)

Historical `/stocktake*` dependency rows are not represented as active runtime dependencies.

Current runtime intentionally has no Stocktake Session/Snapshot/Count, variance-adjustment endpoint, `stocktake.*` permission, menu or production flow. Corrections after Post use Reversal append-only (`DEC-REV-001` / WWHN-26); there is no direct stock-edit path.

### Authority for the rule (FE296-P1-01)

The guard is anchored to the approved requirement baseline, not to a standalone Decision ID:

| Anchor | Artifact | Content |
| --- | --- | --- |
| Controlling requirement | `docs/HN_SRS_FRD_v1.12_FULL.md` (HN-SRS-FRD-001 v1.12, SHA-256 `02cd010cdc40036b62ec23a0d3aa645e4cce813497edf8b0e851ba6fcb512ff2`) | `REQ-SRS-037` — **Must** — "Không expose Stocktake/Variance, menu/API/permission/entity/report hoặc action sửa tồn trực tiếp"; AC-SRS-037 / TC-SRS-037 / BR-NOSTK-01..03. |
| Baseline adoption | `WWHN-334` — status `DONE REDFLAG`, resolution `Done` (observed 18/08/2026) | SRS §0.1 defines the effective date as the WWHN-334 transition to DONE. Open review points OP-01/OP-05/OP-09 do not concern Stocktake. |
| Data baseline | `docs/HoaNam_ERD_Moi_Nhat.md` (SHA-256 `5209358cb0e9d91ced71b3b2ebaeb6e50d7f4304c03618a81a6a6a0adabf12e2`) | §0.1 "Entity/field bị loại khỏi baseline": no `Stocktake_Session`, `Stocktake_Snapshot`, `Stocktake_Count`, `Variance_Line`, `Adjustment` or matching report/permission. |
| UI baseline | `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` (SHA-256 `107a2b4de0f5763e39278ec130758d57e772e004e525416c088018cf9ddba658`) | No Stocktake/Variance screen, menu entry or stock-edit action. |

`DEC-NO-STOCKTAKE-001` appears only as a decision row inside that baseline. The standalone Decision Record `WWHN-25 / DEC-STK-001` is still `In Progress` (BA comments `14791`, `15251`), so:

- it is **not** cited as an approved standalone Decision ID, and no approval date/hash is claimed from FE source;
- the rule itself stays enforced, because `REQ-SRS-037` in the adopted baseline plus the ERD/wireframe baselines already require it — it is a regression guard against silent reintroduction, not a governance claim;
- reintroduction requires an approved Later Phase/Change Request or a closed WWHN-25, plus synchronized FE/BE/OpenAPI/RBAC/test updates.

Machine-readable status: `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json`; machine-enforced by `npm run check:api-mapping` and `npm run wwhn-296:verify`.

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
