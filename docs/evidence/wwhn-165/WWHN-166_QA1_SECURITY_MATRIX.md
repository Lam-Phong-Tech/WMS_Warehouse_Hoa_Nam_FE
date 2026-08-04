# WWHN-166 QA1 Security/RBAC/Audit Execution Matrix

Status: `READY_FOR_QA1_EXECUTION`  
Task: WWHN-166  
Final owner: QA1 + BE1  
Environment: DEV/UAT thật, không dùng mock để sign-off

## Evidence header bắt buộc

Mỗi evidence phải ghi:

- environment name và base URL;
- source SHA, execution/deploy SHA, build ID;
- test timestamp + timezone;
- actor account, role, permission set, active scope;
- request method/path, masked headers, payload;
- HTTP status, error code, request-id;
- DB/audit reference khi áp dụng;
- expected/actual/pass-fail;
- tester và reviewer.

## Test cases

| ID | Scenario | Setup | Action | Expected |
| --- | --- | --- | --- | --- |
| QA1-AUTH-001 | Anonymous direct API | Không token | GET protected endpoint | 401, no data, no stack trace |
| QA1-AUTH-002 | Expired access token | Access token hết hạn, refresh hợp lệ | GET protected endpoint | refresh một lần, retry success |
| QA1-AUTH-003 | Expired refresh session | Access + refresh hết hạn | GET protected endpoint | refresh 401/403, session revoked |
| QA1-AUTH-004 | Refresh 503 | Auth service tạm lỗi | GET protected endpoint | FE giữ fail-closed error; không giả login |
| QA1-RBAC-001 | Direct API missing permission | User thiếu permission | Gọi API bằng Postman/curl, bypass FE | 403 `PERMISSION_DENIED` |
| QA1-RBAC-002 | Read outside warehouse scope | User scope warehouse A | GET resource warehouse B | 403/404 theo contract, không lộ data |
| QA1-RBAC-003 | Write outside scope | User scope branch A | POST/PUT target branch B | deny, transaction rollback |
| QA1-RBAC-004 | Token old after switch | Switch context tạo token mới | Dùng token cũ gọi API | deny theo blacklist/version policy |
| QA1-RBAC-005 | Super admin runtime | `is_super_admin=true` | Gọi route/action catalog | Pass theo BE policy; audit đầy đủ |
| QA1-ERR-001 | Validation | Payload sai field | POST/PUT | 422 + field errors đúng contract |
| QA1-ERR-002 | Conflict | Duplicate/version conflict | POST/PUT | 409, không tạo dữ liệu sai |
| QA1-IDEM-001 | Same idempotency key | Gửi cùng request 2 lần | POST protected mutation | không double-write; response policy rõ |
| QA1-IDEM-002 | Concurrent refresh | 5 request 401 đồng thời | Chạy parallel | một refresh session rotation hợp lệ |
| QA1-AUD-001 | Successful mutation audit | Actor có quyền | Create/update | actor/time/request-id/action/before-after |
| QA1-AUD-002 | Denied action audit | Actor thiếu quyền | Direct API call | deny event theo audit policy |
| QA1-SEC-001 | Error leakage | Trigger 401/403/409/422/500 | Inspect body/header | no stack trace, SQL, secret, token |

## Raw command skeleton

Không commit credential. Inject qua environment secret.

```bash
export API_BASE_URL="https://<uat-host>/api/v1"
export ACCESS_TOKEN="<runtime-secret>"
export REQUEST_ID="WWHN-166-$(date +%s)"

curl --silent --show-error --include \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Request-ID: ${REQUEST_ID}" \
  "${API_BASE_URL}/<protected-resource>"
```

## Direct API 403 proof

Evidence hợp lệ phải chứng minh cả ba:

1. UI có thể hide/redirect nhưng không được dùng làm proof chính.
2. Cùng actor/token gọi trực tiếp endpoint bị backend deny.
3. Audit/log ghi đúng request-id, actor, target, reason và timestamp.

## Pass rule

WWHN-166 chỉ Pass khi toàn bộ test applicable chạy trên cùng build/SHA với WWHN-165 và raw evidence có thể tải xuống. Screenshot đơn lẻ hoặc blob URL không metadata không hợp lệ.
