import { useState } from "react";
import { Menu } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import {
  filterMenu,
  getOpenKeys,
  getSelectedKey,
  MENU,
  toMenuItems,
} from "@/app/layouts/menu";
import { layoutStyles } from "@/app/layouts/layout.styles";
import { useAuthStore } from "@/shared/store/auth.store";

interface Props {
  /** Đang thu gọn (ẩn chữ thương hiệu) — chỉ áp dụng cho Sider desktop. */
  collapsed?: boolean;
  /** Gọi sau khi điều hướng (vd đóng Drawer trên mobile). */
  onNavigate?: () => void;
}

export function SideNav({ collapsed = false, onNavigate }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  // Standalone mode: hiển thị tất cả menu items không lọc quyền
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const can = (code: string) => isSuperAdmin || permissionCodes.includes(code);

  // Controlled openKeys thay vì defaultOpenKeys (P2): defaultOpenKeys chỉ áp
  // dụng lần render đầu — điều hướng bằng code (breadcrumb, link ngoài menu)
  // sang route ở nhóm khác không tự mở submenu tương ứng. Merge thay vì thay
  // thế để không đóng lại nhóm user đã tự mở tay.
  //
  // Đồng bộ openKeys theo pathname bằng cách điều chỉnh state ngay trong
  // render (so sánh với `prevPathname`) thay vì `setState` trong `useEffect`
  // — pattern React khuyến nghị cho "adjusting state when props change",
  // tránh render thừa 1 nhịp mà `react-hooks/set-state-in-effect` cảnh báo.
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    getOpenKeys(location.pathname, location.search),
  );

  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setOpenKeys((prev) => {
      const needed = getOpenKeys(location.pathname, location.search);
      const merged = [...new Set([...prev, ...needed])];
      return merged.length === prev.length &&
        merged.every((k) => prev.includes(k))
        ? prev
        : merged;
    });
  }

  return (
    <>
      <div style={layoutStyles.sideNavBrand}>
        <span style={layoutStyles.sideNavBrandIcon}>E</span>
        {!collapsed && <span>Hoa Nam</span>}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedKey(location.pathname, location.search)]}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={toMenuItems(filterMenu(MENU, can))}
        onClick={({ key }) => {
          navigate(key);
          onNavigate?.();
        }}
        style={{
          borderInlineEnd: "none",
          paddingBottom: 24,
        }}
      />
    </>
  );
}
