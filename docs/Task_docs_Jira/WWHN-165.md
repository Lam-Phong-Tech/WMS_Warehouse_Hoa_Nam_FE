# WWHN-165 - Tích hợp đăng nhập, phiên làm việc và trạng thái 403

Cập nhật: 2026-08-04  
Nhánh: `m1`  
Tài liệu kiến trúc áp dụng: `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`

## 1. Kết luận phạm vi

- **FE-owned closure: COMPLETE**
- **Final acceptance: PENDING_INDEPENDENT_EVIDENCE**
- P0 riêng cho FE auth/session: không còn code blocker được phát hiện trong phạm vi WWHN-165.
- Hồ sơ này không thay thế bằng chứng độc lập của BE1, QA1, QA2, BAS, BA hoặc Lead.

Không tuyên bố WWHN-35 Done hoặc 100% acceptance khi WWHN-166, WWHN-167, WWHN-146, WWHN-147 và backend authorization evidence chưa có pass độc lập trên đúng build/env/SHA.

## 2. Root cause và xử lý kỹ thuật

### 2.1 Bootstrap phiên nuốt mọi lỗi refresh

**Root cause cũ:** mọi lỗi từ `/auth/refresh`, gồm network/5xx/contract drift, đều bị coi như không có phiên. Người dùng bị đưa về login, che mất lỗi hạ tầng và làm QA khó truy vết.

**Fix:**

- `bootstrapAuth()` dùng single-flight, không tạo nhiều refresh request đồng thời.
- 401/403 từ refresh được coi là phiên hết hạn và xóa session hint.
- Network/5xx/contract error được giữ ở `bootstrapError`.
- `ProtectedRoute` fail-closed, hiển thị retry state, không redirect giả sang login.

### 2.2 JWT mới vẫn giữ profile/quyền của JWT cũ

**Root cause cũ:** `setToken()` chỉ đổi token và `isAuthenticated`; `permissionCodes`, `currentContext`, `profile`, `isSuperAdmin` có thể tồn tại cho tới khi `/auth/me` refetch xong.

**Fix:**

- Mỗi lần refresh/switch-context cấp JWT mới, store thu hồi ngay profile, permission và active context cũ.
- Query key `/auth/me` gồm token: `['auth', 'me', token]`.
- Cache `/auth/me` cũ bị loại bỏ khi switch-context.
- Protected UI không render cho tới khi `/auth/me` của đúng JWT hiện tại pass.

### 2.3 Login nhiều context không nguyên tử

**Root cause cũ:** FE set authenticated state trước rồi auto switch context; nếu switch thất bại, protected shell vẫn có thể mở bằng JWT trung gian hoặc context suy diễn.

**Fix:**

- Với từ 2 context, login chỉ commit auth state sau khi `POST /auth/switch-context` thành công.
- Nếu switch thất bại, FE best-effort revoke logout, xóa local token/cache và giữ người dùng ở login.
- `setAuth()` không tự chọn context đầu tiên. Active context chỉ lấy từ `/auth/me`.

### 2.4 Auth contract dùng fallback rỗng

**Root cause cũ:** thiếu `access_token`, `expires_in` hoặc user identifier có thể bị normalize thành chuỗi rỗng/0 và đẩy lỗi sang runtime khó truy vết.

**Fix:**

- Bổ sung `AuthContractError` với mã `AUTH_CONTRACT_INVALID`.
- Login, refresh, switch-context fail-closed nếu token rỗng hoặc TTL không hợp lệ.
- User phải có stable identifier và email/username.
- Context phải có `role_id` và `scope_type`; permission không được tự cấp khi BE thiếu field.

### 2.5 401 interceptor phá phiên khi refresh lỗi hạ tầng

**Root cause cũ:** refresh thất bại bất kỳ nguyên nhân nào đều logout + redirect.

**Fix:**

- Login/refresh endpoint tự trả lỗi cho caller xử lý, không tạo redirect side-effect.
- Refresh 401/403 mới xác nhận phiên không hợp lệ và logout.
- Refresh network/5xx trả đúng lỗi hạ tầng, không âm thầm xóa phiên.
- Refresh thành công gọi `setToken()` để thu hồi quyền/profile stale trước retry request gốc.

## 3. Mapping P0/P1/P2

| Mức | Finding | Xử lý trong repo | Trạng thái |
| --- | --- | --- | --- |
| P0 | Không có P0 trực tiếp riêng FE auth/session | Giữ fail-closed guards và CI regression gate | Closed trong FE scope |
| P1 | Parent WWHN-35 chưa sẵn sàng | Closure register khóa final acceptance tới khi BE1/QA1/QA2/BAS/BA pass | Pending independent |
| P1 | QA1 chưa chạy security/RBAC/audit | Cung cấp test matrix và exact evidence metadata; WWHN-166 phải chạy DEV/UAT thật | Pending QA1 |
| P1 | QA2 chưa retest UI role/navigation | Playwright controlled evidence + checklist browser/viewport; WWHN-167 phải retest build thật | Pending QA2 |
| P1 | Backend authorization chưa chứng minh độc lập | FE ghi rõ UX guard không phải authorization; yêu cầu direct API 403/data-scope/audit | Pending BE1 + QA1 |
| P1 | Contract/permission/sample data conditional | FE thêm auth contract fail-closed; OpenAPI/Postman/version/hash/sample 403/409/422/idempotency vẫn cần BE | Pending BE1/BE2 |
| P1 | HN-UX-002-ST01 chưa chốt | Trace WWHN-146/WWHN-147 và giữ final gate pending | Pending BAS + BA |
| P1 | Runtime visual evidence thiếu | CI sinh screenshot/video/trace có env, SHA, role, viewport, timestamp | FE complete; QA2 runtime pending |
| P2 | Vite/Vitest warning | `vite.config.ts` và `vitest.config.ts` tách riêng, ESM-safe, không `__dirname`/`require`; CI verifier khóa tái phát | Closed trong FE scope |
| P2 | Comment blob ảnh không truy vết | Artifact dùng filename chuẩn và runtime manifest; blob cũ được coi là superseded | Closed trong FE scope |

## 4. Test matrix bắt buộc

### 4.1 FE automated

| Nhóm | Scenario |
| --- | --- |
| Bootstrap | refresh 200, refresh 401, refresh 503/network, single-flight |
| Login | success một context, nhiều context switch success, switch failure không mở shell |
| Session | JWT đổi thu hồi profile/quyền cũ; `/auth/me` key theo token |
| RBAC | limited role navigation; route 403; menu hide theo permission code |
| Error | 401/403/409/422; password-change-required; auth contract invalid |
| Logout | API logout settle, local token/cache clear, redirect login |
| Responsive | desktop 1440x900, tablet 1024x768, mobile 390x844 |

### 4.2 QA1 WWHN-166 - bắt buộc chạy trên env thật

- 401 anonymous direct API.
- 401 token expired và refresh rotation.
- 403 direct API khi FE guard bị bypass.
- 403 data-scope deny ở company/branch/department/warehouse ngoài scope.
- Audit actor, time, request-id, action, before/after.
- Error body không lộ stack trace/secret.
- 409 conflict, 422 validation, idempotency replay/concurrency.
- Evidence phải có env, API base URL, source SHA, execution/build SHA, role, scope, timestamp, request-id và raw response đã mask secret.

### 4.3 QA2 WWHN-167 - bắt buộc retest UI thật

- Login redirect và phục hồi attempted URL.
- Loading/disabled/error state khi login.
- Session refresh success, expired session, refresh 503.
- Logout.
- `/errors/403`.
- Role đủ quyền/thiếu quyền; navigation/menu/direct URL.
- Desktop 1440x900, tablet 1024x768, mobile 390x844.
- Chrome và Edge trên UAT; keyboard/focus cơ bản.

## 5. Runtime evidence naming

Playwright file mới: `e2e/wwhn-165-auth-session.spec.ts`.

Filename format:

`WWHN-165_<scenario>_env-<env>_sha-<source-sha>_role-<role>_viewport-<width>x<height>_<timestamp>.<ext>`

CI artifact:

`wms-fe-closure-evidence-<SOURCE_SHA>`

Artifact gồm screenshot, video, trace, `dist/health.json`, build manifest, closure register và runtime manifest. Không dùng blob URL không có filename/metadata làm evidence nghiệm thu.

## 6. Contract và permission boundary

FE route/menu/action guard chỉ là UX defense-in-depth. Backend bắt buộc tự enforce:

- direct API deny 403;
- data-scope deny;
- permission catalog theo code, không theo role name;
- audit trail;
- error contract 401/403/409/422;
- idempotency/concurrency theo endpoint.

OpenAPI/Postman/version/hash, permission catalog và sample runtime phải do BE1/BE2 cung cấp và QA1 xác minh. FE không tự ký thay.

## 7. Vite/Vitest P2 disposition

- `vite.config.ts` import `defineConfig` từ `vite`.
- `vitest.config.ts` import `defineConfig` từ `vitest/config`.
- Cả hai dùng `fileURLToPath(import.meta.url)` và Node ESM imports.
- Không dùng `__dirname`, `__filename`, `require()` hoặc reference coupling giữa Vite/Vitest config.
- `npm run wwhn-165:verify` fail nếu warning-prone pattern tái xuất hiện.

## 8. Quality gates

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run env:verify`
- `npm run uat:p0p1:verify`
- `npm run wwhn-165:verify`
- `npm run build`
- `npm run health:check`
- `npm run check:api-mapping`
- `npm run test:e2e:evidence`

Kết quả exact SHA được lấy từ GitHub Actions run sau commit; tài liệu không hard-code self SHA vì commit hash phụ thuộc chính nội dung tài liệu.

## 9. Definition of Done trung thực

### FE1 Done

- Auth/session state machine fail-closed.
- Atomic multi-context login.
- Stale permission/data-scope revoked khi JWT đổi.
- Contract validation và regression tests.
- Responsive/RBAC/API error controlled evidence.
- CI closure gate và traceable artifact.
- P2 Vite/Vitest disposition được code-enforce.

### Final Done của WWHN-35

Chỉ được chuyển Done khi:

1. WWHN-166 QA1 pass trên exact env/build/SHA.
2. WWHN-167 QA2 pass trên exact env/build/SHA.
3. BE1/QA1 có direct API deny, data-scope deny và audit evidence.
4. BE1/BE2 attach OpenAPI/Postman/version/hash, permission catalog, sample 403/409/422/idempotency.
5. WWHN-146 BAS và WWHN-147 BA có approval/traceability.
6. Lead + QA xác nhận toàn bộ evidence cùng build và không còn P0/P1 blocker.
