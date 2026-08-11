/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { RequirePermission } from "@/app/router/RequirePermission";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";
import { ROUTES } from "@/shared/constants/routes";

// Login stays eager because it is the public first-paint route.
import { LoginPage } from "@/modules/auth/pages/LoginPage";

// Keep the authenticated shell and secondary auth/error screens out of the
// login bundle. They are downloaded only when the route is actually entered.
const MainLayout = lazy(() =>
  import("@/app/layouts/MainLayout").then((m) => ({ default: m.MainLayout })),
);
const ChangePasswordPage = lazy(() =>
  import("@/modules/auth/pages/ChangePasswordPage").then((m) => ({
    default: m.ChangePasswordPage,
  })),
);
const NoPermissionPage = lazy(() =>
  import("@/modules/errors/pages/NoPermissionPage").then((m) => ({
    default: m.NoPermissionPage,
  })),
);

// Audit Logs
const AuditLogsPage = lazy(() =>
  import("@/modules/audit-logs/pages/AuditLogsPage").then((m) => ({
    default: m.AuditLogsPage,
  })),
);

// WMS P0 - Modules
const DashboardPage = lazy(() =>
  import("@/modules/dashboard/pages/DashboardPage").then((m) => ({
    default: m.default,
  })),
);
const MasterPage = lazy(() =>
  import("@/modules/master-data/pages/MasterPage").then((m) => ({
    default: m.default,
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
const StocktakePage = lazy(() =>
  import("@/modules/stocktake/pages/StocktakePage").then((m) => ({
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
const ComponentCatalogPage = lazy(() =>
  import("@/modules/component-catalog/ComponentCatalogPage").then((m) => ({
    default: m.default,
  })),
);

// Tài khoản
const ProfilePage = lazy(() =>
  import("@/modules/auth/pages/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);

/**
 * Render immediately. Suspense itself already shows a skeleton only while the
 * requested JS chunk is genuinely loading; adding a timer here makes every
 * navigation slower even when the chunk is cached.
 */
function withPageLoader(node: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;
}

// Bọc route theo quyền
function routeEl(path: string, node: ReactNode) {
  return (
    <RequirePermission permission={ROUTE_PERMISSIONS[path]}>
      {withPageLoader(node)}
    </RequirePermission>
  );
}

export const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />,
  },
  {
    path: ROUTES.CHANGE_PASSWORD,
    element: withPageLoader(<ChangePasswordPage />),
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
          // WMS P0
          {
            path: ROUTES.DASHBOARD,
            element: routeEl(ROUTES.DASHBOARD, <DashboardPage />),
          },
          {
            path: ROUTES.MASTER_DATA,
            element: routeEl(ROUTES.MASTER_DATA, <MasterPage />),
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
            path: ROUTES.STOCKTAKE,
            element: routeEl(ROUTES.STOCKTAKE, <StocktakePage />),
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
          {
            path: ROUTES.COMPONENT_CATALOG,
            element: routeEl(
              ROUTES.COMPONENT_CATALOG,
              <ComponentCatalogPage />,
            ),
          },
          // Profile
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
  {
    path: "*",
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);
