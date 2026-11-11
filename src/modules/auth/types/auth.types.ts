import type { User } from "@/shared/types/user";

// Contract auth bám theo Modules/Auth/AuthController.php của BE branch m1.

/**
 * POST /auth/login identifies accounts by email.
 * The login form sends this field after trimming and lowercasing it.
 */
export type LoginPowSolution = {
  challenge_id: string;
  solution: number;
};

export type LoginRequest = {
  email: string;
  password: string;
  step_up_token?: string;
  pow?: LoginPowSolution;
  pow_supported?: boolean;
};

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

/**
 * P1 bảo mật 10/09/2026: không có trường refresh token. Trình duyệt chỉ nhận refresh
 * token trong cookie HttpOnly do BE đặt; JavaScript không đọc, không lưu được nó.
 */
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  /** FE dựng từ user.roles/user.warehouse_scope_ids vì BE m1 không trả available_contexts. */
  available_contexts: AuthContext[];
  /** True only when this completed login displaced an active older session. */
  replaced_existing_session?: boolean;
}

/**
 * WWHN-SEC-08 — POST /auth/login nay tra ve MOT TRONG HAI ket qua.
 *
 * Dung union co discriminant thay vi mot interface co field optional: kieu
 * optional cho phep doc `access_token` o nhanh MFA ma TypeScript khong phan
 * doi, tuc la de lot dung loi "tuong da dang nhap" ma ta muon chan.
 */
export type AuthenticatedLogin = LoginResponse & { kind: "authenticated" };

export type MfaRequiredLogin = {
  kind: "mfa_required";
  mfa_required: true;
  mfa_token: string;
  expires_in: number;
};

export type StepUpRequired = {
  kind: "step_up_required";
  step_up_required: true;
  step_up_token: string;
  method: "mfa" | "email";
  masked_email: string;
  expires_in: number;
};

export type DeviceVerificationRequired = {
  kind: "device_verification_required";
  device_verification_required: true;
  device_token: string;
  masked_email: string;
  expires_in: number;
};

export type StepUpVerifyResponse = {
  step_up_verified: true;
  password_attempts_left: number;
  expires_in: number;
};

export type PowChallenge = {
  challenge_id: string;
  nonce: string;
  difficulty: number;
  algorithm: string;
  expires_in: number;
};

export type LoginResult =
  | AuthenticatedLogin
  | MfaRequiredLogin
  | StepUpRequired
  | DeviceVerificationRequired;

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
 * POST /auth/refresh (P1 bảo mật 10/09/2026): trình duyệt gửi body rỗng, cookie
 * HttpOnly mang refresh token; BE xoay vòng token trong Set-Cookie và chỉ trả access
 * token + hồ sơ trong JSON. Kiểu này cố ý không có trường refresh token.
 */
export interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user?: User;
}
