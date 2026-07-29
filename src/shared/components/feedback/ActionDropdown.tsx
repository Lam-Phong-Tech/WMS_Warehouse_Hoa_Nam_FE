import { Dropdown, Button } from "antd";
import type { MenuProps } from "antd";
import { EditOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import {
  usePermissionState,
  hasPermission,
} from "@/modules/auth/utils/permission";
import {
  getPermissionCode,
  type PermissionAction,
} from "@/shared/types/permission";
import { hasScopeForAction } from "@/shared/types/permission.scope";

export interface ActionItem {
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  /**
   * @deprecated Dùng `module` + `action` (kèm `permissionCode` nếu cần mã tùy
   * biến) — nhánh này KHÔNG kiểm tra data scope. Chỉ giữ lại cho action không
   * gắn với module/scope nào (hiếm khi cần).
   */
  permission?: string;
  /** Module name (cách mới, dùng với action). */
  module?: string;
  /** Action type (cách mới). */
  action?: PermissionAction;
  /** Permission code tùy biến, ưu tiên hơn mapping mặc định của module+action nhưng vẫn giữ scope check theo module+action. */
  permissionCode?: string;
}

export interface ActionDropdownProps {
  items: ActionItem[];
  /** Tooltip text */
  tooltip?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * Dropdown thao tác — hiển thị icon bút, bấm vào sổ ra danh sách các nút thao tác.
 * Dùng cho các cột "Thao tác" trong bảng để gom các action (Sửa, Vô hiệu, Xóa, ...)
 * trong khi action Xem (nếu có) vẫn hiển thị riêng bên ngoài.
 *
 * Mỗi ActionItem có thể có optional `permission` (cách cũ) hoặc `module` + `action`
 * (cách mới, chuẩn hóa). Nếu có, sẽ tự động lọc dựa trên quyền hiện tại để tránh
 * hiển thị action mà user không có quyền. Việc resolve permission code và kiểm tra
 * quyền dùng HÀM THUẦN (getPermissionCode, hasPermission) trên state đã lấy từ
 * usePermissionState() — gọi hook ĐÚNG 1 LẦN, không gọi trong vòng lặp.
 */
export function ActionDropdown({
  items,
  tooltip = "Thao tác",
  icon = <EditOutlined />,
  disabled = false,
}: ActionDropdownProps) {
  // Hook được gọi ĐÚNG 1 LẦN (không điều kiện, không trong loop)
  const state = usePermissionState();

  // Lọc items: chỉ giữ những item không có permission/module-action hoặc user có quyền.
  // Resolve code bằng hàm thuần (KHÔNG PHẢI HOOK) → tuân thủ Rules of Hooks.
  const visibleItems = items.filter((item) => {
    if (item.module && item.action) {
      const permissionCode = getPermissionCode(
        item.action,
        item.module,
        item.permissionCode,
      );
      const scopePassed = hasScopeForAction(
        state.currentScopeType,
        item.module,
        item.action,
        state.isSuperAdmin,
      );
      return hasPermission(permissionCode, state) && scopePassed;
    }
    if (item.permission) {
      return hasPermission(item.permission, state);
    }
    return true;
  });

  const menuItems: MenuProps["items"] = visibleItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    danger: item.danger,
    disabled: item.disabled || item.loading,
    onClick: item.onClick,
  }));

  // Nếu không còn item nào sau khi lọc, ẩn hoàn toàn dropdown
  if (visibleItems.length === 0) return null;

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={["click"]}
      placement="bottomRight"
      disabled={disabled}
    >
      <Button
        type="text"
        size="small"
        icon={icon}
        title={tooltip}
        disabled={disabled}
      />
    </Dropdown>
  );
}
