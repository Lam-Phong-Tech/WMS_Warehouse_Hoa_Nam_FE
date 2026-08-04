# M1 API Mapping Evidence

Updated: 2026-08-04 ICT  
Scope: WWHN-181 / HN-INT-001 FE implementation mapping.

## Authority boundary

This document is FE evidence, not an independent BE contract approval. Endpoint
constants are relative to `VITE_API_BASE_URL`. Because the approved environment
shape ends with `/api/v1`, `SCAN_BATCHES_CLASSIFY = "/scan/classify"` resolves
to the canonical runtime URL `POST /api/v1/scan/classify`. Adding `/api/v1`
inside the constant would incorrectly produce `/api/v1/api/v1/scan/classify`.

Final sign-off remains blocked until WWHN-180, WWHN-182, and WWHN-183 have
independent evidence.

## Canonical critical mappings

| Flow | FE service | Method | Endpoint constant path | Effective runtime path | Permission | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Scan classify | `scanService.ts` | POST | `/scan/classify` | `/api/v1/scan/classify` | `scan.classify` | Implemented; BE1 + BA sign-off pending. |
| Post receipt | `receivingService.ts` | POST | `/inbound-documents/{id}/post-receipt` | `/api/v1/inbound-documents/{id}/post-receipt` | `inbound.post` | Implemented with `Idempotency-Key` and `If-Match`; BE sign-off pending. |
| Post issue | `shippingService.ts` | POST | `/outbound-documents/{id}/post-issue` | `/api/v1/outbound-documents/{id}/post-issue` | `outbound.post` | Implemented with `Idempotency-Key` and `If-Match`; BE sign-off pending. |
| Apply adjustment | `stocktakeService.ts` | POST | `/stocktake/sessions/{sessionId}/apply-adjustment` | `/api/v1/stocktake/sessions/{sessionId}/apply-adjustment` | `stocktake.adjust` | Action-level permission; route entry does not grant this action. |

## Dashboard and reports disposition

| Screen/action | Method | Path | FE runtime behavior | Canonical disposition |
| --- | --- | --- | --- | --- |
| Dashboard quick KPI | GET | `/reports/dashboard-quick` | Active | Implemented mapping; independent BE approval pending. |
| Inventory XNT | GET | `/reports/inventory-xnt` | Active | Implemented mapping; independent BE approval pending. |
| Export XNT | GET | `/reports/inventory-xnt/export-excel` | Active and action-gated by `report.export` | Implemented mapping; independent BE approval pending. |
| Reports hub | GET | `/reports/hub` | Fail-closed before network | Blocked until BE1/BE2 + BA publish canonical OpenAPI/Jira disposition. |
| Warranty defects report | GET | `/reports/warranty-defects` | Fail-closed before network | Blocked until BE1/BE2 + BA publish canonical OpenAPI/Jira disposition. |

## RBAC mapping

Route permission is only a page-entry UX gate. Backend authorization remains
the authority for HTTP 403 and data scope.

| Area | Route-entry permission | Sensitive action permission |
| --- | --- | --- |
| Scan | `inventory.trace` OR `scan.classify` | `scan.inbound`, `scan.outbound`, or `scan.warranty` according to context |
| Stocktake | `stocktake.count` | `stocktake.adjust` for apply adjustment |
| Warranty | `warranty.manage` | `warranty.temp_only` for TEMP_ONLY creation |
| Reports | `report.view` | `report.export` for export |

Legacy FE names are normalized only through an explicit alias list. No broad
permission such as `stocktake.manage` is silently promoted to
`stocktake.adjust`.

## Evidence commands

```bash
npm run format:check
npm run lint
npm run test
npm run env:verify
npm run master-sku:verify
npm run wms-contract:verify
npm run build
npm run health:check
npm run check:api-mapping
```

CI writes machine-readable evidence to
`docs/evidence/wms-contract-signoff/ci-contract-evidence.json` and uploads it
as `wms-contract-evidence-${GITHUB_SHA}`.
