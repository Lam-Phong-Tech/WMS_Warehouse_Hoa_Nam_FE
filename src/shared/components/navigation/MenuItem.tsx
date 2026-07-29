import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export interface MenuItemProps {
  to: string;
  icon?: ReactNode;
  /** Khớp đường dẫn tuyệt đối (mặc định: chỉ active khi trùng hoàn toàn). */
  end?: boolean;
  children: ReactNode;
}

/**
 * Mục điều hướng dạng link, tự đánh dấu active theo route hiện tại.
 * Menu chính của admin dùng antd Menu (`app/layouts/menu`); MenuItem hợp cho
 * thanh điều hướng phụ/tuỳ biến ngoài antd Menu.
 */
export function MenuItem({ to, icon, end, children }: MenuItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        fontWeight: isActive ? 600 : 400,
      })}
    >
      {icon}
      {children}
    </NavLink>
  );
}
