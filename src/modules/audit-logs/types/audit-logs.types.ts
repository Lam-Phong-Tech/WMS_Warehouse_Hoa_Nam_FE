/**
 * Audit Log types theo backend response
 * Endpoint: GET /api/v1/audit-logs
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
  | "RESTORE";

export interface AuditUser {
  id: number;
  email: string;
  status: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  password_change_required: boolean;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: AuditAction;
  object_type: string | null;
  object_id: number | null;
  detail: string | null;
  ip_address: string;
  created_at: string;
  module: string;
  auditable_type: string;
  auditable_id: number;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  description: string;
  user_agent: string | null;
  user: AuditUser;
}

/**
 * Filter thật BE hỗ trợ cho `GET /audit-logs` — đã xác nhận qua Swagger thật
 * (`https://astrodev.test8.io.vn/docs?api-docs.json`, tag "15. Audit Log") và
 * gọi trực tiếp endpoint: chỉ nhận `page`, `limit` (KHÔNG phải `per_page`),
 * `q` (KHÔNG phải `search`), `user_id`, `action`, `module`. Không có
 * `auditable_type`/`auditable_id`/`start_date`/`end_date` — các field này đã
 * bị xoá khỏi type vì UI cũng chưa có chỗ nào gửi (aspirational, không có
 * evidence BE hỗ trợ).
 */
export interface AuditLogFilters {
  page?: number;
  limit?: number;
  module?: string;
  action?: AuditAction;
  user_id?: number;
  /** Tìm theo mô tả (BE: `q`). */
  q?: string;
  /** Trường sắp xếp phía backend (chỉ cột trực tiếp trên audit_logs, vd created_at). */
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface AuditLogDetail extends AuditLog {
  // Extends base AuditLog with additional computed fields
  formatted_created_at: string;
  action_label: string;
  module_label: string;
  changes_summary: string | null;
}
