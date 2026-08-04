/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { RequirePermission } from "@/app/router/RequirePermission";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";
import { AdaptiveDelayedRender } from "@/shared/components/feedback/AdaptiveDelayedRender";
import { ROUTES } from "@/shared/constants/routes";

// No Permission page
import { NoPermissionPage } from "@/modules/errors/pages/NoPermissionPage";

// Import trực tiếp các trang ngoài modules (không lazy load)
import { MainLayout } from "@/app/layouts/MainLayout";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { ChangePasswordPage } from "@/modules/auth/pages/ChangePasswordPage";

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

function withPageTransition(node: ReactNode) {
  return (
    <AdaptiveDelayedRender minDelay={100} maxDelay={800}>
      <Suspense fallback={<PageSkeleton />}>{node}</Suspense>
    </AdaptiveDelayedRender>
  );
}

function withoutDelay(node: ReactNode) {
  return node;
}

// Bọc route theo quyền
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
        element: withoutDelay(<NoPermissionPage />),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);
