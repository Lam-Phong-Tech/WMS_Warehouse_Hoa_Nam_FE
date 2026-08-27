import type { User } from "@/shared/types/user";

// Contract auth bám theo Modules/Auth/AuthController.php của BE branch m1.

/**
 * POST /auth/login accepts exactly one identity field: email OR username.
 * The UI maps a single "email / username" input into one of these shapes.
 */
export type LoginRequest =
  | { email: string; username?: never; password: string }
  | { username: string; email?: never; password: string };

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

/** POST /auth/forgot-password — luôn trả message chung, không tiết lộ email có tồn tại hay không. */
export interface ForgotPasswordRequest {
  email: string;
}

/** POST /auth/verify-otp */
export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  reset_token: string;
  expires_in: number;
}

/** POST /auth/reset-password — dùng reset_token trả về từ verify-otp. */
export interface ResetPasswordRequest {
  email: string;
  reset_token: string;
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
 * POST /auth/refresh rotates the refresh token on every success. Browser clients
 * may omit the JSON refresh_token after F5 because BE reads the long-lived token
 * from its HttpOnly cookie. Swagger/Postman/non-browser clients may continue to
 * send refresh_token in the JSON body. The rotated token remains in the response
 * for backward compatibility and same-tab memory refresh.
 */
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user?: User;
}
