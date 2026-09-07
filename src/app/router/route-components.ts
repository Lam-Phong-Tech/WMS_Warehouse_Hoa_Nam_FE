import { lazyRoute } from "@/app/router/lazy-route";

/**
 * NƠI DUY NHẤT khai báo chunk của từng màn.
 *
 * Trước đây `router/index.tsx` giữ 40 `lazy(() => import(...))` và
 * `route-preload.ts` lặp lại y nguyên 30 chuỗi `import(...)` để nạp trước. Hai
 * danh sách phải giống nhau từng chữ (Rollup gộp `import()` cùng module vào cùng
 * chunk) — thêm màn mà quên một bên là mất nạp trước trong im lặng. Nay cả router
 * lẫn preload dùng CÙNG một object `lazyRoute(...)`: nạp trước là `X.preload()`,
 * render là `<X />`, và khi đã nạp thì render không treo (xem lazy-route.tsx).
 *
 * Quy ước: mỗi dòng đúng một `import()` tới file trang; module export default
 * thì truyền thẳng, export named thì `.then(m => ({ default: m.X }))`.
 */

// --- Vỏ ứng dụng + xác thực ------------------------------------------------
export const MainLayout = lazyRoute(() =>
  import("@/app/layouts/MainLayout").then((m) => ({ default: m.MainLayout })),
);
export const LoginPage = lazyRoute(() =>
  import("@/modules/auth/pages/LoginPage").then((m) => ({
    default: m.LoginPage,
  })),
);
export const ChangePasswordPage = lazyRoute(() =>
  import("@/modules/auth/pages/ChangePasswordPage").then((m) => ({
    default: m.ChangePasswordPage,
  })),
);
export const ForgotPasswordPage = lazyRoute(() =>
  import("@/modules/auth/pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
export const ProfilePage = lazyRoute(() =>
  import("@/modules/auth/pages/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);

// --- Lỗi -------------------------------------------------------------------
export const NoPermissionPage = lazyRoute(() =>
  import("@/modules/errors/pages/NoPermissionPage").then((m) => ({
    default: m.NoPermissionPage,
  })),
);
export const NotFoundPage = lazyRoute(() =>
  import("@/modules/errors/pages/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  })),
);

// --- Vận hành --------------------------------------------------------------
export const DashboardPage = lazyRoute(
  () => import("@/modules/dashboard/pages/DashboardPage"),
);
export const AuditLogsPage = lazyRoute(() =>
  import("@/modules/audit-logs/pages/AuditLogsPage").then((m) => ({
    default: m.AuditLogsPage,
  })),
);
export const NotificationsPage = lazyRoute(
  () => import("@/modules/notifications/pages/NotificationsPage"),
);
export const IamUsersGd1Page = lazyRoute(() =>
  import("@/modules/iam/pages/IamUsersGd1Page").then((m) => ({
    default: m.IamUsersGd1Page,
  })),
);
export const IamRolePermissionScreen = lazyRoute(() =>
  import("@/modules/iam/pages/IamRolePermissionScreen").then((m) => ({
    default: m.IamRolePermissionScreen,
  })),
);
export const SkuMasterScreen = lazyRoute(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.SkuMasterScreen,
  })),
);
export const AgencyMasterScreen = lazyRoute(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.AgencyMasterScreen,
  })),
);
export const DefectMasterScreen = lazyRoute(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.DefectMasterScreen,
  })),
);
export const CatalogMasterScreen = lazyRoute(() =>
  import("@/modules/master-data/pages/CatalogMasterScreen").then((m) => ({
    default: m.CatalogMasterScreen,
  })),
);
export const WarehouseConfigScreen = lazyRoute(() =>
  import("@/modules/master-data/pages/WarehouseConfigScreen").then((m) => ({
    default: m.WarehouseConfigScreen,
  })),
);
export const PvProductCatalogPage = lazyRoute(() =>
  import("@/modules/pv/pages/PvProductCatalogPage").then((m) => ({
    default: m.PvProductCatalogPage,
  })),
);
export const PhysicalCodesPage = lazyRoute(
  () => import("@/modules/scan/pages/PhysicalCodesPage"),
);
export const InboundPage = lazyRoute(
  () => import("@/modules/inbound/pages/InboundPage"),
);
export const PutawayPage = lazyRoute(
  () => import("@/modules/putaway/pages/PutawayPage"),
);
export const TrayOverviewPage = lazyRoute(
  () => import("@/modules/putaway/pages/TrayOverviewPage"),
);
export const OutboundPage = lazyRoute(
  () => import("@/modules/outbound/pages/OutboundPage"),
);
export const InventoryPage = lazyRoute(
  () => import("@/modules/inventory/pages/InventoryPage"),
);
export const WarrantyPage = lazyRoute(
  () => import("@/modules/warranty/pages/WarrantyPage"),
);
export const WarrantyComponentIssueListPage = lazyRoute(
  () => import("@/modules/warranty/pages/WarrantyComponentIssueListPage"),
);
export const ReversalPage = lazyRoute(
  () => import("@/modules/reverse/pages/ReversalPage"),
);

// --- Báo cáo ---------------------------------------------------------------
export const InventoryFlowReportPage = lazyRoute(
  () => import("@/modules/reports/pages/InventoryFlowReportPage"),
);
export const OutboundFlowReportPage = lazyRoute(
  () => import("@/modules/reports/pages/OutboundFlowReportPage"),
);
export const StockReconcileReportPage = lazyRoute(
  () => import("@/modules/reports/pages/StockReconcileReportPage"),
);
export const TraceabilityReportPage = lazyRoute(
  () => import("@/modules/reports/pages/TraceabilityReportPage"),
);
export const ImportQualityReportPage = lazyRoute(
  () => import("@/modules/reports/pages/ImportQualityReportPage"),
);
export const PackingLabelReportPage = lazyRoute(
  () => import("@/modules/reports/pages/PackingLabelReportPage"),
);
export const WarrantyReportPage = lazyRoute(
  () => import("@/modules/reports/pages/WarrantyReportPage"),
);
export const RecipientReportPage = lazyRoute(
  () => import("@/modules/reports/pages/RecipientReportPage"),
);
export const PendingEvidenceReportPage = lazyRoute(
  () => import("@/modules/reports/pages/PendingEvidenceReportPage"),
);

// --- PV / công cụ ----------------------------------------------------------
export const PvCatalogPage = lazyRoute(
  () => import("@/modules/pv/pages/PvCatalogPage"),
);
export const PvProductDetailPage = lazyRoute(
  () => import("@/modules/pv/pages/PvProductDetailPage"),
);
export const PvAdminPage = lazyRoute(
  () => import("@/modules/pv/pages/PvAdminPage"),
);
export const FoundationCatalogPage = lazyRoute(
  () => import("@/shared/ui/catalog/FoundationCatalogPage"),
);
