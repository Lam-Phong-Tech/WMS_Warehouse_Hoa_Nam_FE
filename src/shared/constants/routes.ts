export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  CHANGE_PASSWORD: '/change-password',
  PROFILE: '/profile',
  // Module 1 - Organization
  ORG_UNITS: '/org-units',
  // Branch-mode của /org-units (không phải page riêng) — xem OrgUnitsPage.tsx
  ORG_UNITS_BRANCHES: '/org-units?mode=branch',
  DEPARTMENTS: '/departments',
  EMPLOYEES: '/employees',
  POSITIONS: '/positions',
  ROLES: '/roles',
  ORG_CHART: '/org-chart',
  EMPLOYEE_STATUS: '/employee-status',
  USER_ROLE_SCOPES: '/user-role-scopes',
  TASKS: '/tasks',
  EMPLOYEE_ASSIGNMENTS: '/employee-assignments',
  // Module 2 - Warehouse
  WAREHOUSE: '/warehouse',
  WAREHOUSES: '/warehouses',
  STOCK_RECEIPTS: '/stock-receipts',
  STOCK_ISSUES: '/stock-issues',
  STOCK_TRANSFERS: '/stock-transfers',
  INVENTORY_BALANCE: '/inventory-balance',
  STOCK_MOVEMENTS: '/stock-movements',
  // Module 3 - Business
  BUSINESS: '/business',
  PRODUCTS: '/products',
  PRICE_LISTS: '/price-lists',
  CUSTOMERS: '/customers',
  SALES_ORDERS: '/sales-orders',
  SALES_CHANNELS: '/sales-channels',
  // Shared
  AUDIT_LOGS: '/audit-logs',
  NO_PERMISSION: '/errors/403',
  // Demo
  PERMISSION_DEMO: '/demo/permission',
  SHARED_COMPONENTS_DEMO: '/demo/components',
};
