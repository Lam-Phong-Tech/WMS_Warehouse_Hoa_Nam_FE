/**
 * Lớp auth (phiên đăng nhập) — điểm vào DUY NHẤT cho xác thực.
 *
 * Gom các primitive xác thực để dùng nhất quán.
 *
 * Hướng xử lý:
 * - Protected route:          `ProtectedRoute` — chưa đăng nhập → /login.
 * - Phiên + token + hồ sơ:    `useAuthStore` (zustand, persist cookie).
 * - Nạp hồ sơ/quyền:          `useMe` (GET /auth/me sau login/F5).
 * - Đăng nhập / đăng xuất:    `useLogin` / `useLogout`.
 * - Redirect khi 401:         xử lý ở axios interceptor (shared/api/axios.ts).
 *
 * Phân quyền (permission/role/scope) tách riêng ở `@/lib/permissions`.
 */
export { useAuthStore } from "@/shared/store/auth.store";
export { ProtectedRoute } from "@/app/router/ProtectedRoute";
export { useMe } from "@/modules/auth/hooks/use-me";
export { useLogin } from "@/modules/auth/hooks/use-login";
export { useLogout } from "@/modules/auth/hooks/use-logout";

/**
 * ═══════════════════════════════════════════════════════
 *  TOKEN STORAGE
 * ═══════════════════════════════════════════════════════
 *
 * - Access token: chỉ trong bộ nhớ JS của tab (`memoryStorage`) → mất khi F5/đóng tab.
 * - Refresh token (P1 bảo mật 10/09/2026): CHỈ nằm trong cookie HttpOnly
 *   `wms_refresh_token` (Path=/api/v1/auth) do BE đặt. JSON của login/refresh/MFA
 *   verify không chứa nó; FE không lưu, không đọc, không gửi nó. Sau F5,
 *   `bootstrapAuth` gọi POST /auth/refresh với body rỗng — trình duyệt tự gửi cookie.
 * - Cookie `erp-auth` (JS đọc được): chỉ hồ sơ/contexts không nhạy cảm, xoá khi logout.
 *
 * Refresh chạy single-flight trong tab và xếp hàng giữa các tab bằng Web Locks
 * (`refreshSession` ở shared/api/axios.ts) để hai tab cùng F5 không bị BE coi là
 * replay token. `src/test/sec-p1-refresh-token-out-of-js.test.ts` khoá các bất biến này.
 */
