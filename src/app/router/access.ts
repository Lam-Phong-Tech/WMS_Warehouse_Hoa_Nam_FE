import { ROUTES } from '@/shared/constants/routes';

/**
 * Nguồn DUY NHẤT khai báo quyền tối thiểu để vào mỗi route.
 * Dùng cho cả route guard (RequirePermission) lẫn lọc menu (SideNav),
 * tránh khai báo mã quyền rải rác hai nơi.
 *
 * `undefined` = ai đăng nhập cũng vào được.
 * Mảng string[] = OR — chỉ cần 1 trong các quyền là vào được route.
 */
export const ROUTE_PERMISSIONS: Record<string, string | string[] | undefined> = {
  // WMS P0 - Quản lý kho
  // Permission mapping theo Wireframe P0 tab 12A (Screen map & stock effect)
  // Chi tiết action-level permission xem bảng 12D
  
  [ROUTES.DASHBOARD]: undefined, // Dashboard tổng quan - ai cũng xem được
  [ROUTES.MASTER]: ['sku.manage', 'master.manage'],      // Danh mục & SKU
  [ROUTES.PHYSICAL_CODES]: ['inventory.trace', 'scan.classify'], // Mã vật lý
  [ROUTES.INBOUND]: ['inbound.create', 'inbound.post'],          // Nhập kho
  [ROUTES.PUTAWAY]: ['putaway.manage'],                          // Putaway
  [ROUTES.OUTBOUND]: ['outbound.create', 'outbound.post'],       // Xuất kho
  [ROUTES.INVENTORY]: ['inventory.view'],                        // Tồn & truy vết
  [ROUTES.STOCKTAKE]: ['stocktake.count'],                       // Kiểm kê
  [ROUTES.WARRANTY]: ['warranty.manage'],                        // Bảo hành
  [ROUTES.REVERSAL]: ['inventory.reversal.post'],                // Reversal
  [ROUTES.REPORTS]: ['report.view'],                             // Báo cáo

  // Shared
  [ROUTES.AUDIT_LOGS]: 'AUDIT_LOG_VIEW',
};
