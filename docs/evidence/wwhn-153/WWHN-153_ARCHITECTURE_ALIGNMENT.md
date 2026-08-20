# WWHN-153 — Architecture alignment với WMS Hoa Nam Dev Guide

Ngày đối chiếu: 2026-08-06.

## Nguồn kỹ thuật được áp dụng

- React/Vite/TypeScript SPA; API đi qua shared HTTP client.
- Permission code là authority identifier; role chỉ là mapping. Backend luôn là security boundary.
- Route guard là UX gate; action thay đổi dữ liệu phải có permission hẹp và backend direct API phải trả 403 khi thiếu quyền.
- CI phải khóa exact source SHA, build, test và immutable evidence.

## Canonical permission source

Nguồn code duy nhất là `src/shared/constants/wms-permissions.ts`. Các ví dụ permission trong Dev Guide không phải catalog đầy đủ. Năm action nhạy cảm bắt buộc (khớp `endpoint_permission_role_matrix` của BE, `backend_enforced=true`):

| Action | Permission hẹp | Roles runtime (BE) |
| --- | --- | --- |
| Post-receipt inbound | `inbound.post` | ADMIN, SUPER_ADMIN, WAREHOUSE_APPROVER, WAREHOUSE_KEEPER, WAREHOUSE_MANAGER |
| Post-issue outbound | `outbound.post` | ADMIN, SUPER_ADMIN, WAREHOUSE_APPROVER, WAREHOUSE_KEEPER, WAREHOUSE_MANAGER |
| Export inventory XNT | `report.export` | ADMIN, SUPER_ADMIN, WAREHOUSE_MANAGER |
| Create TEMP_ONLY warranty | `warranty.temp_only` | SUPER_ADMIN, WAREHOUSE_MANAGER |
| Classify scan batch | `scan.execute\|scan.classify` | ADMIN, SUPER_ADMIN, WAREHOUSE_KEEPER, WAREHOUSE_MANAGER, WAREHOUSE_STAFF, WARRANTY_STAFF |

**Sửa root cause 2026-08-20**: mapping cũ liệt kê `stocktake.adjust` (và ngụ ý `stocktake.manage`) làm action nhạy cảm thứ ba. Đây là bề mặt bị **REQ-SRS-037** cấm hoàn toàn khỏi MVP (không entity, không API, không permission, không màn hình) — xác nhận lại bằng ERD (`Stocktake_Session`/`Variance_Line`/`Adjustment` không được tạo) và bằng runtime catalog thật (83 permission_key hiện có trên BE, không permission nào khớp `stocktake.*`). Giữ nguyên item này trong mapping/probe sẽ buộc một approver ký duyệt một quyền không được phép tồn tại. `stocktake.manage`/`stocktake.adjust` không được xuất hiện ở bất kỳ đâu trong permission approval, `SENSITIVE_ACTIONS`, hay probe runtime; gate `PERMISSION-APPROVAL` fail-closed nếu phát hiện permission khớp `/^stocktake\./i`. Runtime `/permissions` phải reconcile với toàn bộ `WMS_PERMISSION_CATALOG`; hash response được bind vào permission approval.

## Evidence architecture

Chuỗi provenance: `repository + m1 + source SHA + execution SHA + parent SHA + tree SHA + workflow run + artifact name`. Final SHA không được hard-code trong chính commit; GitHub Actions derive từ immutable checkout.

Chuỗi contract: official OpenAPI/schema → exact SHA256 → QA1 reviewedArtifacts → WWHN-151 module schema → QA2 runtime package → permission approval → BA G1. Bất kỳ mismatch nào đều block final.

## Runtime architecture

Runtime proof dùng direct HTTP và effect probe:

- denied/stale: before hash = after hash;
- idempotency: after-first hash = after-replay hash;
- request/response tách artifact;
- request_id bắt buộc;
- token/cookie/JWT bị redact và scan trước packaging.
