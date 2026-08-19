# WWHN-292 — FE292-P1-04: pointer sang RAW BE authorization evidence

Bản đầy đủ (raw request/response từng probe + QA1 independent verification) nằm trong repo BE:
`WMS_Warehouse_Hoa_Nam_BE/docs/evidence/wwhn-292/BE_AUTHZ_EVIDENCE.md`.

## Tóm tắt định danh

- **BE SHA** lúc chạy probe: `5db3cb06a33aef726466e54801c7e087915d1801` (nhánh `m1`);
  HEAD lúc ghi evidence `958ef1d1ce9d21841aa66645842b2f6b6572126e` — diff giữa 2 SHA
  **không chứa file application code nào** (chỉ docs/scripts của phiên song song), nên
  runtime code của mọi probe đồng nhất ở cả hai SHA.
- Env: `php artisan serve` 127.0.0.1:8292, APP_ENV=local, PHP 8.3.30, PostgreSQL 16.14
  (docker), DB cô lập `hoa_nam_wwhn292_evidence` (migrate + seed riêng, không đụng DB chung).
- Thời điểm: 2026-08-19 11:41–11:43 UTC. Evidence class: **LOCAL_RUNTIME_NOT_UAT_ENV**.

## Kết quả probe (UI bypassed hoàn toàn)

| Probe | Account/role | Kết quả | request_id (RUN-1) |
| --- | --- | --- | --- |
| AUTHZ-401 — `GET /api/v1/inventory/balances` không token | anonymous | **401** `UNAUTHENTICATED` | `4049819e-6e7a-45ba-b7ca-bcdc66fe2a60` |
| AUTHZ-403-PERMISSION — `GET /api/v1/users` bằng token thiếu `iam.user.view` | `viewer01` / VIEWER | **403** `ACCESS_DENIED` | `ef50fe1e-cb0d-4904-959f-f2fb8efaa5f0` |
| AUTHZ-403-DATA-SCOPE — query kho ngoài `user_roles.scope_ref` | `viewer01` scope KHO-TONG-HN | **403** `ACCESS_DENIED` — "Kho yêu cầu nằm ngoài data scope hiện hành." | `bec59e72-b996-4bcf-b494-b80b161f3cb4` |
| POSITIVE CONTROL — cùng token, kho trong scope | `viewer01` | **200** + data balance | `47a3ec1f-06bb-48de-8757-54adbcbb2b0f` |

QA1 independent verification: lượt chạy thứ hai độc lập (PowerShell Invoke-WebRequest, login
mới, ~60s sau) khớp 100% status + error_code với RUN-1 — request_id: `d5db8dd3…`,
`a171165f…`, `07f2fa03…`, `ff78e57c…` (đầy đủ trong file BE).

Ghi chú vocabulary: BE trả `UNAUTHENTICATED`/`ACCESS_DENIED` theo error envelope canonical
của BE; ánh xạ sang nhãn §8.2 SRS (AUTH_REQUIRED / PERMISSION_DENIED / DATA_SCOPE_DENIED)
thuộc hợp đồng HTTP↔mã lỗi do BE sở hữu (đã chốt ở WWHN-267); FE xử lý theo HTTP status +
envelope, không phân nhánh theo chuỗi mã.

Positive control chứng minh token hợp lệ và có `inventory.view`, nên các deny 401/403 ở trên
là enforcement thật (authentication / permission / data scope), không phải token hỏng.
Middleware được trích dẫn kèm số dòng trong file BE (`permission:*`,
`EnforceInventoryWarehouseScope` dòng 46–51/175–193).
