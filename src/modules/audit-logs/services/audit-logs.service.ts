import { http } from '@/shared/api/http';
import type { ApiMeta } from '@/shared/types/api-response';
import type { AuditLog, AuditLogFilters } from '../types/audit-logs.types';

/**
 * API Endpoints cho Audit Logs
 */
export const AUDIT_LOG_ENDPOINTS = {
  AUDIT_LOGS: '/audit-logs',
} as const;

/**
 * Service cho Audit Log module
 * Kết nối với backend endpoint: GET /api/v1/audit-logs
 */
export const auditLogService = {
  /**
   * Lấy danh sách audit logs với pagination và filters.
   *
   * Dùng `http.getPage()` (không phải `http.get()`) — BE trả `meta` phân
   * trang tách riêng khỏi mảng `data` (`{ data: AuditLog[], meta: {...} }`).
   * `http.get()` tự bóc `body.data` và bỏ `meta`, nên nếu dùng `get()` ở đây
   * kết quả trả về chỉ là mảng thô còn `meta.total` bị mất — đúng bug đã gặp:
   * trang Audit Log luôn hiện "Chưa có audit log" dù BE có dữ liệu thật, vì
   * `data?.data`/`data?.meta?.total` ở `AuditLogsPage` đọc nhầm vào 1 mảng
   * không có field `.data`/`.meta`.
   * @param filters - Các filter params (page, limit, module, action, user_id, q)
   */
  async getAuditLogs(
    filters: AuditLogFilters = {},
  ): Promise<{ data: AuditLog[]; meta: ApiMeta }> {
    const params = new URLSearchParams();

    // Chỉ thêm params có giá trị — đúng tên param BE thật (xem ghi chú ở
    // AuditLogFilters): `limit` (không phải `per_page`), `q` (không phải `search`).
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.module) params.append('module', filters.module);
    if (filters.action) params.append('action', filters.action);
    if (filters.user_id) params.append('user_id', filters.user_id.toString());
    if (filters.q) params.append('q', filters.q);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);

    const queryString = params.toString();
    const url = queryString
      ? `${AUDIT_LOG_ENDPOINTS.AUDIT_LOGS}?${queryString}`
      : AUDIT_LOG_ENDPOINTS.AUDIT_LOGS;

    return http.getPage<AuditLog[]>(url);
  },
};
