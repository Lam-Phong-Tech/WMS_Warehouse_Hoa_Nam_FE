import type { ReactNode } from 'react';
import {
  ApartmentOutlined,
  ClusterOutlined,
  IdcardOutlined,
  ProfileOutlined,
  SettingOutlined,
  SolutionOutlined,
  NodeIndexOutlined,
  SwapOutlined,
  UserSwitchOutlined,
  AuditOutlined,
  ShopOutlined,
  BarChartOutlined,
  ShoppingCartOutlined,
  FundOutlined,
  InboxOutlined,
  FileTextOutlined,
  StockOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { ROUTES } from '@/shared/constants/routes';
import { ROUTE_PERMISSIONS } from '@/app/router/access';

export interface AppMenuItem {
  key: string; // route path (mục lá) hoặc id nhóm (submenu)
  label: string;
  icon?: ReactNode;
  /** Mã quyền cần có để thấy mục này (bỏ trống = luôn hiện). */
  permission?: string | string[];
  children?: AppMenuItem[];
}

// Nguồn duy nhất cho cả sidebar và breadcrumb. Thêm mục mới chỉ sửa ở đây.
export const MENU: AppMenuItem[] = [
  {
    key: 'org',
    label: 'Module 1 · Tổ chức',
    icon: <ApartmentOutlined />,
    children: [
      {
        key: ROUTES.ORG_UNITS,
        label: 'Đơn vị tổ chức',
        icon: <ApartmentOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.ORG_UNITS],
      },
      {
        // Branch-mode của /org-units (không phải page riêng, xem OrgUnitsPage.tsx)
        key: ROUTES.ORG_UNITS_BRANCHES,
        label: 'Chi nhánh',
        icon: <ShopOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.ORG_UNITS],
      },
      {
        key: ROUTES.DEPARTMENTS,
        label: 'Phòng ban',
        icon: <ClusterOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.DEPARTMENTS],
      },
      {
        key: ROUTES.EMPLOYEES,
        label: 'Nhân viên',
        icon: <IdcardOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.EMPLOYEES],
      },
      {
        key: ROUTES.POSITIONS,
        label: 'Chức vụ',
        icon: <ProfileOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.POSITIONS],
      },
      {
        key: ROUTES.ROLES,
        label: 'Vai trò & quyền',
        icon: <SolutionOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.ROLES],
      },
      {
        key: ROUTES.ORG_CHART,
        label: 'Sơ đồ tổ chức',
        icon: <NodeIndexOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.ORG_CHART],
      },
      {
        key: ROUTES.EMPLOYEE_STATUS,
        label: 'Vòng đời trạng thái',
        icon: <SwapOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.EMPLOYEE_STATUS],
      },
      {
        key: ROUTES.EMPLOYEE_ASSIGNMENTS,
        label: 'Điều chuyển công tác',
        icon: <SwapOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.EMPLOYEE_ASSIGNMENTS],
      },
      {
        key: ROUTES.USER_ROLE_SCOPES,
        label: 'Phân quyền người dùng',
        icon: <UserSwitchOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.USER_ROLE_SCOPES],
      },
      {
        key: ROUTES.TASKS,
        label: 'Giao việc',
        icon: <AuditOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.TASKS],
      },
    ],
  },
  {
    key: 'warehouse',
    label: 'Module 2 · Kho',
    icon: <ShopOutlined />,
    children: [
      {
        key: ROUTES.WAREHOUSE,
        label: 'Quản lý kho',
        icon: <ShopOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.WAREHOUSE],
      },
      {
        key: ROUTES.WAREHOUSES,
        label: 'Kho hàng',
        icon: <ShopOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.WAREHOUSES],
      },
      {
        key: ROUTES.STOCK_RECEIPTS,
        label: 'Phiếu nhập kho',
        icon: <InboxOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.STOCK_RECEIPTS],
      },
      {
        key: ROUTES.STOCK_ISSUES,
        label: 'Phiếu xuất kho',
        icon: <StockOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.STOCK_ISSUES],
      },
      {
        key: ROUTES.STOCK_TRANSFERS,
        label: 'Điều chuyển kho',
        icon: <SwapOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.STOCK_TRANSFERS],
      },
      {
        key: ROUTES.INVENTORY_BALANCE,
        label: 'Tồn kho',
        icon: <FundOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.INVENTORY_BALANCE],
      },
      {
        key: ROUTES.STOCK_MOVEMENTS,
        label: 'Biến động tồn',
        icon: <BarChartOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.STOCK_MOVEMENTS],
      },
    ],
  },
  {
    key: 'business',
    label: 'Module 3 · Kinh doanh',
    icon: <ShoppingCartOutlined />,
    children: [
      {
        key: ROUTES.BUSINESS,
        label: 'Quản lý kinh doanh',
        icon: <ShoppingCartOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.BUSINESS],
      },
      {
        key: ROUTES.PRODUCTS,
        label: 'Sản phẩm',
        icon: <ShopOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.PRODUCTS],
      },
      {
        key: ROUTES.PRICE_LISTS,
        label: 'Bảng giá',
        icon: <FundOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.PRICE_LISTS],
      },
      {
        key: ROUTES.CUSTOMERS,
        label: 'Khách hàng',
        icon: <IdcardOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.CUSTOMERS],
      },
      {
        key: ROUTES.SALES_ORDERS,
        label: 'Đơn hàng',
        icon: <FileTextOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.SALES_ORDERS],
      },
      {
        key: ROUTES.SALES_CHANNELS,
        label: 'Kênh bán hàng',
        icon: <BarChartOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.SALES_CHANNELS],
      },
    ],
  },
  {
    key: 'system',
    label: 'Hệ thống',
    icon: <SettingOutlined />,
    children: [
      {
        key: ROUTES.AUDIT_LOGS,
        label: 'Nhật ký kiểm tra',
        icon: <AuditOutlined />,
        permission: ROUTE_PERMISSIONS[ROUTES.AUDIT_LOGS],
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
        // permission có thể là string hoặc string[] (OR logic)
        const permissions = Array.isArray(item.permission)
          ? item.permission
          : [item.permission];
        // Chỉ hiện mục nếu user có ÍT NHẤT 1 trong các quyền
        if (!permissions.some((p) => can(p))) return null;
      }
      return item;
    })
    .filter((item): item is AppMenuItem => item !== null);
}

/** Chuyển cấu hình sang dạng items của antd Menu. */
export function toMenuItems(items: AppMenuItem[]): MenuProps['items'] {
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

/**
 * Tìm mục menu khớp nhất với pathname (cả sub-route VD /org-units/123 → /org-units).
 * Lấy ưu tiên mục có key = pathname, nếu không có thì mục có key là prefix của pathname.
 */
/**
 * So khớp pathname với 1 key menu theo ranh giới segment: exact match, hoặc
 * key là tiền tố path hợp lệ (kế tiếp bằng dấu "/"). Tránh khớp nhầm chuỗi
 * thuần (vd key "/warehouse" KHÔNG được khớp "/warehouses/1").
 */
// Key có thể mang query string (vd `/org-units?mode=branch` cho branch-mode)
// để phân biệt với mục cha dùng chung route — tách path/query để so khớp
// riêng từng phần, tránh so sánh chuỗi thô lẫn lộn query vào path.
function splitKey(key: string): { path: string; query: string } {
  const idx = key.indexOf('?');
  return idx === -1
    ? { path: key, query: '' }
    : { path: key.slice(0, idx), query: key.slice(idx) };
}

function matchesPath(
  key: string,
  pathname: string,
  search: string = '',
): boolean {
  const { path, query } = splitKey(key);
  const pathMatches =
    path === pathname || (path !== '/' && pathname.startsWith(`${path}/`));
  if (!pathMatches) return false;
  // Key không mang query → khớp bất kể search hiện tại (route cha mặc định).
  // Key có mang query → chỉ khớp khi search hiện tại trùng khớp chính xác.
  return query === '' || query === search;
}

function findMatchingItem(
  items: AppMenuItem[],
  pathname: string,
  search: string = '',
): AppMenuItem | undefined {
  // Ưu tiên mục có key mang query (vd branch-mode) khớp chính xác search hiện
  // tại — tránh mục cha dùng chung path (không mang query) "nuốt" mất match
  // cụ thể hơn chỉ vì đứng trước trong mảng.
  const specific = items.find(
    (c) => splitKey(c.key).query !== '' && matchesPath(c.key, pathname, search),
  );
  if (specific) return specific;
  return items.find(
    (c) => splitKey(c.key).query === '' && matchesPath(c.key, pathname, search),
  );
}

/** Tìm "vết" breadcrumb cho path hiện tại dựa trên cấu hình menu. */
export function getBreadcrumb(pathname: string, search: string = ''): Crumb[] {
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
export function getOpenKeys(pathname: string, search: string = ''): string[] {
  return MENU.filter((top) =>
    top.children?.some((c) => matchesPath(c.key, pathname, search)),
  ).map((top) => top.key);
}

/** Tìm key menu cha để highlight đúng selectedKeys cho sub-route. */
export function getSelectedKey(pathname: string, search: string = ''): string {
  for (const top of MENU) {
    if (top.key === pathname) return top.key;
    const child = findMatchingItem(top.children ?? [], pathname, search);
    if (child) return child.key;
  }
  return pathname;
}
