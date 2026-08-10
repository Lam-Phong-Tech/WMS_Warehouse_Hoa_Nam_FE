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
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const can = (code: string) => isSuperAdmin || permissionCodes.includes(code);

  const [prevPathname, setPrevPathname] = useState(location.pathname);
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    getOpenKeys(location.pathname, location.search),
  );

  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setOpenKeys((previous) => {
      const required = getOpenKeys(location.pathname, location.search);
      const merged = [...new Set([...previous, ...required])];
      return merged.length === previous.length &&
        merged.every((key) => previous.includes(key))
        ? previous
        : merged;
    });
  }

  return (
    <nav
      data-testid="primary-navigation"
      aria-label="Điều hướng chính"
      style={{ height: "100%" }}
    >
      <div style={layoutStyles.sideNavBrand}>
        <span style={layoutStyles.sideNavBrandIcon}>HN</span>
        {!collapsed && <span>Hoa Nam WMS</span>}
      </div>

      <Menu
        theme="light"
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
    </nav>
  );
}
