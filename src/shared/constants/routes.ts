export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  CHANGE_PASSWORD: "/change-password",
  PROFILE: "/profile",

  // 00 · Tổng quan
  DASHBOARD: "/dashboard",

  // 01 · Hệ thống & danh mục (HN_WMS_Wireframe_MVP.html)
  IAM_USERS: "/system/users",
  IAM_USER_CREATE: "/system/users/new",
  MASTER_DATA: "/master-data/skus",
  SKU_CREATE: "/master-data/skus/new",
  AGENCIES: "/master-data/agencies",
  AGENCY_CREATE: "/master-data/agencies/new",
  DEFECTS: "/master-data/defects",
  DEFECT_CREATE: "/master-data/defects/new",
  MASTER_ADVANCED: "/master-data/advanced",
  SCAN: "/scan",

  // 02 · Nhập kho
  INBOUND: "/inbound",
  PUTAWAY: "/putaway",

  // Remaining WMS modules
  OUTBOUND: "/outbound",
  INVENTORY: "/inventory",
  STOCKTAKE: "/stocktake",
  WARRANTY: "/warranty",
  REVERSE: "/reverse",
  REPORTS: "/reports",
  COMPONENT_CATALOG: "/component-catalog",

  // Organization & Employee Management
  ORG_UNITS: "/org-units",
  EMPLOYEE_ASSIGNMENTS: "/employee-assignments",
  USER_ROLE_SCOPES: "/user-role-scopes",

  // Shared
  AUDIT_LOGS: "/audit-logs",
  NO_PERMISSION: "/errors/403",
} as const;
