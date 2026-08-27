import { useState } from "react";
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ThemeProvider,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  ACTION_KINDS,
  ActionIconButton,
  actionIcon,
  type ActionKind,
} from "@/shared/components/actions";
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
  /**
   * Hanh dong chuan - quyet dinh icon + mau + nhan mac dinh, giong
   * ActionButton. Uu tien dung thay cho `icon` thu cong de muc trong menu
   * khong lech voi nut ngoai bang.
   */
  kind?: ActionKind;
  /** Icon tu khai - chi dung khi hanh dong chua co `kind` tuong ung. */
  icon?: ReactNode;
  label?: ReactNode;
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
  /** Tooltip + aria-label cho nút mở menu. */
  tooltip?: string;
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
 *
 * Bọc ThemeProvider cục bộ (thay vì trông cậy theme của trang cha) vì component
 * này thường được render bên trong ô của bảng antd (Table column render) — cây
 * render đó không chắc nằm trong 1 ThemeProvider MUI nào của trang cha.
 */
export function ActionDropdown({
  items,
  tooltip = "Thao tác",
  disabled = false,
}: ActionDropdownProps) {
  // Hook được gọi ĐÚNG 1 LẦN (không điều kiện, không trong loop)
  const state = usePermissionState();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

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

  // Nếu không còn item nào sau khi lọc, ẩn hoàn toàn dropdown
  if (visibleItems.length === 0) return null;

  const handleClose = () => setAnchorEl(null);

  return (
    <ThemeProvider theme={muiTheme}>
      <ActionIconButton
        kind="more"
        label={tooltip}
        disabled={disabled}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      />
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {visibleItems.map((item) => (
          <MenuItem
            key={item.key}
            disabled={item.disabled || item.loading}
            sx={item.danger ? { color: "error.main" } : undefined}
            onClick={() => {
              handleClose();
              item.onClick();
            }}
          >
            {(item.kind || item.icon) && (
              <ListItemIcon sx={{ color: "inherit" }}>
                {item.kind ? actionIcon(item.kind) : item.icon}
              </ListItemIcon>
            )}
            <ListItemText>
              {item.label ?? (item.kind ? ACTION_KINDS[item.kind].label : null)}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </ThemeProvider>
  );
}
