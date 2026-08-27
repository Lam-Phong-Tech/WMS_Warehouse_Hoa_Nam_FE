/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { RequirePermission } from "@/app/router/RequirePermission";
import { resolveRouteEntryPermission } from "@/app/router/access";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";
import { ROUTES } from "@/shared/constants/routes";
import { LoginPage } from "@/modules/auth/pages/LoginPage";

const MainLayout = lazy(() =>
  import("@/app/layouts/MainLayout").then((m) => ({ default: m.MainLayout })),
);
const ChangePasswordPage = lazy(() =>
  import("@/modules/auth/pages/ChangePasswordPage").then((m) => ({
    default: m.ChangePasswordPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/modules/auth/pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const NoPermissionPage = lazy(() =>
  import("@/modules/errors/pages/NoPermissionPage").then((m) => ({
    default: m.NoPermissionPage,
  })),
);
const AuditLogsPage = lazy(() =>
  import("@/modules/audit-logs/pages/AuditLogsPage").then((m) => ({
    default: m.AuditLogsPage,
  })),
);
const NotificationsPage = lazy(
  () => import("@/modules/notifications/pages/NotificationsPage"),
);
const DashboardPage = lazy(() =>
  import("@/modules/dashboard/pages/DashboardPage").then((m) => ({
    default: m.default,
  })),
);
const IamUsersGd1Page = lazy(() =>
  import("@/modules/iam/pages/IamUsersGd1Page").then((m) => ({
    default: m.IamUsersGd1Page,
  })),
);
const IamRolePermissionScreen = lazy(() =>
  import("@/modules/iam/pages/IamRolePermissionScreen").then((m) => ({
    default: m.IamRolePermissionScreen,
  })),
);
const SkuMasterScreen = lazy(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.SkuMasterScreen,
  })),
);
const CatalogMasterScreen = lazy(() =>
  import("@/modules/master-data/pages/CatalogMasterScreen").then((m) => ({
    default: m.CatalogMasterScreen,
  })),
);
const WarehouseConfigScreen = lazy(() =>
  import("@/modules/master-data/pages/WarehouseConfigScreen").then((m) => ({
    default: m.WarehouseConfigScreen,
  })),
);
const AgencyMasterScreen = lazy(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.AgencyMasterScreen,
  })),
);
const DefectMasterScreen = lazy(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.DefectMasterScreen,
  })),
);
const PhysicalCodesPage = lazy(() =>
  import("@/modules/scan/pages/PhysicalCodesPage").then((m) => ({
    default: m.default,
  })),
);
const InboundPage = lazy(() =>
  import("@/modules/inbound/pages/InboundPage").then((m) => ({
    default: m.default,
  })),
);
const PutawayPage = lazy(() =>
  import("@/modules/putaway/pages/PutawayPage").then((m) => ({
    default: m.default,
  })),
);
const OutboundPage = lazy(() =>
  import("@/modules/outbound/pages/OutboundPage").then((m) => ({
    default: m.default,
  })),
);
const InventoryPage = lazy(() =>
  import("@/modules/inventory/pages/InventoryPage").then((m) => ({
    default: m.default,
  })),
);
const WarrantyPage = lazy(() =>
  import("@/modules/warranty/pages/WarrantyPage").then((m) => ({
    default: m.default,
  })),
);
const ReversalPage = lazy(() =>
  import("@/modules/reverse/pages/ReversalPage").then((m) => ({
    default: m.default,
  })),
);
const ReportsPage = lazy(() =>
  import("@/modules/reports/pages/ReportsPage").then((m) => ({
    default: m.default,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/modules/errors/pages/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  })),
);
const FoundationCatalogPage = lazy(() =>
  import("@/shared/ui/catalog/FoundationCatalogPage").then((m) => ({
    default: m.default,
  })),
);
const ProfilePage = lazy(() =>
  import("@/modules/auth/pages/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);
const PvCatalogPage = lazy(() =>
  import("@/modules/pv/pages/PvCatalogPage").then((m) => ({
    default: m.default,
  })),
);
const PvProductDetailPage = lazy(() =>
  import("@/modules/pv/pages/PvProductDetailPage").then((m) => ({
    default: m.default,
  })),
);
const PvAdminPage = lazy(() =>
  import("@/modules/pv/pages/PvAdminPage").then((m) => ({
    default: m.default,
  })),
);

function withPageLoader(node: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;
}

function routeEl(path: string, node: ReactNode) {
  return (
    <RequirePermission permission={resolveRouteEntryPermission(path)}>
      {withPageLoader(node)}
    </RequirePermission>
  );
}

export const router = createBrowserRouter([
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  { path: ROUTES.PV_CATALOG, element: withPageLoader(<PvCatalogPage />) },
  {
    path: ROUTES.PV_PRODUCT_DETAIL,
    element: withPageLoader(<PvProductDetailPage />),
  },
  {
    path: ROUTES.CHANGE_PASSWORD,
    element: withPageLoader(<ChangePasswordPage />),
  },
  {
    path: ROUTES.FORGOT_PASSWORD,
    element: withPageLoader(<ForgotPasswordPage />),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: ROUTES.HOME,
        element: withPageLoader(<MainLayout />),
        children: [
          { index: true, element: <Navigate to={ROUTES.DASHBOARD} replace /> },
          {
            path: ROUTES.AUDIT_LOGS,
            element: routeEl(ROUTES.AUDIT_LOGS, <AuditLogsPage />),
          },
          {
            path: ROUTES.NOTIFICATIONS,
            element: routeEl(ROUTES.NOTIFICATIONS, <NotificationsPage />),
          },
          {
            path: ROUTES.DASHBOARD,
            element: routeEl(ROUTES.DASHBOARD, <DashboardPage />),
          },
          {
            path: ROUTES.IAM_USERS,
            element: routeEl(ROUTES.IAM_USERS, <IamUsersGd1Page />),
          },
          {
            path: ROUTES.IAM_USER_CREATE,
            element: routeEl(
              ROUTES.IAM_USER_CREATE,
              <IamUsersGd1Page openCreateOnMount />,
            ),
          },
          {
            path: ROUTES.IAM_ROLES,
            element: routeEl(ROUTES.IAM_ROLES, <IamRolePermissionScreen />),
          },
          {
            path: ROUTES.MASTER_DATA,
            element: routeEl(
              ROUTES.MASTER_DATA,
              <div className="hn-mvp-source-screen">
                <SkuMasterScreen />
              </div>,
            ),
          },
          {
            path: ROUTES.SKU_CREATE,
            element: routeEl(
              ROUTES.SKU_CREATE,
              <div className="hn-mvp-source-screen">
                <SkuMasterScreen openCreateOnMount />
              </div>,
            ),
          },
          {
            path: ROUTES.CATALOG_MASTER,
            element: routeEl(ROUTES.CATALOG_MASTER, <CatalogMasterScreen />),
          },
          {
            path: ROUTES.WAREHOUSE_CONFIG,
            element: routeEl(
              ROUTES.WAREHOUSE_CONFIG,
              <WarehouseConfigScreen />,
            ),
          },
          {
            path: ROUTES.AGENCIES,
            element: routeEl(
              ROUTES.AGENCIES,
              <div className="hn-mvp-source-screen">
                <AgencyMasterScreen />
              </div>,
            ),
          },
          {
            path: ROUTES.AGENCY_CREATE,
            element: routeEl(
              ROUTES.AGENCY_CREATE,
              <div className="hn-mvp-source-screen">
                <AgencyMasterScreen openCreateOnMount />
              </div>,
            ),
          },
          {
            path: ROUTES.DEFECTS,
            element: routeEl(
              ROUTES.DEFECTS,
              <div className="hn-mvp-source-screen">
                <DefectMasterScreen />
              </div>,
            ),
          },
          {
            path: ROUTES.DEFECT_CREATE,
            element: routeEl(
              ROUTES.DEFECT_CREATE,
              <div className="hn-mvp-source-screen">
                <DefectMasterScreen openCreateOnMount />
              </div>,
            ),
          },
          {
            path: ROUTES.SCAN,
            element: routeEl(ROUTES.SCAN, <PhysicalCodesPage />),
          },
          {
            path: ROUTES.INBOUND,
            element: routeEl(ROUTES.INBOUND, <InboundPage />),
          },
          {
            path: ROUTES.PUTAWAY,
            element: routeEl(ROUTES.PUTAWAY, <PutawayPage />),
          },
          {
            path: ROUTES.OUTBOUND,
            element: routeEl(ROUTES.OUTBOUND, <OutboundPage />),
          },
          {
            path: ROUTES.INVENTORY,
            element: routeEl(ROUTES.INVENTORY, <InventoryPage />),
          },
          {
            path: ROUTES.WARRANTY,
            element: routeEl(ROUTES.WARRANTY, <WarrantyPage />),
          },
          {
            path: ROUTES.REVERSE,
            element: routeEl(ROUTES.REVERSE, <ReversalPage />),
          },
          {
            path: ROUTES.REPORTS,
            element: routeEl(ROUTES.REPORTS, <ReportsPage />),
          },
          // REQ-017: màn demo /component-catalog là công cụ nội bộ cho DEV —
          // không đăng ký route ở bản production (access.ts + menu.tsx gate
          // cùng điều kiện để giữ contract menu ↔ ROUTE_PERMISSIONS).
          ...(import.meta.env.DEV
            ? [
                // Part 3 Vuexy sync: catalog antd cũ đã xoá — /component-catalog
                // (REQ-017, công cụ BA/QA) redirect về golden catalog canonical.
                {
                  path: ROUTES.COMPONENT_CATALOG,
                  element: <Navigate to={ROUTES.UI_FOUNDATION} replace />,
                },
                // Golden catalog của design system (docs/ui/vuexy-sync/10) —
                // DEV-only, dùng đúng production exports.
                {
                  path: ROUTES.UI_FOUNDATION,
                  element: routeEl(
                    ROUTES.UI_FOUNDATION,
                    <FoundationCatalogPage />,
                  ),
                },
              ]
            : []),
          {
            path: ROUTES.PV_ADMIN,
            element: routeEl(ROUTES.PV_ADMIN, <PvAdminPage />),
          },
          {
            path: ROUTES.PROFILE,
            element: routeEl(ROUTES.PROFILE, <ProfilePage />),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: ROUTES.NO_PERMISSION,
        element: withPageLoader(<NoPermissionPage />),
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
