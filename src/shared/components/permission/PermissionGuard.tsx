import type { ReactNode } from "react";
import React from "react";
import { usePermission } from "@/shared/hooks/usePermission";
import type {
  PermissionMode,
  PermissionAction,
} from "@/shared/types/permission";
import { useT } from "@/shared/i18n/useT";
export interface PermissionGuardProps {
  children: ReactNode;
  /** Module name, ví dụ: 'org_units', 'departments'. Bắt buộc nếu dùng `action`, optional nếu dùng `permissionCode` trực tiếp. */
  module?: string;
  /** Action type, ví dụ: 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'import' | 'view' */
  action?: PermissionAction;
  /** Permission code cụ thể (ưu tiên hơn action) */
  permissionCode?: string;
  /** Cách xử lý khi thiếu quyền */
  mode?: PermissionMode;
  /** Fallback UI khi bị ẩn/disable */
  fallback?: ReactNode;
  /** Custom class name */
  className?: string;
  /** Tooltip chuẩn khi disable (chỉ áp dụng khi mode='disable') */
  disabledTooltip?: string;
}

/**
 * Wrapper component kiểm soát quyền truy cập (UX layer).
 *
 * ⚠️ **QUAN TRỌNG - Defense-in-depth only:**
 * PermissionGuard chỉ là lớp UX/defense-in-depth ở phía Frontend.
 * Backend VẪN phải enforce 403/data scope ở API layer.
 * FE guard KHÔNG được xem là authorization chính.
 * Nếu user bypass FE guard và gọi API trực tiếp, BE phải từ chối.
 *
 * **Tích hợp data scope:** Tự động kiểm tra data scope từ context đang active.
 * VD: user có quyền ORG_CREATE nhưng đang ở scope 'phong_ban' → action sẽ bị
 * ẩn/disable vì không đủ scope để tạo org unit (cần scope ≥ 'co_so').
 *
 * Usage:
 * ```tsx
 * // Hide mode - ẩn hoàn toàn khi thiếu quyền
 * <PermissionGuard module="org_units" action="create">
 *   <ActionButton
  kind="create"
>Thêm mới</ActionButton>
 * </PermissionGuard>
 *
 * // Disable mode - disable khi thiếu quyền
 * <PermissionGuard module="org_units" action="edit" mode="disable">
 *   <ActionButton
  kind="edit"
>Sửa</ActionButton>
 * </PermissionGuard>
 *
 * // Special action (scope-aware pattern) — Dùng cho action đặc biệt như
 * // ORG_FORCE_DELETE: vẫn truyền module+action để giữ scope check, kèm
 * // permissionCode riêng để override permission code mặc định.
 * // Pattern: module="org_units" action="delete" permissionCode="ORG_FORCE_DELETE"
 * <PermissionGuard module="org_units" action="delete" permissionCode="ORG_FORCE_DELETE">
 *   <ActionButton
  kind="delete"
>Xóa vĩnh viễn</ActionButton>
 * </PermissionGuard>
 *
 * // Custom permission code KHÔNG kèm `module`/`action` → hook không có đủ
 * // thông tin để tra MODULE_SCOPE_REQUIREMENTS nên bỏ qua scope check, chỉ
 * // còn permission code quyết định `can`. CẢNH BÁO: không dùng pattern này
 * // để "lách" scope cho các action vốn đã có module + action tương ứng
 * // (create/edit/delete/export/import) — luôn truyền `module`/`action` khi
 * // có, chỉ dùng permissionCode-only cho quyền không gắn với 1 module cụ
 * // thể (vd quyền hệ thống không có module tương ứng).
 * <PermissionGuard permissionCode="SOME_SYSTEM_WIDE_PERMISSION">
 *   <ActionButton kind="settings">Hành động hệ thống</ActionButton>
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  children,
  module,
  action,
  permissionCode,
  mode = "hide",
  fallback = null,
  className,
  disabledTooltip,
}: PermissionGuardProps) {
  const t = useT();
  const resolvedDisabledTooltip =
    disabledTooltip ?? t("shared.states.noPermissionAction");
  const { isHidden, isDisabled } = usePermission({
    module,
    action,
    permissionCode,
    mode,
  });

  // Hide mode: không render gì cả
  if (mode === "hide" && isHidden) {
    return <>{fallback}</>;
  }

  // Disable mode: wrap children và disable nếu cần
  if (mode === "disable" && isDisabled) {
    return (
      <span
        className={className}
        style={{ opacity: 0.5, cursor: "not-allowed" }}
        title={resolvedDisabledTooltip}
      >
        {cloneAndDisable(children)}
      </span>
    );
  }

  // Có quyền: render bình thường qua Fragment (không bọc div gây vỡ layout flex/Space)
  return <>{children}</>;
}

/**
 * Clone children và thêm disabled prop nếu là button/input
 */
function cloneAndDisable(children: ReactNode): ReactNode {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    // Nếu là button hoặc element có thể disable
    if (child.type === "button" || child.type === "input") {
      return React.cloneElement(
        child as React.ReactElement<{ disabled?: boolean }>,
        {
          disabled: true,
          onClick: undefined,
          onChange: undefined,
        } as Record<string, unknown>,
      );
    }

    // Nếu là Ant Design Button
    const typeStr = String(child.type);
    if (typeStr.includes("Button") || typeStr.includes("button")) {
      return React.cloneElement(
        child as React.ReactElement<{ disabled?: boolean }>,
        {
          disabled: true,
          onClick: undefined,
        } as Record<string, unknown>,
      );
    }

    // Recursively process children
    if (
      child.props &&
      typeof child.props === "object" &&
      "children" in child.props
    ) {
      return React.cloneElement(
        child as React.ReactElement<{ children?: ReactNode }>,
        {
          children: cloneAndDisable(
            (child.props as { children?: ReactNode }).children,
          ),
        } as Record<string, unknown>,
      );
    }

    return child;
  });
}
