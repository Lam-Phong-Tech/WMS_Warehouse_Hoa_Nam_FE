import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  usePermissionState,
  hasPermission,
} from "@/modules/auth/utils/permission";
import {
  type PermissionAction,
  getPermissionCode,
} from "@/shared/types/permission";
import { hasScopeForAction } from "@/shared/types/permission.scope";

export interface CanProps {
  /** Mã quyền cần có để hiển thị children (cách cũ). */
  permission?: string;
  /** Module name (cách mới, dùng với action). */
  module?: string;
  /** Action type (cách mới). */
  action?: PermissionAction;
  children: ReactNode;
  /** Nội dung thay thế khi không đủ quyền (mặc định ẩn). */
  fallback?: ReactNode;
}

/**
 * Cổng hiển thị theo quyền: chỉ render children nếu có quyền.
 *
 * **Tích hợp data scope:** Khi dùng cách mới (module + action), component tự động
 * kiểm tra data scope từ context đang active. VD: user có quyền ORG_CREATE nhưng
 * ở scope 'phong_ban' → children bị ẩn vì không đủ scope.
 *
 * Usage (cách cũ - permission code trực tiếp):
 * ```tsx
 * <Can permission="ORG_CREATE">
 *   <Button>Thêm mới</Button>
 * </Can>
 * ```
 *
 * Usage (cách mới - action + module):
 * ```tsx
 * <Can module="org_units" action="create">
 *   <Button>Thêm mới</Button>
 * </Can>
 * ```
 *
 * LƯU Ý KIẾN TRÚC (Rules of Hooks):
 * Component này LUÔN gọi `usePermissionState()` và `useMemo()` ở đầu hàm,
 * KHÔNG BAO GIỜ gọi hook bên trong nhánh `if`. Việc resolve permission code
 * và kiểm tra quyền được thực hiện bằng HÀM THUẦN (getPermissionCode, hasPermission, hasScopeForAction)
 * trên giá trị state đã lấy. Thứ tự hook là HẰNG SỐ bất kể props thay đổi.
 */
export function Can({
  permission,
  module,
  action,
  children,
  fallback = null,
}: CanProps) {
  // Hook được gọi KHÔNG ĐIỀU KIỆN (luôn cùng thứ tự)
  const state = usePermissionState();

  // Resolve permission code từ props bằng hàm thuần (KHÔNG PHẢI HOOK)
  const resolvedCode = useMemo(() => {
    if (permission) return permission;
    if (module && action) return getPermissionCode(action, module);
    return null;
  }, [permission, module, action]);

  // Không có permission nào được truyền -> render children bình thường
  if (!resolvedCode) {
    return <>{children}</>;
  }

  // Kiểm tra quyền trên state thuần (KHÔNG PHẢI HOOK)
  const hasCodePermission = hasPermission(resolvedCode, state);

  // Kiểm tra data scope (nếu có module + action)
  // Super admin (isSuperAdmin = true) luôn bypass scope check
  const scopePassed =
    module && action
      ? hasScopeForAction(
          state.currentScopeType,
          module,
          action,
          state.isSuperAdmin,
        )
      : true;

  const can = hasCodePermission && scopePassed;
  return <>{can ? children : fallback}</>;
}
