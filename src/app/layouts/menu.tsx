import type { ReactNode } from "react";
import {
  ProfileOutlined,
  SettingOutlined,
  AuditOutlined,
  ShopOutlined,
  BarChartOutlined,
  InboxOutlined,
  FileTextOutlined,
  StockOutlined,
  FundOutlined,
  BarcodeOutlined,
  RollbackOutlined,
  ExperimentOutlined,
  ToolOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { ROUTES } from "@/shared/constants/routes";
import { ROUTE_PERMISSIONS } from "@/app/router/access";

export interface AppMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  permission?: string | string[];
  children?: AppMenuItem[];
}

// Nguồn duy nhất cho cả sidebar và breadcrumb.
export const MENU: AppMenuItem[] = [
  {
    key: "wms",
    label: "Quản lý kho · WMS",
    icon: <ShopOutlined />,
    children: [
      {
        key: ROUTES.DASHBOARD,
        label: "Tổng quan",
        icon: <BarChartOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.DASHBOARD],
      },
      {
        key: ROUTES.MASTER_DATA,
        label: "Danh mục & SKU",
        icon: <ProfileOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.MASTER_DATA],
      },
      {
        key: ROUTES.SCAN,
        label: "Mã vật lý",
        icon: <BarcodeOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.SCAN],
      },
      {
        key: ROUTES.INBOUND,
        label: "Nhập kho",
        icon: <InboxOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.INBOUND],
      },
      {
        key: ROUTES.PUTAWAY,
        label: "Cất hàng",
        icon: <SwapOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.PUTAWAY],
      },
      {
        key: ROUTES.OUTBOUND,
        label: "Xuất kho",
        icon: <StockOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.OUTBOUND],
      },
      {
        key: ROUTES.INVENTORY,
        label: "Tồn & truy vết",
        icon: <FundOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.INVENTORY],
      },
      {
        key: ROUTES.STOCKTAKE,
        label: "Kiểm kê",
        icon: <ExperimentOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.STOCKTAKE],
      },
      {
        key: ROUTES.WARRANTY,
        label: "Bảo hành",
        icon: <ToolOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.WARRANTY],
      },
      {
        key: ROUTES.REVERSE,
        label: "Đảo ngược",
        icon: <RollbackOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.REVERSE],
      },
      {
        key: ROUTES.REPORTS,
        label: "Báo cáo",
        icon: <FileTextOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.REPORTS],
      },
    ],
  },
  {
    key: "system",
    label: "Hệ thống",
    icon: <SettingOutlined />,
    children: [
      {
        key: ROUTES.AUDIT_LOGS,
        label: "Nhật ký kiểm tra",
        icon: <AuditOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.AUDIT_LOGS],
      },
    ],
  },
  {
    key: "account",
    label: "Tài khoản",
    icon: <UserOutlined />,
    children: [
      {
        key: ROUTES.PROFILE,
        label: "Hồ sơ cá nhân",
        icon: <UserOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.PROFILE],
      },
    ],
  },
];

/** Lọc menu theo quyền; bỏ nhóm nếu không còn mục con nào. */
export function filterMenu(
  items: AppMenuItem[],
  can: (code: string) => boolean,
): AppMenuItem[] {
  return items
    .map((item) => {
      if (item.children) {
        const children = filterMenu(item.children, can);
        return children.length ? { ...item, children } : null;
      }
      if (item.permission) {
        const permissions = Array.isArray(item.permission)
          ? item.permission
          : [item.permission];
        if (!permissions.some((p) => can(p))) return null;
      }
      return item;
    })
    .filter((item): item is AppMenuItem => item !== null);
}

/** Chuyển cấu hình sang dạng items của antd Menu. */
export function toMenuItems(items: AppMenuItem[]): MenuProps["items"] {
  return items.map((it) => ({
    key: it.key,
    icon: it.icon,
    label: it.label,
    children: it.children ? toMenuItems(it.children) : undefined,
  }));
}

export interface Crumb {
  label: string;
  path?: string;
}

function splitKey(key: string): { path: string; query: string } {
  const idx = key.indexOf("?");
  return idx === -1
    ? { path: key, query: "" }
    : { path: key.slice(0, idx), query: key.slice(idx) };
}

function matchesPath(
  key: string,
  pathname: string,
  search: string = "",
): boolean {
  const { path, query } = splitKey(key);
  const pathMatches =
    path === pathname || (path !== "/" && pathname.startsWith(`${path}/`));
  if (!pathMatches) return false;
  return query === "" || query === search;
}

function findMatchingItem(
  items: AppMenuItem[],
  pathname: string,
  search: string = "",
): AppMenuItem | undefined {
  const specific = items.find(
    (c) => splitKey(c.key).query !== "" && matchesPath(c.key, pathname, search),
  );
  if (specific) return specific;
  return items.find(
    (c) => splitKey(c.key).query === "" && matchesPath(c.key, pathname, search),
  );
}

/** Tìm "vết" breadcrumb cho path hiện tại dựa trên cấu hình menu. */
export function getBreadcrumb(pathname: string, search: string = ""): Crumb[] {
  for (const top of MENU) {
    if (matchesPath(top.key, pathname, search))
      return [{ label: top.label, path: top.key }];
    const child = findMatchingItem(top.children ?? [], pathname, search);
    if (child) {
      return [{ label: top.label }, { label: child.label, path: child.key }];
    }
  }
  return [];
}

/** Các submenu cần mở sẵn theo path hiện tại. */
export function getOpenKeys(pathname: string, search: string = ""): string[] {
  return MENU.filter((top) =>
    top.children?.some((c) => matchesPath(c.key, pathname, search)),
  ).map((top) => top.key);
}

/** Tìm key menu cha để highlight đúng selectedKeys cho sub-route. */
export function getSelectedKey(pathname: string, search: string = ""): string {
  for (const top of MENU) {
    if (top.key === pathname) return top.key;
    const child = findMatchingItem(top.children ?? [], pathname, search);
    if (child) return child.key;
  }
  return pathname;
}
