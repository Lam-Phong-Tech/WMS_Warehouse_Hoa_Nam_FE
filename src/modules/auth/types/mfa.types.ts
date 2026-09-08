/**
 * WWHN-SEC-08 — hợp đồng xác thực hai bước, bám theo
 * Modules/Auth/app/Http/Controllers/MfaController.php của BE.
 */

/** POST /auth/login khi tài khoản đã bật MFA — CHƯA có access token. */
export interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
  expires_in: number;
}

/** GET /auth/mfa/status */
export interface MfaStatus {
  enabled: boolean;
  /** Đã tạo bí mật nhưng chưa xác nhận bằng một mã hợp lệ. */
  pending: boolean;
  required_for_role: boolean;
  enforced: boolean;
  must_enroll_now: boolean;
  recovery_codes_remaining: number;
}

/** POST /auth/mfa/enroll */
export interface MfaEnrollment {
  /** Base32 — hiển thị để người dùng nhập tay khi không quét được QR. */
  secret: string;
  otpauth_uri: string;
  digits: number;
  period: number;
}

/**
 * POST /auth/mfa/confirm — mã khôi phục CHỈ trả về đúng một lần ở đây.
 * FE không được lưu chúng vào bất kỳ storage nào; người dùng tự sao chép.
 */
export interface MfaConfirmResult {
  recovery_codes: string[];
}
