/**
 * Enterprise-grade validation constants for Vietnamese business application
 * Following regexr.com/3e48o best practices
 */

// ---------------------------------------------------------------------------
// Email Validation
// ---------------------------------------------------------------------------

/**
 * Chỉ chấp nhận địa chỉ email @gmail.com (bắt buộc theo yêu cầu nghiệp vụ):
 * - Local part theo đúng chuẩn ký tự cho phép của Gmail
 * - Domain bắt buộc phải là "gmail.com", không chấp nhận nhà cung cấp khác
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/;

export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_LOCAL_PART_MAX_LENGTH = 64;

/**
 * Common email provider domains for typo detection
 */
export const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "yandex.com",
  "zoho.com",
  "company.com.vn",
  "company.vn",
] as const;

/**
 * Common typos mapping for email domains
 */
export const EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outloo.com": "outlook.com",
  "outlok.com": "outlook.com",
};

// ---------------------------------------------------------------------------
// Vietnamese Phone Number Validation
// ---------------------------------------------------------------------------

/**
 * Số điện thoại di động Việt Nam - fix cứng theo yêu cầu nghiệp vụ:
 * - Tối đa 10 ký tự, đúng 10 chữ số
 * - Bắt đầu bằng đầu số hợp lệ sau 15/09/2018: 03, 05, 07, 08, 09
 *   (dựa theo https://gist.github.com/tungvn/2460c5ba947e5cbe6606c5e85249cf04)
 * - Không chấp nhận +84, đầu số cũ (01x) hay số bàn (landline)
 */
export const PHONE_REGEX = /^(03|05|07|08|09)[0-9]{8}$/;

/**
 * Đầu số di động hợp lệ (2 chữ số đầu, sau đầu số 0)
 */
export const VALID_MOBILE_PREFIXES = ["03", "05", "07", "08", "09"] as const;

export const PHONE_MAX_LENGTH = 10;
export const PHONE_MIN_LENGTH = 10;

// ---------------------------------------------------------------------------
// Validation Helper Functions
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  suggestion?: string;
}

/**
 * Validate email with enterprise-grade checks
 */
export function validateEmail(email: string): ValidationResult {
  // Trim whitespace
  const trimmedEmail = email.trim();

  // Check length
  if (trimmedEmail.length === 0) {
    return { isValid: false, errorMessage: "Email không được để trống" };
  }

  if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Email không được vượt quá ${EMAIL_MAX_LENGTH} ký tự`,
    };
  }

  // Check local part length
  const atIndex = trimmedEmail.indexOf("@");
  if (atIndex > EMAIL_LOCAL_PART_MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Phần trước @ không được vượt quá ${EMAIL_LOCAL_PART_MAX_LENGTH} ký tự`,
    };
  }

  // Check for consecutive dots
  if (trimmedEmail.includes("..")) {
    return {
      isValid: false,
      errorMessage: "Email không được chứa dấu chấm liên tiếp",
    };
  }

  // Check for leading/trailing dots in local part
  const localPart = trimmedEmail.slice(0, atIndex);
  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return {
      isValid: false,
      errorMessage: "Email không được bắt đầu hoặc kết thúc bằng dấu chấm",
    };
  }

  // Basic format validation — bắt buộc domain phải là gmail.com
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return {
      isValid: false,
      errorMessage: "Email không hợp lệ, chỉ chấp nhận địa chỉ @gmail.com",
    };
  }

  return { isValid: true };
}

/**
 * Validate Vietnamese mobile phone number — fix cứng tối đa 10 ký tự,
 * đầu số 03/05/07/08/09 (xem PHONE_REGEX)
 */
export function validatePhone(phone: string): ValidationResult {
  // Remove common formatting characters
  const cleanedPhone = phone.replace(/[\s\-().]/g, "");

  // Check length
  if (cleanedPhone.length === 0) {
    return {
      isValid: false,
      errorMessage: "Số điện thoại không được để trống",
    };
  }

  if (cleanedPhone.length > PHONE_MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Số điện thoại không được vượt quá ${PHONE_MAX_LENGTH} ký tự`,
    };
  }

  // Check format (đã bao gồm đầu số hợp lệ và đúng 10 chữ số)
  if (!PHONE_REGEX.test(cleanedPhone)) {
    return {
      isValid: false,
      errorMessage:
        "Số điện thoại không hợp lệ (định dạng: 0xxxxxxxxx, đầu số 03/05/07/08/09)",
    };
  }

  return { isValid: true };
}

/**
 * Normalize phone number to standard format (0xxxxxxxxx)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "");
}

/**
 * Format phone number for display (0xx-xxx-xxxx)
 */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 10) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 7)}-${normalized.slice(7)}`;
  }
  return normalized;
}
