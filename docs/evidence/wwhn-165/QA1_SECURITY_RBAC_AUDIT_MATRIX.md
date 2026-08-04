# WWHN-166 — QA1 Security/RBAC/Audit Matrix

Mọi case phải chạy trên cùng `environment`, `source_sha`, `build_id`; ghi request/response đã mask secret, status, error code, request-id và reviewer.

| ID | Scenario | Cách chạy | Expected |
|---|---|---|---|
| QA1-AUTH-01 | Không có access token | Gọi API protected trực tiếp | 401; không data; không stack trace |
| QA1-AUTH-02 | Access token hết hạn | Gọi API protected | FE refresh một lần; retry thành công hoặc logout nếu refresh invalid |
| QA1-AUTH-03 | Refresh invalid/expired | Gọi request protected với token hết hạn | Không loop; dọn session/cache; về login |
| QA1-RBAC-01 | User thiếu permission | Gọi API trực tiếp, không qua UI | 403; error code rõ; không thay đổi DB |
| QA1-RBAC-02 | FE ẩn action nhưng gọi API thủ công | Replay request bằng Postman/curl | Backend vẫn 403 |
| QA1-SCOPE-01 | Đúng permission, sai company/branch/warehouse scope | Gọi record ngoài scope | 403 hoặc 404 theo contract; không rò payload |
| QA1-SCOPE-02 | List ngoài scope | Gọi list/filter | Không trả record ngoài scope |
| QA1-AUDIT-01 | Thao tác thành công cần audit | Gọi create/update/delete/post | Audit có actor, time, request-id, action, target, before/after khi áp dụng |
| QA1-AUDIT-02 | Thao tác bị deny | Gọi API thiếu quyền | Audit/security log theo policy; không tạo business data |
| QA1-ERR-01 | Validation | Gửi payload sai | 422 + field errors; không stack trace |
| QA1-ERR-02 | Conflict/idempotency | Gửi duplicate/replay | 409 hoặc response idempotent theo contract; DB không nhân đôi |

## Evidence bắt buộc

- Raw HTTP log đã mask Authorization/cookie.
- DB before/after hoặc audit query cho case ghi dữ liệu.
- OpenAPI/Postman version + SHA256.
- Exact source SHA, build ID, env, timestamp, account/role/permission/scope.
- Comment PASS/FAIL độc lập tại WWHN-166; không dùng ảnh FE làm bằng chứng authorization.
