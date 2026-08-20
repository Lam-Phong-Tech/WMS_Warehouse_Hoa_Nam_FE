# WWHN-165 Auth Contract Expectation

Status: `FE_PROPOSED_PENDING_BE_APPROVAL`  
Owner phê duyệt: BE1/BE2 + BA + QA1  
Consumer: FE1, QA1, QA2

## 1. Versioning bắt buộc

BE phải attach OpenAPI YAML/JSON và Postman collection có:

- semantic version hoặc build version;
- SHA256 hash;
- generated/exported timestamp;
- source repository/commit;
- changelog so với bản trước;
- approver và approval timestamp.

FE CI không coi file expectation này là OpenAPI chính thức.

## 2. Endpoint tối thiểu

| Method | Path | Mục đích | FE behavior |
| --- | --- | --- | --- |
| POST | `/auth/login` | Đăng nhập | Nhận token + user + available contexts |
| POST | `/auth/refresh` | Phục hồi/rotate phiên | 401/403 = hết phiên; network/5xx = fail-closed retry |
| GET | `/auth/me` | Profile + active context + permission codes | Nguồn duy nhất cho quyền/scope UI |
| POST | `/auth/switch-context` | Cấp JWT theo context | Thu hồi profile/quyền cũ trước khi render |
| POST | `/auth/logout` | Revoke phiên | FE luôn clear local state trong `onSettled` |
| POST | `/auth/change-password` | Đổi mật khẩu bắt buộc | Dùng khi 403 `PASSWORD_CHANGE_REQUIRED` |

## 3. Success envelope

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-08-04T20:00:00+07:00"
  }
}
```

Auth token response bắt buộc có:

```json
{
  "access_token": "non-empty-string",
  "token_type": "bearer",
  "expires_in": 3600
}
```

`expires_in` phải là số dương. FE fail-closed nếu thiếu/rỗng/0.

## 4. `/auth/me` expectation

```json
{
  "id": 165,
  "email": "user@example.com",
  "code": "HN-QA-01",
  "is_super_admin": false,
  "active_context": {
    "role_id": 10,
    "role_name": "Warehouse Manager",
    "scope_type": "kho",
    "org_unit_id": null,
    "department_id": null,
    "warehouse_id": 20,
    "permission_codes": ["inventory.view"]
  },
  "available_contexts": []
}
```

Rules:

- FE không suy diễn quyền từ `role_name`.
- FE không union permission của nhiều context.
- `permission_codes` thiếu/invalid được coi là `[]`.
- `active_context` là nguồn scope hiện tại; `available_contexts[0]` không tự động được coi là active.
- `is_super_admin` runtime được ưu tiên hơn heuristic.

Open point `scope_type` (chờ BE/BA chốt, không chặn FE): SRS Annex A định nghĩa
enum `SYSTEM/WAREHOUSE/FUNCTION`, trong khi payload mẫu trên dùng nhãn hiển thị
`"kho"`. FE KHÔNG phân nhánh logic theo giá trị `scope_type` (quyền chỉ lấy từ
`permission_codes`, scope từ `scope_ref`/`warehouse_id`), nên khác biệt này
không tạo hành vi sai; BE/BA cần công bố enum canonical trong contract release
để QA1 assert đúng giá trị.

## 5. Error envelope

Hỗ trợ flat và nested trong giai đoạn migration, nhưng BE phải chốt một canonical shape:

```json
{
  "success": false,
  "message": "Forbidden",
  "error_code": "PERMISSION_DENIED",
  "errors": {},
  "meta": {
    "request_id": "uuid"
  }
}
```

hoặc:

```json
{
  "success": false,
  "message": "Forbidden",
  "error": {
    "code": "PERMISSION_DENIED",
    "details": {}
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

## 6. Status/error scenarios

| HTTP | Error code | Expected FE | Expected BE/QA evidence |
| --- | --- | --- | --- |
| 401 | `UNAUTHENTICATED` | refresh một lần; nếu refresh 401/403 thì logout | raw request/response + request-id |
| 403 | `ACCESS_DENIED` (mã runtime BE; SRS §8.2 gọi tên ví dụ `PERMISSION_DENIED` — FE nhận cả hai qua `FORBIDDEN_ERROR_CODES`, WWHN-267) | no-permission state/route | direct API deny dù bỏ FE guard |
| 403 | `DATA_SCOPE_DENIED` | không hiển thị dữ liệu ngoài scope | target resource + actor scope |
| 403 | `PASSWORD_CHANGE_REQUIRED` | redirect `/change-password` | login/session scenario |
| 409 | `STATE_CONFLICT` / `IDEMPOTENCY_CONFLICT` / `CONCURRENCY_CONFLICT` | conflict message, không mutate sai | before/after DB evidence |
| 412 | `STALE_VERSION` (If-Match cũ — SRS §8.2; KHÔNG phải 409) | reload version + thông báo dữ liệu đã đổi | raw request If-Match + response |
| 422 | validation | field-level errors | payload + field mapping |
| 428 | `PRECONDITION_REQUIRED` (thiếu If-Match/Idempotency-Key) | lỗi kỹ thuật, không retry mù | raw request/response |
| 429 | rate limit | retry-safe generic error | retry-after/header nếu áp dụng |
| 500/503 | server unavailable | fail-closed retry, không giả logout | no stack trace/secret |

## 7. Permission catalog tối thiểu liên quan route WMS

Canonical FE catalog nằm tại `src/shared/constants/wms-permissions.ts`. BE/BA phải xác nhận code runtime, đặc biệt:

- `inventory.view`
- `inventory.trace`
- `master.manage`
- `sku.manage`
- `inbound.create`
- `inbound.post`
- `outbound.create`
- `outbound.post`
- `report.view`
- `audit_log.view` (spelling canonical BE; alias `AUDIT_LOG_VIEW` chỉ qua `canonicalizeWmsPermission`)

REQ-SRS-037 (`DEC-NO-STOCKTAKE-001`): KHÔNG tồn tại permission `stocktake.*`
trên baseline MVP — mọi bản cũ của tài liệu này từng liệt kê `stocktake.count`
/ `stocktake.adjust` là sai và đã bị gỡ; gate `wwhn-236:verify` cưỡng chế.

Alias chỉ được dùng khi có mapping/version/changelog duyệt. Không dùng broad role fallback.

## 8. Idempotency/concurrency

Auth endpoint cần BE xác nhận:

- refresh token rotation/replay behavior;
- switch-context request replay behavior;
- logout idempotency;
- concurrent 401 requests chỉ tạo một refresh ở FE;
- token cũ sau switch có bị blacklist hay không;
- audit request-id liên kết request gốc/retry/refresh.

Sample 403/409/422/idempotency phải lấy từ runtime thật, mask secret và attach hash/version.
