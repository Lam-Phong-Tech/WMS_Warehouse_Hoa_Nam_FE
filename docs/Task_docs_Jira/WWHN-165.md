# WWHN-165 — Tích hợp đăng nhập, phiên làm việc và trạng thái 403

Cập nhật: 2026-08-04  
Nhánh bắt buộc: `m1`  
Parent: WWHN-35

## Kết luận kỹ thuật

FE không còn P0 code blocker riêng. Closure vẫn là **PASS có điều kiện** vì QA1, QA2, BE, BAS/BA và Lead/QA phải xác minh độc lập trên cùng source SHA/build/environment; FE không tự ký thay.

## Xử lý gốc rễ

1. Access token chỉ ở memory; refresh token ưu tiên HttpOnly cookie. Logout xóa token, profile, permission, context và toàn bộ React Query cache để ngăn rò dữ liệu giữa phiên/người dùng.
2. Các 401 đồng thời dùng single-flight refresh; request gốc chỉ retry một lần. Refresh/login 401 không tự lặp vô hạn và dẫn về login sau khi dọn sạch phiên.
3. 403 tách biệt 401. `PASSWORD_CHANGE_REQUIRED` đi đúng luồng đổi mật khẩu; permission deny được đánh dấu để UI hiển thị no-permission. 409/422 có nhãn riêng cho conflict/field validation.
4. Protected route fail-closed: chỉ render shell khi bootstrap xong, có session hợp lệ và `/auth/me` đã tải thành công. Lỗi profile/RBAC hiển thị retry/error, không mở shell im lặng.
5. Permission lấy theo `active_context.permission_codes`, không suy diễn role name; đổi context phải đổi JWT và refetch `/auth/me`.
6. Bổ sung closure gate `npm run wwhn-165:verify`, register có owner/status/evidence schema, CI bắt buộc chạy gate trước build.

## P0/P1/P2 disposition

| Mức | Finding | Xử lý trong repo | Trạng thái |
|---|---|---|---|
| P0 | Không có blocker FE riêng | Giữ fail-closed và CI regression gate | Done FE |
| P1 | Parent WWHN-35 chưa sẵn sàng | Register bắt buộc đủ FE/BE/QA1/QA2/BAS-BA/Lead-QA trên cùng SHA/build/env | Chờ owner ngoài FE |
| P1 | QA1 security/RBAC/audit | Cung cấp matrix chuẩn tại `QA1_SECURITY_RBAC_AUDIT_MATRIX.md` | Chờ QA1 chạy DEV/UAT |
| P1 | QA2 role/navigation | Cung cấp matrix chuẩn tại `QA2_UI_ROLE_NAVIGATION_MATRIX.md` | Chờ QA2 retest |
| P1 | Backend authorization | Contract handoff yêu cầu direct API 403, data-scope deny, audit DB/log; cấm dùng FE hide làm evidence | Chờ BE + QA1 |
| P1 | Contract/permission/sample | Yêu cầu OpenAPI/Postman version/hash, catalog, mẫu 403/409/422/idempotency | Chờ BE1/BE2 |
| P1 | WWHN-146/147 | Register khóa dependency approval/traceability | Chờ BAS + BA |
| P1 | Runtime visual evidence | Chuẩn hóa filename/metadata và artifact CI 90 ngày | FE ready; chờ QA2 runtime |
| P2 | Vite/Vitest warning | Không suppress warning; Tech Lead phải disposition/tách task nếu còn xuất hiện trên CI | Controlled |
| P2 | Blob ảnh không truy vết | Cấm blob không tên; dùng filename schema trong register | Done control |

## Lệnh xác minh bắt buộc

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run wwhn-165:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:evidence
```

## Evidence runtime bắt buộc

Tên file:

`WWHN-165__<env>__<source-sha-12>__<build-id>__<role>__<viewport>__<scenario>__<timestamp>.<ext>`

Metadata tối thiểu: env, source SHA, execution SHA, build ID, role, permission codes, data scope, browser, viewport, timestamp, scenario, expected/actual, request-id, result, reviewer.

## Điều kiện chuyển Done

- CI trên exact source SHA pass toàn bộ gate.
- QA1 attach security/RBAC/audit evidence thật.
- QA2 attach role/navigation/responsive/API-error evidence thật.
- BE attach contract và authorization/audit evidence độc lập.
- WWHN-146 và WWHN-147 có approval/traceability.
- Lead/QA reconcile tất cả artifact cùng SHA/build/env và đóng parent WWHN-35.
