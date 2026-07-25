import { useMemo } from 'react';
import {
  type PermissionMode,
  type PermissionContext,
  getPermissionCode,
} from '@/shared/types/permission';
import {
  usePermissionState,
  hasPermission,
} from '@/modules/auth/utils/permission';
import { hasScopeForAction } from '@/shared/types/permission.scope';

/**
 * @internal Không import file này trực tiếp trong code ứng dụng — dùng
 * `import { usePermission } from '@/shared/components/permission'` (public
 * API, xem README.md cùng thư mục). Import trực tiếp bị chặn bởi ESLint
 * `no-restricted-imports` (eslint.config.js), trừ các file nội bộ triển
 * khai hệ thống permission (barrel, PermissionGuard, ActionButton, ...).
 */

/**
 * Hook kiểm soát permission theo action + module.
 *
 * **Tích hợp data scope:** Bên cạnh kiểm tra permission code, hook này còn
 * kiểm tra data scope của context đang active có đủ rộng để thực hiện action
 * không (dựa trên `MODULE_SCOPE_REQUIREMENTS` trong permission.scope.ts).
 *
 * Usage:
 * ```tsx
 * const { can, mode, isHidden, isDisabled } = usePermission({
 *   module: 'org_units',
 *   action: 'create',
 *   mode: 'hide', // hoặc 'disable'
 * });
 *
 * if (isHidden) return null;
 * if (isDisabled) return <Button disabled>Thêm</Button>;
 * ```
 *
 * **Scope ảnh hưởng thế nào?**
 * - Nếu permission code không có (vd ORG_CREATE) → `can = false` (giữ nguyên)
 * - Nếu permission code có NHƯNG scope hiện tại không đủ rộng (vd tạo org unit
 *   khi đang ở scope 'phong_ban') → `can = false` (BỔ SUNG)
 * - Nếu module + action không có scope requirement → chỉ check permission code
 */
export function usePermission(context: PermissionContext): {
  /** Có quyền hay không (xét CẢ permission code lẫn data scope) */
  can: boolean;
  /** Mode hiện tại */
  mode: PermissionMode;
  /** Ẩn hoàn toàn (mode === 'hide' && !can) */
  isHidden: boolean;
  /** Disable (mode === 'disable' && !can) */
  isDisabled: boolean;
  /** Permission code đang check */
  permissionCode: string;
} {
  const { module, action, permissionCode: customCode, mode = 'hide' } = context;

  // Resolve permission code (hàm thuần, không phải hook)
  const resolvedCode = useMemo(() => {
    if (customCode) return customCode;
    if (action && module) {
      return getPermissionCode(action, module);
    }
    // Fallback: dùng chính module name (không nên xảy ra)
    return (module ?? '').toUpperCase();
  }, [module, action, customCode]);

  // Đọc state quyền TẬP TRUNG (gọi hook đúng 1 lần, không điều kiện)
  // State đã bao gồm currentScopeType (từ AuthContext)
  const state = usePermissionState();

  // Bước 1: Kiểm tra permission code
  const hasCodePermission = hasPermission(resolvedCode, state);

  // Bước 2: Kiểm tra data scope (nếu có module + action)
  // Super admin (isSuperAdmin = true) luôn bypass scope check vì họ có quyền
  // trên toàn bộ dữ liệu, không bị giới hạn bởi context scope.
  // User thường bị enforce scope theo MODULE_SCOPE_REQUIREMENTS.
  const scopePassed = hasScopeForAction(
    state.currentScopeType,
    module ?? '',
    action,
    state.isSuperAdmin,
  );

  // Kết quả cuối cùng: CẦN CẢ permission code lẫn scope đều pass
  const can = hasCodePermission && scopePassed;

  return {
    can,
    mode,
    isHidden: mode === 'hide' && !can,
    isDisabled: mode === 'disable' && !can,
    permissionCode: resolvedCode,
  };
}

/**
 * Tiện ích: kiểm tra nhiều permission cùng lúc (OR logic).
 * Dùng cho các trường hợp cần 1 trong nhiều quyền.
 *
 * LƯU Ý: chỉ gọi usePermissionState() ĐÚNG 1 LẦN ở đầu hook,
 * sau đó tính toán trên giá trị thuần (hasPermission) bên trong .some().
 * KHÔNG gọi hook bên trong callback → tuân thủ Rules of Hooks.
 */
export function useCanAny(codes: string[]): boolean {
  const state = usePermissionState();
  return codes.some((code) => hasPermission(code, state));
}

/**
 * Tiện ích: kiểm tra nhiều permission cùng lúc (AND logic).
 * Dùng cho các trường hợp cần tất cả quyền.
 *
 * Tương tự useCanAny: gọi usePermissionState() 1 lần, tính trên giá trị thuần.
 */
export function useCanAll(codes: string[]): boolean {
  const state = usePermissionState();
  return codes.every((code) => hasPermission(code, state));
}
