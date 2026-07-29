# HN-FE-002 - Master/SKU FE Evidence

## Traceability

| Field                | Value                            |
| -------------------- | -------------------------------- |
| Contract Item        | PL01-04                          |
| Parent Task          | [FE] Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code |
| Parent Temp Key      | HN-FE-002 / HN-UX-002            |
| Epic Temp Key        | HN-EPIC-04                       |
| BA Pin               | HN-PIN-04                        |
| Role                 | FE1                              |
| Assignee Placeholder | HN-FE-01                         |
| Dependencies         | HN-UX-002, HN-FND-002, HN-MC-001 |
| Sources              | 08_DATA_API_UI_TECHNICAL_HANDOFF, HoaNam_Handoff_v3_9, WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide |
| Stock Effect         | None                             |
| Output               | Master/SKU màn hình, Import UI, Responsive/RBAC evidence |

## Delivered Scope

- Replaced the previous mock-only Master Data screen with a reusable config-driven entity panel for SKU, Item, and Physical Code.
- Added server-side query parameters for search, filter, sort, pagination, and page size across all entity tabs.
- Added detail drawer reused by SKU/item/code, with field visibility driven by entity config.
- Added SKU create modal using backend payload field names and inline 422 field error mapping.
- Added SKU status confirm action, action-level disabled RBAC, and route-level RBAC compatibility.
- Added SKU import upload flow with result modal, summary metrics, and row-level error table.
- Added local CSV import template generation without changing API contract.
- Added loading, empty, 403, 409/422/network-capable error display, success, disabled, and confirm states.

## API Contract Used

| Capability         | Endpoint                  |
| ------------------ | ------------------------- |
| SKU list/create    | `GET/POST /skus`          |
| SKU status update  | `PATCH /skus/:id`         |
| SKU import         | `POST /skus/import-excel` |
| Item list          | `GET /items`              |
| Physical code list | `GET /physical-codes`     |

All calls use `src/shared/api/http.ts` and preserve API envelope/error handling.

Import result accepts backend-provided `row_errors`/`errors` and summary fields. FE does not decide partial-write behavior; it only shows the backend contract result so the "no partial write outside rule" acceptance point remains owned by HN-MC-001.

## State Evidence

| State         | Implementation                                                                      |
| ------------- | ----------------------------------------------------------------------------------- |
| Loading       | Ant Design `Table.loading` from TanStack Query fetching state                       |
| Empty         | Table `locale.emptyText` per tab                                                    |
| Error         | API error alert with HTTP status, error code, and request id when available          |
| Success       | Ant Design message after create/import plus import result modal                     |
| Disabled/RBAC | Create, import, and status actions disabled without `sku.manage` or `master.manage` |
| Confirm       | Status change uses shared `ConfirmButton`                                           |
| Responsive    | Filter row uses responsive Ant Design grid and horizontal table scroll              |
| Detail        | Drawer reused for SKU/item/code field review                                        |
| Import        | Upload, template, summary metrics, and row-level error table                        |

## Verification

- `cmd /c npm run lint` passed.
- `cmd /c npm run build` passed.
- `cmd /c npm run test` passed: 32 test files, 276 tests.

## Files Changed

- `src/modules/master-data/pages/MasterPage.tsx`
- `src/modules/master-data/services/master-data.service.ts`
- `src/modules/master-data/types/master-data.types.ts`
- `docs/evidence/HN-FE-002-MASTER-SKU-FE.md`

## Open Contract Items

- Confirm with BE owner whether SKU import endpoint is exactly `POST /skus/import-excel`; the FE implementation follows the existing repository import naming convention.
- Confirm final SKU field specification, enum values, and whether official template download endpoint will be provided by HN-MC-001.
- Confirm final import response field names for row-level errors. FE supports `row_errors` and `errors` as a compatibility bridge.
