# HN-FND-001 - FE Auth / Session / 403 Evidence

## Truy vết Jira (Jira Traceability)

| Trường | Giá trị |
| --- | --- |
| Jira issue | WWHN-165 - [FE1] Tích hợp đăng nhập/phiên làm việc/trạng thái 403 |
| Task cha | WWHN-35 - [FOUNDATION] Xác thực, RBAC, audit và cấu trúc lỗi chuẩn |
| Khóa tạm task cha | HN-FND-001 |
| Khóa tạm Epic | HN-EPIC-03 |
| Phụ thuộc | HN-FND-001-ST01 |
| Vai trò | FE1 |
| Người được gán (placeholder) | HN-FE-01 |
| Đầu ra | Tích hợp xác thực FE |
| Ngày review | 2026-08-01 |

## Phạm vi đã triển khai (Scope Implemented)

- Đăng nhập sử dụng endpoint `POST /auth/login` đã được phê duyệt thông qua `authService.login`.
- Access token chỉ lưu trong bộ nhớ (memory-only); trạng thái auth được persist chỉ lưu các gợi ý phiên không nhạy cảm.
- Refresh token fallback chỉ giữ trong bộ nhớ khi BE trả về `refresh_token`; HttpOnly cookie vẫn là contract production ưu tiên.
- Session bootstrap tái lập các gợi ý không nhạy cảm, sau đó gọi `POST /auth/refresh` để khôi phục access token trước khi render protected UI.
- Xử lý 401 của Axios gọi `POST /auth/refresh` một lần cho các request hết hạn đồng thời, retry các request gốc với token mới, và redirect về `/login` chỉ sau khi refresh thất bại hoặc retry thất bại.
- Người dùng ẩn danh được redirect về `/login` với URL đã cố truy cập được bảo tồn trong router state.
- Đăng nhập thành công khôi phục URL protected đã cố truy cập, bao gồm query string và hash.
- Protected route chờ bootstrap và load profile/permission `GET /auth/me` trước khi render.
- RBAC cấp route được tập trung trong `ROUTE_PERMISSIONS` và thực thi bởi `RequirePermission`.
- `/errors/403` được bảo vệ bởi session guard, nên người dùng ẩn danh không thấy trang permission trước khi xác thực.
- Response 403 từ API được đánh dấu bởi axios interceptor và render nhất quán bởi `ApiErrorAlert` / `NoPermissionState`.
- `PASSWORD_CHANGE_REQUIRED` vẫn là flow 403 riêng biệt và redirect về `/change-password` mà không xóa session.

## Xử lý P0 (P0 Disposition)

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| P0-01: Access token hết hạn phải refresh và retry request gốc | Đã đóng | Fixed `src/shared/api/axios.ts` để interceptor luôn thử `POST /auth/refresh`; xác minh bởi `axios.refresh.integration.test.ts`. |
| P0-02: Request 401 đồng thời phải gộp thành một lần refresh | Đã đóng | `refreshPromise` gate refresh đồng thời; xác minh bởi integration test với `/employees` và `/departments`. |
| P0-03: F5/session bootstrap phải thử khôi phục trước khi redirect | Đã đóng | Fixed `src/modules/auth/services/auth.service.ts` để bootstrap không skip refresh khi FE không đọc được HttpOnly cookie. |
| P0-04: Truy cập protected route ẩn danh redirect về login | Đã đóng | `ProtectedRoute.tsx` chờ bootstrap, sau đó redirect người dùng ẩn danh với `state.from`. |
| P0-05: Người dùng đã xác thực không có permission route tới `/errors/403` | Đã đóng | `RequirePermission.tsx` redirect người dùng đã xác thực thiếu permission yêu cầu. |
| P0-06: Người dùng ẩn danh không thể xem trực tiếp `/errors/403` | Đã đóng | `/errors/403` được lồng dưới `ProtectedRoute` trong `src/app/router/index.tsx`. |
| P0-07: `PASSWORD_CHANGE_REQUIRED` không được trở thành 403 generic | Đã đóng | `axios.ts` kiểm tra flat và nested error code và redirect về `/change-password`. |
| P0-08: Logout xóa state/cache nhạy cảm | Đã đóng | `auth.store.ts` xóa memory storage và React Query cache; `use-logout.ts` redirect về `/login`. |
| P0-09: Lint/build/test phải pass cho handoff FE | Đã đóng | Xem log xác minh bên dưới. |

## Xử lý P1 (P1 Disposition)

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| P1-01: Route permission map phải là single-source | Đã đóng | `src/app/router/access.ts` feed route guard và menu filtering. |
| P1-02: Permission OR phải được hỗ trợ | Đã đóng | `RequirePermission.tsx` chấp nhận `string[]` và dùng OR semantics. |
| P1-03: Super admin bypass không được phụ thuộc chỉ vào heuristic empty context | Đã đóng | `auth.store.ts` ưu tiên BE `is_super_admin`, với legacy fallback chỉ khi absent. |
| P1-04: 403 data-scope/API denial phải render nhất quán | Đã đóng | `axios.ts` đánh dấu 403 với `_isNoPermission`; `ApiErrorAlert.tsx` render compact `NoPermissionState`. |
| P1-05: Context switch phải refresh active permission set | Đã đóng | `use-switch-context.ts` set token mới và invalidate `['auth','me']`; `auth.store.ts` lưu `permission_codes` của active-context. |
| P1-06: Lint noise không được block handoff | Đã đóng | Thay `@ts-ignore` không hợp lệ và normalize stale eslint disables trong các module page hiện có. |

## File đã thay đổi trong pass này (Files Changed In This Pass)

- `src/shared/api/axios.ts`
- `src/modules/auth/services/auth.service.ts`
- `src/modules/master-data/pages/MasterPage.tsx`
- `src/modules/inventory/pages/InventoryPage.tsx`
- `src/modules/putaway/pages/PutawayPage.tsx`
- `src/modules/receiving/pages/ReceivingPage.tsx`
- `src/modules/reports/pages/ReportsPage.tsx`
- `src/modules/reverse/pages/ReversalPage.tsx`
- `src/modules/scan/pages/PhysicalCodesPage.tsx`
- `src/modules/shipping/pages/ShippingPage.tsx`
- `src/modules/stocktake/pages/StocktakePage.tsx`
- `src/modules/warranty/pages/WarrantyPage.tsx`
- `docs/Task_docs_Jira/HN-FND-001-FE-AUTH-SESSION-403.md`

## Mapping tiêu chí chấp nhận (Acceptance Criteria Mapping)

| Tiêu chí chấp nhận | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Đầu ra "Tích hợp xác thực FE" đã review/verify | Hoàn thành | Auth service/store/interceptor/router/tests đã review và update. |
| UI cover trạng thái loading/error/disabled | Hoàn thành | `ProtectedRoute` loading gate, login submitting state, `ApiErrorAlert`, `NoPermissionState`. |
| Permission/RBAC và hiển thị API error đúng | Hoàn thành | `RequirePermission`, `ROUTE_PERMISSIONS`, axios 403 marker, trang 403 riêng biệt. |
| Không hard-code business rule trái contract | Hoàn thành | FE chỉ dùng route/action permission hints; BE vẫn là source of truth cho RBAC/data scope. |
| Endpoint/payload align với contract đã phê duyệt | Hoàn thành | Shared endpoint constants cho `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/refresh`, `/auth/switch-context`, `/auth/change-password`. |
| Lint/build/test pass | Hoàn thành | Xem log xác minh. |
| BA/QA evidence có sẵn | Hoàn thành | Tài liệu này ghi lại traceability, P0/P1 disposition, file đã thay đổi, và commands. |

## Log xác minh (Verification Log)

```text
npm.cmd test -- --run src/shared/api/axios.refresh.integration.test.ts src/app/bootstrap-auth.test.ts src/shared/api/axios.test.ts
Result: PASS - 3 test files, 22 tests

npm.cmd test -- --run src/modules/auth/hooks/use-login.test.tsx src/app/router/ProtectedRoute.test.tsx src/app/router/RequirePermission.test.tsx src/shared/api/axios.test.ts src/shared/api/axios.refresh.integration.test.ts src/shared/api/api-error.test.ts src/app/bootstrap-auth.test.ts src/app/router/access.test.ts src/shared/store/auth.store.test.ts src/shared/config/env.test.ts
Result: PASS - 10 test files, 58 tests

npm.cmd run lint
Result: PASS

npm.cmd run build
Result: PASS - tsc -b and vite build completed; 3368 modules transformed
```

Lưu ý xác minh đã biết: Vite báo warning non-blocking rằng `__dirname` trong `vite.config.ts` / `vitest.config.ts` không được hỗ trợ bởi native config loading trong tương lai. Nó không fail lint, test, hay build hiện tại.

## Ownership còn lại (Remaining Ownership)

- Không còn P0/P1 blocker thuộc sở hữu FE1 cho WWHN-165.
- BE vẫn sở hữu token validity, refresh cookie issuance/rotation, API-level RBAC/data-scope enforcement, audit logging, và structured error payload consistency.
- BA/QA có thể verify theo các scenario liệt kê trong P0/P1 disposition và command log bên trên.