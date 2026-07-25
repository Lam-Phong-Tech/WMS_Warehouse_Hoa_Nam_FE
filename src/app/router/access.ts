import { ROUTES } from '@/shared/constants/routes';

/**
 * Nguồn DUY NHẤT khai báo quyền tối thiểu để vào mỗi route.
 * Dùng cho cả route guard (RequirePermission) lẫn lọc menu (SideNav),
 * tránh khai báo mã quyền rải rác hai nơi.
 *
 * `undefined` = ai đăng nhập cũng vào được (vd Dashboard).
 * Mảng string[] = OR — chỉ cần 1 trong các quyền là vào được route (từng
 * tab/action bên trong tự guard bằng quyền cụ thể hơn).
 */
export const ROUTE_PERMISSIONS: Record<string, string | string[] | undefined> =
  {
    // Module 1 - Organization
    [ROUTES.ORG_UNITS]: 'ORG_VIEW',
    [ROUTES.DEPARTMENTS]: 'DEPT_VIEW',
    [ROUTES.EMPLOYEES]: 'EMP_VIEW',
    [ROUTES.POSITIONS]: 'POS_VIEW',
    [ROUTES.ROLES]: 'ROLE_VIEW',
    [ROUTES.ORG_CHART]: 'ORG_VIEW',
    [ROUTES.EMPLOYEE_STATUS]: 'EMP_VIEW',
    [ROUTES.EMPLOYEE_ASSIGNMENTS]: 'EMP_ASSIGNMENT_VIEW',
    // P1: route chỉ cần 1 trong 2 quyền để vào ("Vai trò & phạm vi") — user
    // có ROLE_ASSIGN (gán vai trò) nhưng không có SCOPE_CONFIG (cấu hình scope
    // trực tiếp) vẫn phải vào được tab, vì action gán vai trò dùng ROLE_ASSIGN
    // chứ không phải SCOPE_CONFIG. Từng action/tab con tự guard quyền cụ thể
    // hơn (xem UserRoleScopesPage.tsx — PermissionGuard theo action).
    [ROUTES.USER_ROLE_SCOPES]: ['ROLE_ASSIGN', 'SCOPE_CONFIG'],
    [ROUTES.TASKS]: 'TASK_VIEW',
    // Module 2 - Warehouse
    [ROUTES.WAREHOUSE]: 'WAREHOUSE_VIEW',
    [ROUTES.WAREHOUSES]: 'WAREHOUSE_VIEW',
    [ROUTES.STOCK_RECEIPTS]: 'STOCK_RECEIPT_VIEW',
    [ROUTES.STOCK_ISSUES]: 'STOCK_ISSUE_VIEW',
    [ROUTES.STOCK_TRANSFERS]: 'STOCK_TRANSFER_VIEW',
    [ROUTES.INVENTORY_BALANCE]: 'INVENTORY_VIEW',
    [ROUTES.STOCK_MOVEMENTS]: 'STOCK_MOVEMENT_VIEW',
    // Module 3 - Business
    [ROUTES.BUSINESS]: 'BUSINESS_VIEW',
    [ROUTES.PRODUCTS]: 'PRODUCT_VIEW',
    [ROUTES.PRICE_LISTS]: 'PRICE_LIST_VIEW',
    [ROUTES.CUSTOMERS]: 'CUSTOMER_VIEW',
    [ROUTES.SALES_ORDERS]: 'SALES_ORDER_VIEW',
    [ROUTES.SALES_CHANNELS]: 'SALES_CHANNEL_VIEW',
    // Shared
    [ROUTES.AUDIT_LOGS]: 'AUDIT_LOG_VIEW',
    '/demo/api-errors': 'SCOPE_CONFIG', // Demo page - requires scope config permission
    [ROUTES.PERMISSION_DEMO]: 'SCOPE_CONFIG', // Permission demo page
  };
