# WWHN-153 Runtime Evidence Template

Mẫu này được QA2/DevOps hoàn tất trên **đúng source SHA, execution/build SHA, CI run, môi trường, browser/device, role và permission fixture**. FE automation chỉ chuẩn bị manifest và controlled evidence; không được tự nhận sign-off thay QA/BE/BA.

## 1. Run identity

| Field | Required value |
| --- | --- |
| Repository/branch | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` / `m1` |
| Source SHA | SHA chính xác của đầu nhánh `m1` được test |
| Execution/merge SHA | SHA workflow checkout thực tế |
| PR/CI run/build ID | Link hoặc ID |
| Environment/API base URL | DEV/UAT đã định danh; không ghi token/secret |
| Browser/device/viewport | Version + viewport |
| Actor/role/permission codes | Fixture chính xác |
| Test time | ISO-8601 có timezone |
| Official OpenAPI version/SHA256 | Giá trị phát hành từ WWHN-31 |

## 2. Required captures

| Evidence ID | Scenario | Expected evidence |
| --- | --- | --- |
| RT-01 | Scan success | Request `/api/v1/scan/classify`, payload, 2xx response, `batch_id`, đủ từng `code_value`, success UI |
| RT-02 | Scan negative | 403/409/422/5xx, error code, request ID, UI retry-safe; không đổi state như thành công |
| RT-03 | RBAC runtime | `/permissions` catalog + direct API request của actor không quyền trả 403; UI guard không thay backend |
| RT-04 | Post Receipt | `inbound.post`, `Idempotency-Key`, `If-Match`, `receipt_id`, `movement_ref`, `request_id`, replay/conflict |
| RT-05 | Post Issue | `outbound.post`, `Idempotency-Key`, `If-Match`, `issue_id`, `movement_ref`, `request_id`, insufficient stock/conflict |
| RT-06 | Apply Adjustment | Chỉ `stocktake.adjust`; response có `session_id`, `movement_ref`, `request_id`; stale/replay/duplicate SKU negative |
| RT-07 | Report export | Thiếu `report.export` bị chặn trước request; actor hợp lệ tải đúng filter |
| RT-08 | Warranty TEMP_ONLY | Thiếu `warranty.temp_only` bị chặn trước request; actor hợp lệ đến API |
| RT-09 | Responsive/accessibility | 1440, 1024, 390; keyboard focus, không overflow, error state đọc được |
| RT-10 | Build trace | PR, source SHA, execution SHA, run/build ID, environment, lint/typecheck/test/build logs, manifest SHA256 |

Đính kèm screenshot/video và sanitized HAR hoặc network export. Không commit PII, token, cookie, mật khẩu hoặc định danh production.

## 3. Independent boundary

- Không tự nhận QA1/QA2 sign-off.
- Không tự nhận BE authorization/OpenAPI sign-off.
- BA chỉ ghi `Go`, `Conditional Go` hoặc `No-Go` tại WWHN-183 sau khi kiểm bằng chứng.
- FE final sign-off vẫn fail-closed khi WWHN-31/WWHN-180/WWHN-182/WWHN-183 chưa đạt.
