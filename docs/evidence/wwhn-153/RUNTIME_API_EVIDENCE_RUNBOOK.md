# WWHN-153 — Runbook runtime/API evidence độc lập

## Mục tiêu

Tạo bằng chứng trực tiếp cho WWHN-182 trên đúng FE source SHA, build ID và môi trường DEV/UAT có backend thật. Runner không dùng mock, không đi qua browser và không lưu token.

## Lệnh

```bash
npm run wwhn-153:runtime -- --contract-only
npm run wwhn-153:runtime
```

Các biến bắt buộc cho live run:

```text
WWHN_153_API_BASE_URL=https://<dev-or-uat>/api/v1
WWHN_153_ENVIRONMENT=DEV|UAT
WWHN_153_SOURCE_SHA=<40-hex FE SHA>
WWHN_153_BUILD_ID=<immutable build id>
WWHN_153_QA2_ACCOUNT=<Jira/account identity>
WWHN_153_DENIED_TOKEN=<token không có quyền>
WWHN_153_ALLOWED_TOKEN=<token có quyền đúng>
WWHN_153_PERMISSION_DENY_PROBE_JSON=<method/path/body>
WWHN_153_IDEMPOTENCY_PROBE_JSON=<method/path/body/changedBody/idempotencyKey/ifMatch>
WWHN_153_STALE_PROBE_JSON=<method/path/body/idempotencyKey/staleIfMatch>
```

## Assertions bắt buộc

| Scenario | Điều kiện pass |
| --- | --- |
| `PERMISSION_DENY_403` | Direct API trả đúng `403`; giữ request ID, error code và response đã sanitize. |
| `IDEMPOTENCY_REPLAY` | Hai request cùng key/payload không tạo tác động thứ hai; response hoặc resource reference nhất quán. |
| `IDEMPOTENCY_CONFLICT` | Cùng key nhưng payload khác bị từ chối `409`. |
| `STALE_WRITE` | `If-Match` cũ bị từ chối `409` hoặc `412`. |
| `PERMISSION_CATALOG` | GET `/permissions` thành công; snapshot được reconciliation với FE canonical catalog. |

Runner tạo JSON riêng cho từng request/response, một summary và `SHA256SUMS`. Authorization, cookie, set-cookie và khóa bí mật luôn bị che.

## Ranh giới trách nhiệm

FE cung cấp runner và verifier. QA2 phải tự chạy bằng credential/môi trường do QA quản lý và attach artifact vào WWHN-182. BA chỉ ra quyết định WWHN-183 sau khi đối chiếu đúng SHA/digest; FE không được tự ký thay.
