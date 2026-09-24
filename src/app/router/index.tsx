/* eslint-disable react-refresh/only-export-components */
import { Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { RequirePermission } from "@/app/router/RequirePermission";
import { resolveRouteEntryPermission } from "@/app/router/access";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";
import { CoordinatedLoadingBoundary } from "@/shared/ui/loading/CoordinatedLoadingBoundary";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
// Mọi màn khai báo MỘT LẦN ở route-components.ts (router và route-preload dùng
// chung). Chúng là `lazyRoute`: vẫn tách chunk như `React.lazy`, nhưng khi chunk
// ĐÃ được nạp trước thì render THẲNG, không treo Suspense — xem lazy-route.tsx
// để biết vì sao điều đó cắt ~300 ms khỏi mỗi lần F5.
import {
  AgencyMasterScreen,
  AuditLogsPage,
  CatalogMasterScreen,
  ChangePasswordPage,
  DashboardPage,
  DefectMasterScreen,
  ForgotPasswordPage,
  FoundationCatalogPage,
  IamRolePermissionScreen,
  IamUsersGd1Page,
  ImportQualityReportPage,
  InboundPage,
  InventoryFlowReportPage,
  InventoryPage,
  LoginPage,
  MainLayout,
  NoPermissionPage,
  NotFoundPage,
  NotificationsPage,
  OutboundFlowReportPage,
  OutboundPage,
  PackingLabelReportPage,
  PendingEvidenceReportPage,
  PhysicalCodesPage,
  MfaSetupPage,
  ProfilePage,
  PutawayPage,
  PvAdminPage,
  PvCatalogPage,
  PvProductCatalogPage,
  RecipientReportPage,
  ReversalPage,
  SkuMasterScreen,
  StockReconcileReportPage,
  TraceabilityReportPage,
  TrayOverviewPage,
  WarehouseConfigScreen,
  WarrantyComponentIssueListPage,
  WarrantyPage,
  WarrantyReportPage,
} from "@/app/router/route-components";

function withPageLoader(node: ReactNode, coordinate = true) {
  const content = <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;
  return coordinate
    ? <CoordinatedLoadingBoundary>{content}</CoordinatedLoadingBoundary>
    : content;
}

function routeEl(path: string, node: ReactNode) {
  return (
    <RequirePermission permission={resolveRouteEntryPermission(path)}>
      {withPageLoader(node)}
    </RequirePermission>
  );
}

function DashboardCanonicalRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  // /dashboard legacy không còn là một màn hợp lệ. Mọi lối vào Tổng quan đều
  // canonical về MAP-01, đồng thời giữ các query khác (ví dụ state=... cho QA).
  if (params.get("screen") !== "MAP-01") {
    params.set("screen", "MAP-01");
    return (
      <Navigate
        to={`${ROUTES.DASHBOARD}?${params.toString()}`}
        replace
      />
    );
  }

  return routeEl(ROUTES.DASHBOARD, <DashboardPage />);
}

export const router = createBrowserRouter([
  { path: ROUTES.LOGIN, element: withPageLoader(<LoginPage />) },
  { path: ROUTES.PV_CATALOG, element: withPageLoader(<PvCatalogPage />) },
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
        // The shell stays interactive; each actual screen owns one loading group.
        element: withPageLoader(<MainLayout />, false),
        children: [
          { index: true, element: <Navigate to={DASHBOARD_CANONICAL} replace /> },
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
            element: <DashboardCanonicalRoute />,
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
            path: ROUTES.PV_PRODUCT_CATALOG,
            element: routeEl(
              ROUTES.PV_PRODUCT_CATALOG,
              <PvProductCatalogPage />,
            ),
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
            path: ROUTES.PUTAWAY_TRAYS,
            element: routeEl(ROUTES.PUTAWAY_TRAYS, <TrayOverviewPage />),
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
            path: ROUTES.WARRANTY_COMPONENT_ISSUES,
            element: routeEl(
              ROUTES.WARRANTY_COMPONENT_ISSUES,
              <WarrantyComponentIssueListPage />,
            ),
          },
          {
            path: ROUTES.REVERSE,
            element: routeEl(ROUTES.REVERSE, <ReversalPage />),
          },
          {
            path: ROUTES.REPORTS_INVENTORY_FLOW,
            element: routeEl(
              ROUTES.REPORTS_INVENTORY_FLOW,
              <InventoryFlowReportPage />,
            ),
          },
          {
            path: ROUTES.REPORTS_OUTBOUND_FLOW,
            element: routeEl(
              ROUTES.REPORTS_OUTBOUND_FLOW,
              <OutboundFlowReportPage />,
            ),
          },
          {
            path: ROUTES.REPORTS_STOCK_RECONCILE,
            element: routeEl(
              ROUTES.REPORTS_STOCK_RECONCILE,
              <StockReconcileReportPage />,
            ),
          },
          {
            path: ROUTES.REPORTS_TRACEABILITY,
            element: routeEl(
              ROUTES.REPORTS_TRACEABILITY,
              <TraceabilityReportPage />,
            ),
          },
          {
            path: ROUTES.REPORTS_IMPORT_QUALITY,
            element: routeEl(
              ROUTES.REPORTS_IMPORT_QUALITY,
              <ImportQualityReportPage />,
            ),
          },
          {
            path: ROUTES.REPORTS_PACKING_LABEL,
            element: routeEl(
              ROUTES.REPORTS_PACKING_LABEL,
              <PackingLabelReportPage />,
            ),
          },
          {
            path: ROUTES.REPORTS_WARRANTY,
            element: routeEl(ROUTES.REPORTS_WARRANTY, <WarrantyReportPage />),
          },
          {
            path: ROUTES.REPORTS_RECIPIENT,
            element: routeEl(ROUTES.REPORTS_RECIPIENT, <RecipientReportPage />),
          },
          {
            path: ROUTES.REPORTS_PENDING_EVIDENCE,
            element: routeEl(
              ROUTES.REPORTS_PENDING_EVIDENCE,
              <PendingEvidenceReportPage />,
            ),
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
          {
            // WWHN-SEC-08 — tu phuc vu, KHONG bao routeEl: dung mot vai tro bi
            // chan boi EnforceMfaEnrollment moi can vao day, nen doi them quyen
            // se tao vong lap "khong vao duoc vi chua dang ky, khong dang ky
            // duoc vi khong vao duoc".
            path: ROUTES.MFA_SETUP,
            element: withPageLoader(<MfaSetupPage />),
          },
          // 403 nằm TRONG MainLayout: người dùng đã đăng nhập nên phải giữ
          // sidebar/topbar để đi tiếp, thay vì mắc kẹt ở một trang trống.
          {
            path: ROUTES.NO_PERMISSION,
            element: withPageLoader(<NoPermissionPage />),
          },
          // 404 giữ nguyên trong shell và sau ProtectedRoute.
          { path: "*", element: withPageLoader(<NotFoundPage />) },
        ],
      },
    ],
  },
]);
