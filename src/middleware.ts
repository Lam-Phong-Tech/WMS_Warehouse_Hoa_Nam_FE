import { redirect } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Skeleton Middleware
 *
 * Trong Next.js, `middleware.ts` chạy ở Edge để intercept request trước khi tới server.
 * Trong Vite + React Router (SPA), chúng ta mô phỏng logic middleware qua các Route Guards
 * hoặc loader/action functions của `react-router-dom`.
 *
 * File này định nghĩa các core middleware logic để tái sử dụng hoặc export
 * cho các loaders của React Router v7.
 */

export function requireAuthMiddleware() {
  const token = useAuthStore.getState().token;
  if (!token) {
    // Nếu chưa đăng nhập, redirect về trang login
    return redirect("/login");
  }
  return null;
}

export function requireRoleMiddleware(roleName: string) {
  const { currentContext, isSuperAdmin } = useAuthStore.getState();
  const hasRole = isSuperAdmin || currentContext?.role_name === roleName;
  if (!hasRole) {
    // Nếu không có quyền truy cập, redirect về 403 hoặc trang chủ
    return redirect("/403");
  }
  return null;
}
