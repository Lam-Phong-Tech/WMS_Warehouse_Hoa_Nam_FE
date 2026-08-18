# M1 API Mapping Evidence — current `m1`

Cập nhật: 2026-08-18 ICT  
Phạm vi: FE runtime/API mapping evidence phục vụ `WWHN-296`, đồng thời duy trì traceability cho `WWHN-148`.

## Ranh giới thẩm quyền

Tài liệu này là evidence do FE sở hữu, không thay thế phê duyệt độc lập từ BE/BA/QA/DevOps. Endpoint constants là đường dẫn tương đối so với `VITE_API_BASE_URL`. Base URL canonical kết thúc bằng `/api/v1`; vì vậy constant `/scan/classify` tạo runtime URL `POST /api/v1/scan/classify`.

Production domain/origin/secret không được hard-code. DEV/UAT/PROD phải inject các giá trị deploy thực tế qua pipeline/environment.

## Critical flow mappings

| Flow | FE service | Method | Endpoint constant path | Effective runtime path | Permission | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Scan classify | `scanService.ts` | POST | `/scan/classify` | `/api/v1/scan/classify` | `scan.execute` OR `scan.classify` | Canonical FE/OpenAPI path; WWHN-296 restores matching authenticated BE runtime alias. Read-only, `stock_effect=NONE`. |
| Inbound scan | `inboundService.ts` | POST | `/inbound-documents/{id}/scans` | `/api/v1/inbound-documents/{id}/scans` | `inbound.scan` | Canonical Annex C alias; stock-neutral before Post Receipt. |
| Post receipt | `inboundService.ts` | POST | `/inbound-documents/{id}/post-receipt` | `/api/v1/inbound-documents/{id}/post-receipt` | `inbound.post` | Full-document Post; idempotency/concurrency guards retained. |
| Outbound scan | `shippingService.ts` | POST | `/outbound-documents/{id}/scans` | `/api/v1/outbound-documents/{id}/scans` | `outbound.scan` | Canonical Annex C alias; stock-neutral before Post Issue. |
| Post issue | `shippingService.ts` | POST | `/outbound-documents/{id}/post-issue` | `/api/v1/outbound-documents/{id}/post-issue` | `outbound.post` | Full-document Post; only successful Post decreases stock. |
| Reversal | `reversalService.ts` | POST | `/reversal-documents/{id}/post` | `/api/v1/reversal-documents/{id}/post` | `inventory.reversal.post` | Append-only correction after posting; no direct stock edit. |

## Warranty & Component Issue mappings — flow 04

| Flow | FE service | Method | Endpoint constant path | Effective runtime path | Permission | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Warranty list | `warrantyService.ts` | GET | `/warranty-cases` | `/api/v1/warranty-cases` | `warranty.view` / `warranty.manage` | Current BE route present. |
| Warranty intake | `warrantyService.ts` | POST | `/warranty-cases` | `/api/v1/warranty-cases` | `warranty.manage` (+ TEMP_ONLY guard) | Stock-neutral intake; idempotency enforced where required. |
| Warranty detail | `warrantyService.ts` | GET | `/warranty-cases/{id}` | `/api/v1/warranty-cases/{id}` | `warranty.view` / `warranty.manage` | Current BE route present. |
| Warranty update | `warrantyService.ts` | PATCH | `/warranty-cases/{id}` | `/api/v1/warranty-cases/{id}` | `warranty.manage` | Mutation permission + concurrency safeguards retained. |
| Warranty events | `warrantyService.ts` | GET | `/warranty-cases/{id}/events` | `/api/v1/warranty-cases/{id}/events` | `warranty.view` / `warranty.manage` | Current BE route present. |
| Attachments list | `warrantyService.ts` | GET | `/warranty-cases/{id}/attachments` | `/api/v1/warranty-cases/{id}/attachments` | `warranty.view` / `warranty.manage` | Current BE route present. |
| Attachments upload | `warrantyService.ts` | POST | `/warranty-cases/{id}/attachments` | `/api/v1/warranty-cases/{id}/attachments` | `warranty.manage` | Multipart, stock-neutral. |
| Attachment download | `warrantyService.ts` | GET | `/warranty-attachments/{id}/download` | `/api/v1/warranty-attachments/{id}/download` | `warranty.view` / `warranty.manage` | Current BE route present. |
| Attachment delete | `warrantyService.ts` | DELETE | `/warranty-attachments/{id}` | `/api/v1/warranty-attachments/{id}` | `warranty.manage` | Logical delete semantics. |
| Component issues list | `componentIssueService.ts` | GET | `/warranty-component-issues` | `/api/v1/warranty-component-issues` | `warranty.component_issue` | Current BE route present. |
| Component issue create | `componentIssueService.ts` | POST | `/warranty-component-issues` | `/api/v1/warranty-component-issues` | `warranty.component_issue` | DRAFT is stock-neutral. |
| Component issue detail | `componentIssueService.ts` | GET | `/warranty-component-issues/{id}` | `/api/v1/warranty-component-issues/{id}` | `warranty.component_issue` | Current BE route present. |
| Component issue scan | `componentIssueService.ts` | POST | `/warranty-component-issues/{id}/scans` | `/api/v1/warranty-component-issues/{id}/scans` | `warranty.component_issue` | Scan is stock-neutral. |
| Component issue cancel | `componentIssueService.ts` | POST | `/warranty-component-issues/{id}/cancel` | `/api/v1/warranty-component-issues/{id}/cancel` | `warranty.component_issue` | Reason required. |
| Component issue post | `componentIssueService.ts` | POST | `/warranty-component-issues/{id}/post` | `/api/v1/warranty-component-issues/{id}/post` | `warranty.component_issue` | Explicit stock-decrease boundary with movement evidence. |

## Reports disposition — flow 06

| Screen/action | Method | Path | Current disposition |
| --- | --- | --- | --- |
| Dashboard quick KPI | GET | `/reports/dashboard-quick` | BE route present; active UI wiring remains task-specific. |
| Inventory XNT | GET | `/reports/inventory-xnt` | BE route present, `report.view`. |
| Export XNT | GET | `/reports/inventory-xnt/export-excel` | BE route present, `report.export`. |
| Reports hub | GET | `/reports/hub` | BE route present; no longer marked missing. |
| Warranty defects report | GET | `/reports/warranty-defects` | BE route present; read/export permissions are separate. |

## Removed-from-MVP boundary — Stocktake

REQ-SRS-037 / `DEC-NO-STOCKTAKE-001` is the current baseline. `m1` must not expose Stocktake Session/Snapshot/Count, variance-adjustment endpoint, direct stock-edit permission, menu or production flow. Historical Stocktake rows are intentionally removed from this current runtime mapping. Corrections after Post use Reversal append-only.

## RBAC mapping

Route permission is a page-entry/action UX gate only. Backend authorization remains authoritative for HTTP 403 and data scope.

| Area | Route/read permission | Sensitive action permission |
| --- | --- | --- |
| Scan | `inventory.trace` or scan permission by context | `scan.execute`/`scan.classify`, `inbound.scan`, `outbound.scan`, `scan.warranty` |
| Warranty | `warranty.view` / `warranty.manage` | `warranty.manage`, `warranty.component_issue` |
| Reversal | inventory read as applicable | `inventory.reversal.post` |
| Reports | `report.view` | `report.export` |

## Error/idempotency evidence boundary

| Scenario | FE-owned control | Independent evidence still required |
| --- | --- | --- |
| 401/403 | Route/action guard + controlled API error rendering | Direct BE auth/data-scope deny on named runtime build |
| 409 | Shared error parser + conflict-safe UI state | Module-specific live conflict sample |
| 422 | Field-error extraction + retry-safe UI | Canonical live payload/field pointer sample |
| Idempotency | Posting mutations send required key and preserve response metadata | Live replay/conflict evidence on named build |

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

CI/evidence proves FE-owned checks only. DevOps PROD configuration, BE runtime sign-off, QA1/QA2 execution and BA Go/No-Go remain independent gates and must use the same exact build/environment identity.
