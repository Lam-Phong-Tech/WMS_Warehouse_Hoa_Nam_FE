import MuiDrawer, { type DrawerProps } from "@mui/material/Drawer";
import MuiMenu, { type MenuProps } from "@mui/material/Menu";
import MuiPopover, { type PopoverProps } from "@mui/material/Popover";
import { usePageVisible } from "@/shared/ui/page-visibility";

/**
 * Ba overlay primitive của MUI (render qua portal) đi qua `@/shared/ui`, có
 * thêm đúng MỘT việc: không render khi trang chứa nó đang bị giữ sống ở trạng
 * thái ẩn (xem `usePageVisible`). Props/hành vi = MUI nguyên bản; ngoài nhóm
 * keep-alive cờ luôn `true` nên không đổi gì.
 *
 * Không bọc Tooltip/Popper: chúng không có backdrop, tự biến mất khi con trỏ
 * rời đi, và không thể "còn mở" lúc người dùng điều hướng.
 */
export function Drawer(props: DrawerProps) {
  const visible = usePageVisible();
  return visible ? <MuiDrawer {...props} /> : null;
}

export function Menu(props: MenuProps) {
  const visible = usePageVisible();
  return visible ? <MuiMenu {...props} /> : null;
}

export function Popover(props: PopoverProps) {
  const visible = usePageVisible();
  return visible ? <MuiPopover {...props} /> : null;
}
