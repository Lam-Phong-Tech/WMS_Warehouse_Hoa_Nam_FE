/* eslint-disable react-refresh/only-export-components -- file định nghĩa router, không phải module fast-refresh */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/app/router/ProtectedRoute';
import { RequirePermission } from '@/app/router/RequirePermission';
import { ROUTE_PERMISSIONS } from '@/app/router/access';
import { PageSkeleton } from '@/shared/components/ui-states/PageSkeleton';
import { AdaptiveDelayedRender } from '@/shared/components/feedback/AdaptiveDelayedRender';
import { ROUTES } from '@/shared/constants/routes';

// No Permission page
import { NoPermissionPage } from '@/modules/errors/pages/NoPermissionPage';

// Import trực tiếp các trang ngoài modules (không lazy load)
import { MainLayout } from '@/app/(admin)/layout';
import { PartnerLayout } from '@/app/(partner)/layout';
import { LoginPage } from '@/modules/auth/pages/LoginPage';
import { ChangePasswordPage } from '@/modules/auth/pages/ChangePasswordPage';
const OrgUnitsPage = lazy(() =>
  import('@/modules/org-units/pages/OrgUnitsPage').then((m) => ({
    default: m.OrgUnitsPage,
  })),
);
const DepartmentsPage = lazy(() =>
  import('@/modules/departments/pages/DepartmentsPage').then((m) => ({
    default: m.DepartmentsPage,
  })),
);
const EmployeesPage = lazy(() =>
  import('@/modules/employees/pages/EmployeesPage').then((m) => ({
    default: m.EmployeesPage,
  })),
);
const RolesPage = lazy(() =>
  import('@/modules/roles/pages/RolesPage').then((m) => ({
    default: m.RolesPage,
  })),
);
const PositionsPage = lazy(() =>
  import('@/modules/positions/pages/PositionsPage').then((m) => ({
    default: m.PositionsPage,
  })),
);
const OrgChartPage = lazy(() =>
  import('@/modules/org-charts/pages/OrgChartPage').then((m) => ({
    default: m.OrgChartPage,
  })),
);
const EmployeeStatusPage = lazy(() =>
  import('@/modules/employee-status/pages/EmployeeStatusPage').then((m) => ({
    default: m.EmployeeStatusPage,
  })),
);
const EmployeeAssignmentsPage = lazy(() =>
  import('@/modules/employee-assignments/pages/EmployeeAssignmentsPage').then(
    (m) => ({
      default: m.EmployeeAssignmentsPage,
    }),
  ),
);
const UserRoleScopesPage = lazy(() =>
  import('@/modules/users/pages/UserRoleScopesPage').then((m) => ({
    default: m.UserRoleScopesPage,
  })),
);
const TasksPage = lazy(() =>
  import('@/modules/tasks/pages/TasksPage').then((m) => ({
    default: m.TasksPage,
  })),
);
const AuditLogsPage = lazy(() =>
  import('@/modules/audit-logs/pages/AuditLogsPage').then((m) => ({
    default: m.AuditLogsPage,
  })),
);
const ApiErrorDemoPage = lazy(() =>
  import('@/modules/demo/pages/ApiErrorDemoPage').then((m) => ({
    default: m.ApiErrorDemoPage,
  })),
);
const PermissionDemoPage = lazy(() =>
  import('@/modules/demo/pages/PermissionDemoPage').then((m) => ({
    default: m.PermissionDemoPage,
  })),
);
const SharedComponentsDemo = lazy(
  () => import('@/modules/demo/pages/SharedComponentsDemo'),
);

// Module 2 - Warehouse
const WarehousePage = lazy(() =>
  import('@/modules/warehouse/pages/WarehousePage').then((m) => ({
    default: m.WarehousePage,
  })),
);
const WarehousesPage = lazy(() =>
  import('@/modules/warehouses/pages/WarehousesPage').then((m) => ({
    default: m.WarehousesPage,
  })),
);
const StockReceiptsPage = lazy(() =>
  import('@/modules/stock-receipts/pages/StockReceiptsPage').then((m) => ({
    default: m.StockReceiptsPage,
  })),
);
const StockIssuesPage = lazy(() =>
  import('@/modules/stock-issues/pages/StockIssuesPage').then((m) => ({
    default: m.StockIssuesPage,
  })),
);
const StockTransfersPage = lazy(() =>
  import('@/modules/stock-transfers/pages/StockTransfersPage').then((m) => ({
    default: m.StockTransfersPage,
  })),
);
const InventoryBalancePage = lazy(() =>
  import('@/modules/inventory-balance/pages/InventoryBalancePage').then(
    (m) => ({
      default: m.InventoryBalancePage,
    }),
  ),
);
const StockMovementsPage = lazy(() =>
  import('@/modules/stock-movements/pages/StockMovementsPage').then((m) => ({
    default: m.StockMovementsPage,
  })),
);

// Module 3 - Business
const BusinessPage = lazy(() =>
  import('@/modules/business/pages/BusinessPage').then((m) => ({
    default: m.BusinessPage,
  })),
);
const ProductsPage = lazy(() =>
  import('@/modules/products/pages/ProductsPage').then((m) => ({
    default: m.ProductsPage,
  })),
);
const PriceListsPage = lazy(() =>
  import('@/modules/price-lists/pages/PriceListsPage').then((m) => ({
    default: m.PriceListsPage,
  })),
);
const CustomersPage = lazy(() =>
  import('@/modules/customers/pages/CustomersPage').then((m) => ({
    default: m.CustomersPage,
  })),
);
const SalesOrdersPage = lazy(() =>
  import('@/modules/sales-orders/pages/SalesOrdersPage').then((m) => ({
    default: m.SalesOrdersPage,
  })),
);
const SalesChannelsPage = lazy(() =>
  import('@/modules/sales-channels/pages/SalesChannelsPage').then((m) => ({
    default: m.SalesChannelsPage,
  })),
);

// Tài khoản (truy cập từ UserMenu, không có mục sidebar riêng)
const ProfilePage = lazy(() =>
  import('@/modules/auth/pages/ProfilePage').then((m) => ({
    default: m.ProfilePage,
  })),
);

/**
 * Bọc page với AdaptiveDelayedRender để dữ liệu React Query có thời gian
 * load trước khi render content, tránh flash loading state.
 * Delay tự động điều chỉnh theo network condition.
 * Chỉ dùng cho các trang trong modules (đã lazy load).
 */
function withPageTransition(node: ReactNode) {
  return (
    <AdaptiveDelayedRender minDelay={100} maxDelay={800}>
      <Suspense fallback={<PageSkeleton />}>{node}</Suspense>
    </AdaptiveDelayedRender>
  );
}

/**
 * Bọc page không cần delay (cho các trang ngoài modules)
 */
function withoutDelay(node: ReactNode) {
  return node;
}

// Bọc route theo quyền (lấy từ ROUTE_PERMISSIONS): thiếu quyền → 403.
function routeEl(path: string, node: ReactNode) {
  return (
    <RequirePermission permission={ROUTE_PERMISSIONS[path]}>
      {withPageTransition(node)}
    </RequirePermission>
  );
}

export const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: withoutDelay(<LoginPage />),
  },
  {
    path: ROUTES.CHANGE_PASSWORD,
    element: withoutDelay(<ChangePasswordPage />),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: ROUTES.HOME,
        element: withoutDelay(<MainLayout />),
        children: [
          { index: true, element: <Navigate to={ROUTES.ORG_UNITS} replace /> },
          {
            path: ROUTES.ORG_UNITS,
            element: routeEl(ROUTES.ORG_UNITS, <OrgUnitsPage />),
          },
          {
            path: ROUTES.DEPARTMENTS,
            element: routeEl(ROUTES.DEPARTMENTS, <DepartmentsPage />),
          },
          {
            path: ROUTES.EMPLOYEES,
            element: routeEl(ROUTES.EMPLOYEES, <EmployeesPage />),
          },
          {
            path: ROUTES.POSITIONS,
            element: routeEl(ROUTES.POSITIONS, <PositionsPage />),
          },
          { path: ROUTES.ROLES, element: routeEl(ROUTES.ROLES, <RolesPage />) },
          {
            path: ROUTES.ORG_CHART,
            element: routeEl(ROUTES.ORG_CHART, <OrgChartPage />),
          },
          {
            path: ROUTES.EMPLOYEE_STATUS,
            element: routeEl(ROUTES.EMPLOYEE_STATUS, <EmployeeStatusPage />),
          },
          {
            path: ROUTES.EMPLOYEE_ASSIGNMENTS,
            element: routeEl(
              ROUTES.EMPLOYEE_ASSIGNMENTS,
              <EmployeeAssignmentsPage />,
            ),
          },
          {
            path: ROUTES.USER_ROLE_SCOPES,
            element: routeEl(ROUTES.USER_ROLE_SCOPES, <UserRoleScopesPage />),
          },
          { path: ROUTES.TASKS, element: routeEl(ROUTES.TASKS, <TasksPage />) },
          {
            path: ROUTES.AUDIT_LOGS,
            element: routeEl(ROUTES.AUDIT_LOGS, <AuditLogsPage />),
          },
          {
            path: '/demo/api-errors',
            element: routeEl('/demo/api-errors', <ApiErrorDemoPage />),
          },
          {
            path: ROUTES.PERMISSION_DEMO,
            element: routeEl(ROUTES.PERMISSION_DEMO, <PermissionDemoPage />),
          },
          {
            path: ROUTES.SHARED_COMPONENTS_DEMO,
            element: routeEl(
              ROUTES.SHARED_COMPONENTS_DEMO,
              <SharedComponentsDemo />,
            ),
          },
          // Module 2 - Warehouse
          {
            path: ROUTES.WAREHOUSE,
            element: routeEl(ROUTES.WAREHOUSE, <WarehousePage />),
          },
          {
            path: ROUTES.WAREHOUSES,
            element: routeEl(ROUTES.WAREHOUSES, <WarehousesPage />),
          },
          {
            path: ROUTES.STOCK_RECEIPTS,
            element: routeEl(ROUTES.STOCK_RECEIPTS, <StockReceiptsPage />),
          },
          {
            path: ROUTES.STOCK_ISSUES,
            element: routeEl(ROUTES.STOCK_ISSUES, <StockIssuesPage />),
          },
          {
            path: ROUTES.STOCK_TRANSFERS,
            element: routeEl(ROUTES.STOCK_TRANSFERS, <StockTransfersPage />),
          },
          {
            path: ROUTES.INVENTORY_BALANCE,
            element: routeEl(
              ROUTES.INVENTORY_BALANCE,
              <InventoryBalancePage />,
            ),
          },
          {
            path: ROUTES.STOCK_MOVEMENTS,
            element: routeEl(ROUTES.STOCK_MOVEMENTS, <StockMovementsPage />),
          },
          // Module 3 - Business
          {
            path: ROUTES.BUSINESS,
            element: routeEl(ROUTES.BUSINESS, <BusinessPage />),
          },
          {
            path: ROUTES.PRODUCTS,
            element: routeEl(ROUTES.PRODUCTS, <ProductsPage />),
          },
          {
            path: ROUTES.PRICE_LISTS,
            element: routeEl(ROUTES.PRICE_LISTS, <PriceListsPage />),
          },
          {
            path: ROUTES.CUSTOMERS,
            element: routeEl(ROUTES.CUSTOMERS, <CustomersPage />),
          },
          {
            path: ROUTES.SALES_ORDERS,
            element: routeEl(ROUTES.SALES_ORDERS, <SalesOrdersPage />),
          },
          {
            path: ROUTES.SALES_CHANNELS,
            element: routeEl(ROUTES.SALES_CHANNELS, <SalesChannelsPage />),
          },
          // Tài khoản — không cần permission riêng, ai đăng nhập cũng vào được.
          {
            path: ROUTES.PROFILE,
            element: routeEl(ROUTES.PROFILE, <ProfilePage />),
          },
        ],
      },
      {
        path: '/partner',
        element: withoutDelay(<PartnerLayout />),
        children: [{ index: true, element: <div>Partner Portal Home</div> }],
      },
    ],
  },
  {
    path: ROUTES.NO_PERMISSION,
    element: withoutDelay(<NoPermissionPage />),
  },
  {
    path: '*',
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);
