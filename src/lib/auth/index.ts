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
 *  TOKEN STORAGE — MEMORY-ONLY (Phase 1 implemented)
 * ═══════════════════════════════════════════════════════
 *
 * ✅ Đã implement Phase 1 - Hybrid Token Storage (2026-07-09):
 * - Access token: Lưu trong memory (không persist) → mất khi F5/đóng tab
 * - Cookie: Chỉ lưu user/contexts (non-sensitive data)
 * - Token không còn trong JS-readable cookie → giảm thiểu XSS risk
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Hướng xử lý PHASE SAU (Phase 2 - P0):                     ║
 * ║  1. Backend thêm `POST /auth/refresh` endpoint               ║
 * ║  2. Backend set HttpOnly cookie cho refresh_token            ║
 * ║  3. FE tự động refresh khi access token hết hạn              ║
 * ║  4. User không phải login lại sau mỗi F5                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Giới hạn hiện tại:
 * - User phải login lại sau mỗi F5 (token mất khi refresh page)
 * - Vẫn có rủi ro XSS trong session (token trong memory)
 *
 * Ref: docs/TOKEN_STORAGE_HARDENING.md, docs/tickets/BE_REFRESH_ENDPOINT_TICKET.md
 */
