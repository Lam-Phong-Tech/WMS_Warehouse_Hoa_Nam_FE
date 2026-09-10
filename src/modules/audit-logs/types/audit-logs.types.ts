/**
 * Audit Log types theo backend response thật (Modules/AuditLog, BE repo).
 * Endpoint: GET /api/v1/audit-logs — xem AuditLogController::index()/myHistory().
 *
 * LƯU Ý: bản trước của file này liệt kê `auditable_type`/`auditable_id`/
 * `old_values`/`new_values`/`user_agent`/`detail` — các field đó CHƯA BAO GIỜ
 * tồn tại ở BE (đã đọc thẳng AuditLogController/AuditLogRepository/AuditLog
 * model để xác nhận), khiến trang Nhật ký hệ thống luôn hiện dữ liệu trống dù
 * BE có bản ghi thật. Type dưới đây khớp đúng cột thật trên bảng `audit_log`
 * (+ 2 cột mới `module`/`ip_address` và accessor `description`, xem migration
 * 2026_08_27_130000_add_module_and_ip_address_to_audit_log).
 */

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "REVOKE_ROLE_SCOPE"
  | "SYNC_ROLE_SCOPES"
  | "SUBMIT"
  | "CANCEL"
  | "ARCHIVE"
  | "RESTORE"
  // Phiên đăng nhập / bảo mật (mục 13).
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_DENIED"
  | "TOKEN_REFRESH"
  | "CHANGE_PASSWORD"
  | "ASSIGN_ROLES"
  | string;

/** Đúng 5 luồng theo yêu cầu vận hành mục 6 — xem AuditLogger::MODULE_*. */
export type AuditModule =
  | "SYSTEM"
  | "INBOUND"
  | "OUTBOUND"
  | "WARRANTY"
  | "STOCKTAKE";

/** Quan hệ `actor` (Modules\Auth\Models\User) — password_hash luôn bị ẩn ở BE. */
export interface AuditActor {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor: AuditActor | null;
  action: AuditAction;
  object_type: string;
  object_id: string | null;
  /**
   * Mã nghiệp vụ của đối tượng do BE tra ngược từ bảng gốc (số phiếu, mã hồ sơ,
   * serial, email tài khoản...) — `null` khi loại đối tượng không có mã hoặc bản
   * ghi gốc không còn. Xem AuditObjectReferenceResolver phía BE.
   */
  object_code?: string | null;
  module: AuditModule;
  reason: string | null;
  /** Accessor phía BE: `reason` nếu có, ngược lại tự tổng hợp "{action} {object_type} #{object_id}". */
  description: string;
  request_id: string | null;
  result: "SUCCESS" | "FAILED" | "DENIED" | null;
  error_code: string | null;
  ip_address: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Filter thật BE hỗ trợ cho `GET /audit-logs`: `page`, `per_page` (KHÔNG phải
 * `limit`), `q` (tìm theo reason/object_type/object_id), `user_id` (= actor_id,
 * UUID string — KHÔNG phải số), `action`, `module`.
 */
export interface AuditLogFilters {
  page?: number;
  /** Gửi lên BE dưới tên `per_page` — xem audit-logs.service.ts. */
  limit?: number;
  module?: AuditModule;
  action?: AuditAction;
  /** actor_id — UUID string, không phải số. */
  user_id?: string;
  /** Tìm theo mô tả/lý do (BE: `q`). */
  q?: string;
  /** Lọc created_at >= (Y-m-d hoặc Y-m-d H:i:s). */
  date_from?: string;
  /** Lọc created_at <= (Y-m-d hoặc Y-m-d H:i:s). */
  date_to?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}
