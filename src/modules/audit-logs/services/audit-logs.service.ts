import { http } from "@/shared/api/http";
import type { ApiMeta } from "@/shared/types/api-response";
import type { AuditLog, AuditLogFilters } from "../types/audit-logs.types";

/**
 * Bản ghi lịch sử thay đổi TRÊN chính tài khoản (GET /audit-logs/me) — khớp
 * đúng cột thật của bảng `audit_log` (actor_id/object_type/object_id/reason/
 * before_data/after_data), KHÁC với type `AuditLog` phía trên (type đó theo
 * ghi chú là khảo sát từ 1 Swagger/API khác, cột không khớp bảng `audit_log`
 * thật — vd `object_id: number` trong khi cột thật là UUID string). Định
 * nghĩa type riêng ở đây để không phụ thuộc vào type có thể sai đó.
 */
export interface MyPermissionHistoryEntry {
  id: string;
  actor_id: string | null;
  action: string;
  object_type: string;
  object_id: string;
  reason: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

/**
 * API Endpoints cho Audit Logs
 */
export const AUDIT_LOG_ENDPOINTS = {
  AUDIT_LOGS: "/audit-logs",
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

    // Chỉ thêm params có giá trị — đúng tên param BE thật (đã đọc trực tiếp
    // AuditLogController::index() để xác nhận): `per_page` (KHÔNG phải
    // `limit` — gửi `limit` khiến BE luôn dùng default 10 và bỏ qua page
    // size UI chọn), `q` (không phải `search`), `user_id` là UUID string.
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("per_page", filters.limit.toString());
    if (filters.module) params.append("module", filters.module);
    if (filters.action) params.append("action", filters.action);
    if (filters.user_id) params.append("user_id", filters.user_id);
    if (filters.q) params.append("q", filters.q);
    if (filters.date_from) params.append("date_from", filters.date_from);
    if (filters.date_to) params.append("date_to", filters.date_to);
    if (filters.sort_by) params.append("sort_by", filters.sort_by);
    if (filters.sort_order) params.append("sort_order", filters.sort_order);

    const queryString = params.toString();
    const url = queryString
      ? `${AUDIT_LOG_ENDPOINTS.AUDIT_LOGS}?${queryString}`
      : AUDIT_LOG_ENDPOINTS.AUDIT_LOGS;

    return http.getPage<AuditLog[]>(url);
  },

  /**
   * Yêu cầu #6/#7: user thường tự xem lịch sử thay đổi TRÊN chính tài khoản
   * mình (không cần quyền audit_log.view) — endpoint riêng `/audit-logs/me`,
   * BE tự ép object_type/object_id về đúng user đang gọi. Dùng `per_page`
   * (không phải `limit`) vì đây là param `myHistory()` thật sự đọc.
   */
  async getMyPermissionHistory(
    params: { page?: number; per_page?: number; action?: string } = {},
  ): Promise<{ data: MyPermissionHistoryEntry[]; meta: ApiMeta }> {
    const search = new URLSearchParams();
    if (params.page) search.append("page", params.page.toString());
    if (params.per_page) search.append("per_page", params.per_page.toString());
    if (params.action) search.append("action", params.action);

    const queryString = search.toString();
    const url = queryString
      ? `${AUDIT_LOG_ENDPOINTS.AUDIT_LOGS}/me?${queryString}`
      : `${AUDIT_LOG_ENDPOINTS.AUDIT_LOGS}/me`;

    return http.getPage<MyPermissionHistoryEntry[]>(url);
  },
};
