import { useMemo, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  usePermissionState,
  hasPermission,
} from '@/modules/auth/utils/permission';
import { useAuthStore } from '@/shared/store/auth.store';
import { Loading } from '@/shared/components';
import { ROUTES } from '@/shared/constants/routes';

interface Props {
  /**
   * Mã quyền cần có để vào route. Bỏ trống = ai đăng nhập cũng vào được.
   * Truyền mảng = OR (chỉ cần 1 trong các quyền là vào được) — dùng khi
   * route gộp nhiều tab/action có quyền tối thiểu khác nhau, và từng
   * tab/action con tự guard quyền cụ thể hơn.
   */
  permission?: string | string[];
  children: ReactNode;
}

/**
 * Chặn truy cập route theo quyền (không chỉ ẩn menu/nút).
 * Quyền nạp qua GET /auth/me — chờ `isProfileLoaded` để tránh chặn nhầm khi F5.
 *
 * Khi không có quyền → redirect `/errors/403` thay vì render inline,
 * đảm bảo guard dùng đúng NoPermissionPage và URL phản ánh trạng thái lỗi.
 * Route /errors/403 được định nghĩa ở router index.
 */
export function RequirePermission({ permission, children }: Props) {
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const state = usePermissionState();
  const codes = Array.isArray(permission) ? permission : [permission ?? ''];
  const allowed = codes.some((code) => hasPermission(code, state));
  const location = useLocation();
  // Object literal ổn định theo pathname+search — nếu tạo mới mỗi render,
  // <Navigate> (component vẫn mount lại khi không nằm trong <Routes> khớp
  // route, vd test render trực tiếp) sẽ nhận state khác identity mỗi lần,
  // khiến effect điều hướng của nó chạy lại vô hạn (redirect loop treo/OOM).
  const from = location.pathname + location.search;
  const navigateState = useMemo(() => ({ from }), [from]);

  if (!permission) return <>{children}</>;

  // Quyền chưa nạp xong (vừa F5) — chờ, đừng vội báo 403.
  if (!isProfileLoaded) return <Loading />;

  if (!allowed) {
    // Redirect tới NoPermissionPage, giữ lại route định đến để debug/reference
    return <Navigate to={ROUTES.NO_PERMISSION} replace state={navigateState} />;
  }

  return <>{children}</>;
}
