import { Button, type ButtonProps } from 'antd';
import {
  usePermissionState,
  hasPermission,
} from '@/modules/auth/utils/permission';
import {
  getPermissionCode,
  type PermissionAction,
} from '@/shared/types/permission';
import { hasScopeForAction } from '@/shared/types/permission.scope';

export interface ActionButtonProps extends ButtonProps {
  /** Module name */
  module: string;
  /** Action type */
  action: PermissionAction;
  /** Permission code cụ thể (ưu tiên) */
  permissionCode?: string;
  /** Mode: 'hide' | 'disable' */
  mode?: 'hide' | 'disable';
  /** Tooltip khi bị disable */
  disabledTooltip?: string;
  /** Icon component */
  icon?: React.ReactNode;
}

/**
 * Button thông minh tự động ẩn/disable theo permission + data scope.
 *
 * **Tích hợp data scope:** Nếu dùng module + action, button tự động kiểm tra
 * scope từ context đang active. VD: user có quyền ORG_CREATE nhưng ở scope
 * 'phong_ban' → button bị ẩn/disable vì không đủ scope để tạo org unit (cần scope ≥ 'co_so').
 *
 * **Lưu ý:** `ActionButtonProps` kế thừa `ButtonProps` từ Ant Design, bao gồm
 * cả `type` (primary, default, dashed, text, link). Không cần truyền `type="primary"`
 * trừ khi muốn ghi đè style mặc định.
 *
 * Usage:
 * ```tsx
 * // Auto-disable nếu không có quyền tạo hoặc scope không đủ
 * <ActionButton module="org_units" action="create">
 *   Thêm mới
 * </ActionButton>
 *
 * // Hide nếu không có quyền xóa hoặc scope không đủ
 * <ActionButton module="org_units" action="delete" mode="hide">
 *   Xóa
 * </ActionButton>
 *
 * // Custom permission code cho special action, VẪN scope-aware vì module/action
 * // luôn bắt buộc — permissionCode chỉ override MÃ permission cần check,
 * // scope requirement vẫn lấy theo module + action (xem OrgUnitsTable action
 * // "archive" dùng permissionCode="ORG_FORCE_DELETE" + module/action="delete").
 * <ActionButton module="org_units" action="delete" permissionCode="ORG_FORCE_DELETE" mode="disable">
 *   Xóa vĩnh viễn
 * </ActionButton>
 * ```
 */
export function ActionButton({
  module,
  action,
  permissionCode,
  mode,
  disabledTooltip = 'Bạn không có quyền thực hiện thao tác này',
  icon,
  children,
  ...buttonProps
}: ActionButtonProps) {
  const state = usePermissionState();
  const resolvedCode = permissionCode ?? getPermissionCode(action, module);
  const hasCodePermission = hasPermission(resolvedCode, state);
  const scopePassed = hasScopeForAction(
    state.currentScopeType,
    module,
    action,
    state.isSuperAdmin,
  );
  const can = hasCodePermission && scopePassed;
  const effectiveMode = mode ?? (hasCodePermission ? 'disable' : 'hide');

  if (effectiveMode === 'hide' && !can) {
    return null;
  }

  const isButtonDisabled = effectiveMode === 'disable' && !can;

  return (
    <Button
      {...buttonProps}
      disabled={isButtonDisabled}
      title={isButtonDisabled ? disabledTooltip : undefined}
      icon={icon}
    >
      {children}
    </Button>
  );
}
