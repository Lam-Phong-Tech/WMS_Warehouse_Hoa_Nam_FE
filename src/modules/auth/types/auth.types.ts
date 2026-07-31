import type { User } from "@/shared/types/user";

// Mô hình dữ liệu (interface) của module auth.

export interface LoginRequest {
  email: string;
  password: string;
}

/** Một bối cảnh làm việc (vai trò + phạm vi) khả dụng của tài khoản. */
export interface AuthContext {
  role_id: number;
  role_name: string;
  scope_type: string;
  org_unit_id: number | null;
  org_unit_name: string | null;
  department_id: number | null;
  department_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  user: User;
  available_contexts: AuthContext[];
}

/** POST /auth/change-password — bắt buộc sau khi cấp tài khoản/reset (password_change_required). */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

/**
 * POST /auth/switch-context — chọn 1 context trong available_contexts để BE
 * cấp JWT mới đã nhúng context đó (role_id lấy từ AuthContext.role_id).
 * Token cũ bị blacklist ngay khi token mới được phát.
 */
export interface SwitchContextRequest {
  role_id: number;
  org_unit_id?: number | null;
  department_id?: number | null;
  warehouse_id?: number | null;
}

export interface SwitchContextResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * POST /auth/refresh — BE đọc `refresh_token` từ HttpOnly cookie (không cần
 * body/header), trả access token mới. BE cũng rotate cookie `refresh_token`
 * (Set-Cookie mới mỗi lần refresh) — xác nhận qua curl thật trên
 * astrodev.test8.io.vn 2026-07-15.
 */
export interface RefreshResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  user?: User;
}
