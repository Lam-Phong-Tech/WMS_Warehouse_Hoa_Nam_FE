export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  CHANGE_PASSWORD: "/change-password",
  PROFILE: "/profile",
  NOTIFICATIONS: "/notifications",

  // 00 · Tổng quan
  DASHBOARD: "/dashboard",

  // 01 · Hệ thống & danh mục (HN_WMS_Wireframe_MVP.html)
  IAM_USERS: "/system/users",
  IAM_USER_CREATE: "/system/users/new",
  IAM_ROLES: "/system/roles",
  MASTER_DATA: "/master-data/skus",
  SKU_CREATE: "/master-data/skus/new",
  CATALOG_MASTER: "/master-data/catalog",
  WAREHOUSE_CONFIG: "/master-data/warehouse",
  AGENCIES: "/master-data/agencies",
  AGENCY_CREATE: "/master-data/agencies/new",
  DEFECTS: "/master-data/defects",
  DEFECT_CREATE: "/master-data/defects/new",
  SCAN: "/scan",

  // 02 · Nhập kho
  INBOUND: "/inbound",
  PUTAWAY: "/putaway",

  // Remaining WMS modules
  OUTBOUND: "/outbound",
  INVENTORY: "/inventory",
  // Không có route kiểm kê trong MVP.
  //
  // THẨM QUYỀN (đọc kỹ trước khi trích lại ở nơi khác — WWHN-242/FE242-P2-03):
  // rule này được enforce bởi **REQ-SRS-037 ("Must")** trong SRS/FRD v1.12 đã được
  // adopt tại WWHN-334, kèm AC-SRS-037 + BR-NOSTK-01..03, và được ERD §0.1 xác nhận
  // ("không tạo Stocktake_Session/Snapshot/Count/Variance_Line/Adjustment").
  // `DEC-NO-STOCKTAKE-001` chỉ là **nhãn decision-source** trong bảng Decision Records
  // (SRS §2): Decision Record formal của nó là WWHN-25, và WWHN-25 vẫn FORMAL APPROVAL
  // PENDING. Vì vậy KHÔNG được trích `DEC-NO-STOCKTAKE-001` như một Decision ID
  // standalone đã được duyệt — trích như vậy là nói quá thẩm quyền. Guard chống hồi quy:
  // scripts/verify-wwhn-242-closure.mjs (check "no-stocktake citation").
  WARRANTY: "/warranty",
  REVERSE: "/reverse",
  REPORTS: "/reports",
  COMPONENT_CATALOG: "/component-catalog",

  // Organization & Employee Management
  ORG_UNITS: "/org-units",
  EMPLOYEE_ASSIGNMENTS: "/employee-assignments",
  USER_ROLE_SCOPES: "/user-role-scopes",

  // 07 · App PV (SRS §3: "Người xem App PV" là actor ẩn danh, read-only)
  // SCR-PV-01/02 nằm NGOÀI ProtectedRoute — xem app/router/index.tsx. Không đặt
  // dưới prefix nội bộ nào để link chia sẻ ra ngoài ngắn và ổn định.
  PV_CATALOG: "/pv",
  PV_PRODUCT_DETAIL: "/pv/products/:skuId",
  /** SCR-PV-ADM-01 — màn NỘI BỘ, gate pv.master.manage hoặc pv.publish. */
  PV_ADMIN: "/pv-admin",

  // Shared
  AUDIT_LOGS: "/audit-logs",
  NO_PERMISSION: "/errors/403",
} as const;
