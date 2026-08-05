# WWHN-165 - Tích hợp đăng nhập, phiên làm việc và trạng thái 403

Cập nhật: 2026-08-05  
Nhánh: `m1`  
Baseline: `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`

## 1. Kết luận kiểm soát

- **FE-owned closure: COMPLETE**
- **Final acceptance: PENDING_INDEPENDENT_EVIDENCE**
- Không còn P0 code blocker trực tiếp thuộc FE auth/session được phát hiện.
- WWHN-35 không được Done cho tới khi BE1, FE1, QA1, QA2, BAS và BA cùng PASS trên một bộ exact SHA/build/environment.
- Hồ sơ FE không thay thế bằng chứng độc lập của BE1, QA1, QA2, BAS, BA hoặc Lead/QA.

## 2. Đối chiếu kiến trúc và root-cause remediation

### 2.1 Bootstrap và refresh

- `bootstrapAuth()` single-flight, tránh nhiều refresh request đồng thời.
- Refresh 401/403 được coi là invalid session, xóa session hint và fail-closed.
- Network/5xx/contract drift giữ tại `bootstrapError`; không giả lập thành anonymous session.
- `ProtectedRoute` hiển thị retry state, không mở protected shell khi profile/permission chưa tải thành công.

### 2.2 Thu hồi quyền stale khi JWT đổi

- `setToken()` thu hồi ngay profile, current context, permission và super-admin state cũ.
- Query `/auth/me` khóa theo token: `['auth', 'me', token]`.
- Switch-context xóa cache `/auth/me` cũ.
- UI chỉ render sau khi `/auth/me` của đúng JWT hiện tại pass.

### 2.3 Login nhiều context nguyên tử

- Với nhiều context, FE chỉ commit authenticated state sau khi `POST /auth/switch-context` thành công.
- Switch thất bại: best-effort revoke, clear token/cache và giữ người dùng ở login.
- Active context chỉ lấy từ `/auth/me`, không tự chọn phần tử đầu tiên.

### 2.4 Contract validation fail-closed

- `AuthContractError` / `AUTH_CONTRACT_INVALID` chặn token rỗng, TTL không hợp lệ và user thiếu stable identifier.
- Context bắt buộc có `role_id` và `scope_type`.
- Permission thiếu field không được tự cấp.
- FE guard là UX defense-in-depth; backend vẫn bắt buộc enforce direct API authorization và data scope.

### 2.5 Interceptor 401

- Auth endpoints không tạo redirect side-effect ngoài caller.
- Chỉ refresh 401/403 mới logout.
- Refresh network/5xx trả lỗi hạ tầng, không âm thầm phá phiên.
- Refresh success gọi `setToken()` trước khi retry request gốc để loại permission/profile stale.

### 2.6 Vite/Vitest

- Vite và Vitest dùng config ESM tách biệt.
- Không dùng `__dirname`, `__filename` hoặc `require()`.
- `npm run wwhn-165:verify` khóa regression config-loader.

## 3. Mapping P0/P1/P2 sau xử lý

| Mức | Finding | Disposition | Trạng thái |
| --- | --- | --- | --- |
| P0 | N/A trực tiếp FE auth/session | Giữ fail-closed state machine và regression gates | CLOSED_FE_SCOPE |
| P1 | Parent WWHN-35 chưa sẵn sàng | Machine-readable register khóa final gate theo same SHA/build/env | PENDING_INDEPENDENT |
| P1 | QA1 chưa chạy security/RBAC/audit | Matrix WWHN-166 yêu cầu 401/403/token/data-scope/audit/no-stack-trace/409/422/idempotency | PENDING_QA1 |
| P1 | QA2 chưa retest role/navigation | Matrix WWHN-167 yêu cầu login/refresh/logout/403/role/browser/viewport | PENDING_QA2 |
| P1 | Backend authorization chưa chứng minh | Không dùng FE hide/redirect làm proof; yêu cầu direct API 403, data-scope deny và audit | PENDING_BE_QA1 |
| P1 | Contract/permission/sample conditional | Contract expectation khóa OpenAPI/Postman/version/hash/catalog/sample | PENDING_BE1_BE2 |
| P1 | WWHN-146/WWHN-147 chưa chốt | UI-state matrix và final gate giữ pending tới approval có traceability | PENDING_BAS_BA |
| P1 | CI/artifact chưa quan sát được | Run #107 và artifact đã được xác minh trực tiếp | CLOSED_FOR_SHA_57638B1 |
| P2 | Blob ảnh không truy vết | Jira comment 14612 = `SUPERSEDED_NON_EVIDENCE`; thay bằng evidence index + named artifact/digest | CLOSED_FE_SCOPE |

## 4. CI run #107 đã xác minh

| Trường | Giá trị |
| --- | --- |
| Workflow | `CI` |
| Run | `#107` / `30913628631` |
| Conclusion | `SUCCESS` |
| Exact SHA | `57638b1f7a0277a3f87d777668936d5f65f5e743` |
| Artifact ID | `8894201626` |
| Artifact name | `wms-fe-closure-evidence-57638b1f7a0277a3f87d777668936d5f65f5e743` |
| Size | `11,426,376 bytes` |
| Digest | `sha256:c87c01b37bc8c84dee5cf3788b4bb69026d756364c860a355bad9bef4ff5bc00` |
| Expiry | `2026-11-02T13:24:06Z` |

Run #107 chỉ chứng minh SHA `57638b1…`; commit mới phải có run riêng. Không tái sử dụng evidence cũ thay cho exact-SHA sign-off mới.

## 5. Evidence canonical

- `docs/evidence/wwhn-165/WWHN-165_EVIDENCE_INDEX.md`
- `docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json`
- `docs/evidence/wwhn-165/WWHN-166_QA1_SECURITY_MATRIX.md`
- `docs/evidence/wwhn-165/WWHN-167_QA2_UI_MATRIX.md`
- `docs/evidence/wwhn-165/WWHN-165_UI_STATE_MATRIX.md`
- `docs/api-evidence/WWHN-165_AUTH_CONTRACT_EXPECTATION.md`

Runtime filename:

`WWHN-165_<scenario>_env-<env>_sha-<source-sha>_role-<role>_viewport-<width>x<height>_<timestamp>.<ext>`

Artifact:

`wms-fe-closure-evidence-<SOURCE_SHA>`

Evidence thiếu filename/env/build/SHA/role/viewport/timestamp không hợp lệ.

## 6. Test matrix bắt buộc

### FE automated

- Bootstrap refresh 200/401/403/503/network và single-flight.
- Login một context, nhiều context, switch-context failure.
- JWT rotation thu hồi profile/permission cũ.
- Limited-role navigation, direct route 403 và menu visibility theo permission code.
- 401/403/409/422, password-change-required và contract invalid.
- Logout clear token/cache và back-navigation isolation.
- Desktop 1440x900, tablet 1024x768, mobile 390x844.

### QA1 WWHN-166

- Anonymous 401, expired token, refresh rotation/replay.
- Direct API 403 khi bypass FE.
- Data-scope deny ngoài company/branch/department/warehouse scope.
- Audit actor/time/request-id/action/before-after.
- No secret/stack trace.
- 409, 422, idempotency và concurrency.
- Raw HTTP/DB evidence đã mask secret, ghi exact env/build/SHA.

### QA2 WWHN-167

- Login redirect và attempted URL.
- Loading/error/disabled states.
- Refresh success/expired/503, logout.
- `/errors/403`, role đủ/thiếu quyền, menu/direct URL.
- Chrome/Edge; desktop/tablet/mobile; keyboard/focus cơ bản.

## 7. Quality gates

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

## 8. Final Definition of Done

### FE1 Done

- Auth/session fail-closed.
- Atomic context switch.
- Stale permission/data scope revoked on JWT rotation.
- Contract validation and regression tests.
- Responsive/RBAC/error controlled evidence.
- CI artifact is traceable by SHA and digest.
- Blob evidence without metadata is explicitly superseded.

### WWHN-35 Final Done

Chỉ Done khi:

1. WWHN-166 QA1 PASS trên exact env/build/SHA.
2. WWHN-167 QA2 PASS trên exact env/build/SHA.
3. BE1/QA1 có direct API deny, data-scope deny và audit evidence.
4. BE1/BE2 attach OpenAPI/Postman/version/hash, permission catalog, sample 403/409/422/idempotency.
5. WWHN-146 BAS và WWHN-147 BA có approval/traceability.
6. Lead + QA reconciliation xác nhận cùng build và không còn P0/P1.

Thiếu bất kỳ điều kiện nào phải giữ `PENDING_INDEPENDENT_EVIDENCE`; không tuyên bố 100% bằng evidence FE tự ký.
