export const API_ENDPOINTS = {
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  ME: "/auth/me",
  SWITCH_CONTEXT: "/auth/switch-context",
  REFRESH: "/auth/refresh",
  CHANGE_PASSWORD: "/auth/change-password",
  USERS: "/users",
  EMPLOYEES: "/employees",
  EMPLOYEE_STATUS_HISTORIES: "/employee-status-histories",
  EMPLOYEES_ASSIGNABLE: "/employees/assignable-employees",
  POSITIONS: "/positions",
  // P0.4: base path xác nhận từ API doc thật (astrodev.test8.io.vn/api/documentation)
  // là "org_units" (underscore), không phải "org-units" (hyphen).
  ORG_UNITS: "/org_units",
  ORG_UNITS_GENERATE_TMP: "/org_units/generate-tmp-code",
  ORG_UNITS_GENERATE_CODE: "/org_units/generate-code",
  ORG_UNITS_CHECK_TAX_CODE: "/org_units/check-tax-code",
  ORG_UNITS_COMPANIES: "/org_units/companies",
  DEPARTMENTS: "/departments",
  ROLES: "/roles",
  PERMISSIONS: "/permissions",
  // Export endpoints
  ORG_UNITS_EXPORT: "/org_units/export-excel",
  ORG_UNITS_EXPORT_PDF: "/org_units/export-pdf",
  ORG_UNITS_CHART_EXPORT_PDF: "/org_units/chart/export-pdf",
  DEPARTMENTS_EXPORT: "/departments/export-excel",
  DEPARTMENTS_EXPORT_PDF: "/departments/export-pdf",
  EMPLOYEES_EXPORT: "/employees/export-excel",
  EMPLOYEES_EXPORT_PDF: "/employees/export-pdf",
  EMPLOYEES_IMPORT_TEMPLATE: "/employees/import-template",
  EMPLOYEES_IMPORT_EXCEL: "/employees/import-excel",
  POSITIONS_EXPORT: "/positions/export-excel",
  POSITIONS_EXPORT_PDF: "/positions/export-pdf",
  POSITIONS_TRASHED: "/positions/trashed",
  EMPLOYEES_TRASHED: "/employees/trashed",
  // User role scopes
  USER_ROLE_SCOPES: "/user-role-scopes",
  USER_DATA_SCOPES: "/user-data-scopes",
  TASKS: "/tasks",
  WAREHOUSES: "/warehouses",
  // Webhook M2→M3: yêu cầu header X-Webhook-Secret riêng (không dùng Bearer token).
  // Dùng để demo 403 vì contract trả 403 FORBIDDEN ổn định, không phụ thuộc quyền user.
  WEBHOOKS_M2_ORDER_PROCESSING: "/webhooks/m2/order-processing",
  // WMS Modules
  DASHBOARD: "/dashboard",
  DASHBOARD_KPI: "/dashboard/kpi",
  DASHBOARD_RECENT_DOCUMENTS: "/dashboard/recent-documents",
  DASHBOARD_RECONCILE_HEALTH: "/dashboard/reconcile-health",
  DASHBOARD_ALERTS: "/dashboard/alerts",
  // Receiving/Inbound
  INBOUND_DOCUMENTS: "/inbound/documents",
  INBOUND_DOCUMENT: "/inbound/documents/:id",
  INBOUND_LINES: "/inbound/documents/:id/lines",
  // Shipping/Outbound
  OUTBOUND_DOCUMENTS: "/outbound/documents",
  OUTBOUND_DOCUMENT: "/outbound/documents/:id",
  OUTBOUND_LINES: "/outbound/documents/:id/lines",
  // Putaway
  PUTAWAY_TASKS: "/putaway/tasks",
  PUTAWAY_HISTORY: "/putaway/history",
  // Reports
  REPORTS: "/reports",
  REPORTS_XNT: "/reports/xnt",
  // Audit Logs
  AUDIT_LOGS: "/audit-logs",
};
