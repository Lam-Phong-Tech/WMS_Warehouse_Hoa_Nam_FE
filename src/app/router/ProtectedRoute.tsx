import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/store/auth.store';
import { useMe } from '@/modules/auth/hooks/use-me';
import { ROUTES } from '@/shared/constants/routes';
import { Loading } from '@/shared/components';

/**
 * Route guard xác thực — chặn truy cập nếu chưa đăng nhập.
 *
 * Quy trình:
 * 0. Chưa bootstrap xong (rehydrate cookie ở main.tsx chưa resolve) → chờ,
 *    tránh redirect nhầm /login trong lúc `isAuthenticated` còn là giá trị
 *    khởi tạo mặc định (P2 — flash redirect nếu rehydrate không còn đồng bộ).
 * 1. Chưa đăng nhập → redirect /login (giữ trang trước đó trong `state.from`).
 * 2. Đã đăng nhập nhưng chưa nạp profile → hiển thị Loading (tránh flash).
 * 3. Đã đăng nhập + đã nạp profile → render Outlet.
 */
export function ProtectedRoute() {
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const location = useLocation();

  // Nạp hồ sơ/quyền nếu có token (chỉ chạy khi isAuthenticated/token hợp lệ)
  useMe();

  if (!isBootstrapped) {
    return <Loading />;
  }

  // Chưa đăng nhập → đẩy về /login
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  // Đã có token nhưng chưa nạp profile (F5, mới login) → chờ
  if (!isProfileLoaded) {
    return <Loading />;
  }

  return <Outlet />;
}
