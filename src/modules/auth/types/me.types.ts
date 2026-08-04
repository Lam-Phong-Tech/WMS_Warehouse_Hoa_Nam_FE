// Mô hình response GET /auth/me (hồ sơ tài khoản hiện tại + phân quyền theo
// context).
//
// ĐÍNH CHÍNH (2026-07-12, xác minh curl thật trên astrodev.test8.io.vn):
// BE runtime THẬT SỰ trả `is_super_admin` (boolean) ở top-level `data` —
// khác với giả định cũ ("Swagger không có is_super_admin ở top-level").
// FE trước đây suy luận isSuperAdmin bằng heuristic
// (`active_context === null && available_contexts.length === 0`), heuristic
// này SAI khi tài khoản Super Admin có active_context (vd. được gán thêm
// role+scope qua user_role_scopes) — khiến FE coi nhầm là không phải Super
// Admin và chặn UI dù BE cho phép. Xem docs/api-evidence/roles.md mục
// "PHÁT HIỆN QUAN TRỌNG" (2026-07-11) về sự cố liên quan.
import type { AuthContext } from "@/modules/auth/types/auth.types";

export interface MeOrgRef {
  id: number;
  name: string;
}

export interface MePermission {
  id: number;
  name: string;
}

export interface MeRole {
  id: number;
  name: string;
  permissions: MePermission[];
}

/**
 * Context (role + scope) kèm permission_codes riêng cho context đó.
 * `active_context`: context đang nhúng trong JWT hiện tại — null nếu là
 * super-admin (bỏ qua toàn bộ hệ thống context) hoặc user có ≥2 context
 * nhưng chưa gọi /auth/switch-context sau khi login.
 */
export interface MeContext extends AuthContext {
  permission_codes: string[];
}

export interface MeResponse {
  id: number | string;
  user_id?: string;
  username?: string;
  name: string;
  display_name?: string;
  email: string;
  code: string;
  status?: string;
  roles?: Array<{
    role_id: string;
    role_code: string;
    role_name: string;
  }>;
  permissions?: string[];
  phone?: string | null;
  company: MeOrgRef | null;
  branch: MeOrgRef | null;
  department: MeOrgRef | null;
  position: MeOrgRef | null;
  role: MeRole;
  active_context: MeContext | null;
  available_contexts: MeContext[];
  /** Field thật từ BE runtime (xem đính chính ở đầu file) — dùng để xác định
   * Super Admin thay vì suy luận qua active_context/available_contexts. */
  is_super_admin?: boolean;
}
