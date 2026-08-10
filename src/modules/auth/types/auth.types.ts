import type { User } from "@/shared/types/user";

// Contract auth bám theo Modules/Auth/AuthController.php của BE branch m1.

export interface LoginRequest {
  email: string;
  password: string;
}

/** Context nội bộ của FE, được suy ra từ roles[].scope_ref/warehouse_scope_ids. */
export interface AuthContext {
  role_id: number | string;
  role_name: string;
  scope_type: string;
  org_unit_id: number | null;
  org_unit_name: string | null;
  department_id: number | null;
  department_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  /** Các field contract thật của POST /auth/switch-context. */
  context_type?: string | null;
  context_id?: string | null;
  scope_ref?: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  /** FE dựng từ user.roles/user.warehouse_scope_ids vì BE m1 không trả available_contexts. */
  available_contexts: AuthContext[];
}

/** POST /auth/change-password — BE dùng Laravel confirmed cho new_password. */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

/** Payload thật của POST /api/v1/auth/switch-context trên BE m1. */
export interface SwitchContextRequest {
  context_type?: string | null;
  context_id?: string | null;
  scope_ref?: string | null;
}

export interface AuthActiveContext {
  context_type: string;
  context_id: string | null;
  scope_ref: string | null;
}

export interface SwitchContextResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  active_context: AuthActiveContext;
  user?: User;
}

/**
 * POST /auth/refresh — BE m1 yêu cầu refresh_token trong JSON body và rotate
 * token ở mỗi lần refresh. Token cũ bị revoke; replay có thể khoá toàn bộ phiên.
 */
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user?: User;
}
