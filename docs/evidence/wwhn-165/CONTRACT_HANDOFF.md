# WWHN-165 — Contract và Permission Handoff

## Canonical API contract

BE1/BE2 phải bàn giao artifact thật, không chỉ ghi tên file trong comment:

- OpenAPI JSON/YAML có version, commit SHA/source URL và SHA256.
- Postman collection + environment tương thích cùng version.
- Permission catalog chính thức theo permission code, không theo role name.
- Payload mẫu login, refresh, logout, `/auth/me`, switch-context.
- Error mẫu 401, 403, 409, 422 và idempotency/replay.

## Authorization evidence độc lập

Backend/QA1 phải chứng minh bằng direct API:

1. Không token → 401.
2. Token hợp lệ nhưng thiếu permission → 403.
3. Có permission nhưng ngoài data scope → deny theo contract, không rò dữ liệu.
4. FE hide/redirect không được tính là bằng chứng authorization.
5. Request bị deny không tạo hoặc sửa dữ liệu nghiệp vụ.
6. Audit có actor, timestamp, request-id, action, target và before/after khi áp dụng.
7. Response không lộ secret, cookie, token hoặc stack trace.

## FE integration invariant

- Access token memory-only; refresh qua HttpOnly cookie hoặc transitional refresh token theo contract.
- 401 chỉ refresh một lần và gom request đồng thời.
- 403 không logout, trừ khi contract riêng yêu cầu; `PASSWORD_CHANGE_REQUIRED` điều hướng riêng.
- `/auth/me` là nguồn profile, active context và permission codes.
- Đổi context phải nhận token mới và refetch `/auth/me`.
- Logout xóa query cache để ngăn cross-user/cross-scope data leak.

## Approval gate

Artifact chỉ hợp lệ khi cùng environment, source SHA, build ID và timestamp window. Mọi mismatch phải FAIL hoặc có disposition được Lead/QA duyệt.
