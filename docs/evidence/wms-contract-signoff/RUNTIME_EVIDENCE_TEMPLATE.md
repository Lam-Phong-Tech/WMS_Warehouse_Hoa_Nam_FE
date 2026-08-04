# WWHN-181 Runtime Evidence Template

This template must be completed by QA2 on the exact commit, build, environment,
browser, role, and permission fixture. FE automation can prepare the checks but
must not fabricate independent runtime evidence.

## Run identity

| Field | Required value |
| --- | --- |
| Commit SHA | Exact tested SHA |
| CI run/build ID | Link or ID |
| Environment/API base URL | Named DEV/UAT environment |
| Browser/device/viewport | Version and viewport |
| Actor/role/permission codes | Exact fixture |
| Test time | ISO-8601 with timezone |

## Required captures

| Evidence ID | Scenario | Expected evidence |
| --- | --- | --- |
| RT-01 | Scan success | Network request to `/api/v1/scan/classify`, payload, 2xx response, success UI |
| RT-02 | Scan validation/error | 422/409/5xx or controlled negative response, error code, request ID, retry behavior |
| RT-03 | RBAC | Direct API request by an unauthorized actor returns 403; UI guard alone is insufficient |
| RT-04 | Stocktake adjust | `stocktake.adjust`, confirmation, `Idempotency-Key`, `If-Match`, replay/conflict behavior |
| RT-05 | Warranty TEMP_ONLY | Missing `warranty.temp_only` blocks before request; permitted actor reaches API |
| RT-06 | Reports | XNT/export canonical routes work; hub/warranty-defects make no request while blocked |
| RT-07 | Responsive/accessibility | 1920, 1366, 1024, 768 and mobile viewport; keyboard focus and readable error states |
| RT-08 | UI states | loading, empty, error, success, disabled, confirm, retry |

Attach screenshots/video and sanitized network HAR or equivalent. Do not commit
PII, tokens, cookies, passwords, or production identifiers.

## Independent boundary

Không tự nhận QA2 sign-off.  
Không tự nhận BE authorization sign-off.  
BA must record Go, Conditional Go, or No-Go in WWHN-183 after reviewing the
evidence above.
