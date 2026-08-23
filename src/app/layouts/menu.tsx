import type { ReactNode } from "react";
import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BarcodeOutlined,
  FileTextOutlined,
  FundOutlined,
  HomeOutlined,
  InboxOutlined,
  ProfileOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShopOutlined,
  StockOutlined,
  SwapOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
  WarningOutlined,
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
export const MENU: AppMenuItem[] = [
  {
    key: "overview",
    label: "00 · Tổng quan",
    icon: <BarChartOutlined />,
    children: [
      {
        key: ROUTES.DASHBOARD,
        label: "Tổng quan WMS",
        icon: <BarChartOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.DASHBOARD],
      },
    ],
  },
  {
    key: "foundation",
    label: "01 · Hệ thống & danh mục",
    icon: <SettingOutlined />,
    children: [
      {
        key: ROUTES.IAM_USERS,
        label: "Người dùng",
        icon: <TeamOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.IAM_USERS],
      },
      {
        key: ROUTES.IAM_ROLES,
        label: "Vai trò & phân quyền",
        icon: <SafetyCertificateOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.IAM_ROLES],
      },
      {
        key: ROUTES.MASTER_DATA,
        label: "SKU / Product Master",
        icon: <ProfileOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.MASTER_DATA],
      },
      {
        key: ROUTES.CATALOG_MASTER,
        label: "Danh mục Product Master",
        icon: <AppstoreOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.CATALOG_MASTER],
      },
      {
        key: ROUTES.WAREHOUSE_CONFIG,
        label: "Cấu hình kho",
        icon: <HomeOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.WAREHOUSE_CONFIG],
      },
      {
        key: ROUTES.AGENCIES,
        label: "Đại lý / nơi nhận",
        icon: <ShopOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.AGENCIES],
      },
      {
        key: ROUTES.DEFECTS,
        label: "Danh mục bệnh / lỗi",
        icon: <WarningOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.DEFECTS],
      },
      {
        key: ROUTES.SCAN,
        label: "Mã vật lý",
        icon: <BarcodeOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.SCAN],
      },
    ],
  },
  {
    key: "inbound-group",
    label: "02 · Nhập kho",
    icon: <InboxOutlined />,
    children: [
      {
        key: ROUTES.INBOUND,
        label: "Phiếu nhập & Full Post",
        icon: <InboxOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.INBOUND],
      },
      {
        key: ROUTES.PUTAWAY,
        label: "Putaway linh kiện",
        icon: <SwapOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.PUTAWAY],
      },
    ],
  },
  {
    key: "outbound-group",
    label: "03 · Xuất kho",
    icon: <StockOutlined />,
    children: [
      {
        key: ROUTES.OUTBOUND,
        label: "Phiếu xuất & Post Issue",
        icon: <StockOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.OUTBOUND],
      },
    ],
  },
  {
    key: "warranty-group",
    label: "04 · Bảo hành & linh kiện",
    icon: <ToolOutlined />,
    children: [
      {
        key: ROUTES.WARRANTY,
        label: "Bảo hành & xuất linh kiện",
        icon: <ToolOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.WARRANTY],
      },
    ],
  },
  {
    key: "wms-remaining",
    label: "Nghiệp vụ WMS khác",
    icon: <ShopOutlined />,
    children: [
      {
        key: ROUTES.INVENTORY,
        label: "Tồn & truy vết",
        icon: <FundOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.INVENTORY],
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
      {
        key: ROUTES.COMPONENT_CATALOG,
        label: "Component catalog",
        icon: <AppstoreOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.COMPONENT_CATALOG],
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
function splitKey(key: string) {
  const idx = key.indexOf("?");
  return idx === -1
    ? { path: key, query: "" }
    : { path: key.slice(0, idx), query: key.slice(idx) };
}
function matchesPath(key: string, pathname: string, search = "") {
  const { path, query } = splitKey(key);
  const pathMatches =
    path === pathname || (path !== "/" && pathname.startsWith(`${path}/`));
  return pathMatches && (query === "" || query === search);
}
function findMatchingItem(items: AppMenuItem[], pathname: string, search = "") {
  const specific = items.find(
    (c) => splitKey(c.key).query !== "" && matchesPath(c.key, pathname, search),
  );
  return (
    specific ??
    items.find(
      (c) =>
        splitKey(c.key).query === "" && matchesPath(c.key, pathname, search),
    )
  );
}
export function getBreadcrumb(pathname: string, search = ""): Crumb[] {
  for (const top of MENU) {
    if (matchesPath(top.key, pathname, search))
      return [{ label: top.label, path: top.key }];
    const child = findMatchingItem(top.children ?? [], pathname, search);
    if (child)
      return [{ label: top.label }, { label: child.label, path: child.key }];
  }
  return [];
}
export function getOpenKeys(pathname: string, search = "") {
  return MENU.filter((top) =>
    top.children?.some((c) => matchesPath(c.key, pathname, search)),
  ).map((top) => top.key);
}
export function getSelectedKey(pathname: string, search = "") {
  for (const top of MENU) {
    if (top.key === pathname) return top.key;
    const child = findMatchingItem(top.children ?? [], pathname, search);
    if (child) return child.key;
  }
  return pathname;
}
