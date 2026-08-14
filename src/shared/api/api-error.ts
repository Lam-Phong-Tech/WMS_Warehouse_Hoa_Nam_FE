/**
 * ApiErrorResponse — định nghĩa local để tránh circular dependency.
 * Xem bản gốc ở shared/types/api-response.ts.
 */
interface ApiErrorResponse {
  success?: false;
  status?: "error";
  message: string;
  error_code?: string;
  errors?: Record<string, string[] | string>;
  request_id?: string;
  error?: {
    code?: string;
    details?: Record<string, string[] | string>;
  };
  meta?: {
    request_id?: string;
    [key: string]: unknown;
  };
}

/** Mã lỗi nghiệp vụ — đọc `error_code` (flat) trước, fallback `error.code` (nested). */
function getErrorCode(body: ApiErrorResponse | undefined): string | undefined {
  return body?.error_code ?? body?.error?.code;
}

function formatFieldErrors(
  errors?: Record<string, string[] | string>,
): string | undefined {
  if (!errors || Object.keys(errors).length === 0) return undefined;
  return Object.entries(errors)
    .map(
      ([field, message]) =>
        `${field}: ${Array.isArray(message) ? message[0] : String(message)}`,
    )
    .join("; ");
}

/** Lỗi validation theo field — đọc `errors` (flat) trước, fallback `error.details` (nested). */
function getFieldErrors(
  body: ApiErrorResponse | undefined,
): Record<string, string[] | string> | undefined {
  return body?.errors ?? body?.error?.details;
}

/** request_id để tra log — đọc root-level trước, fallback `meta.request_id` (nested). */
function getRequestId(body: ApiErrorResponse | undefined): string | undefined {
  return body?.request_id ?? body?.meta?.request_id;
}

/**
 * ApiEnvelopeError — định nghĩa local để tránh circular dependency.
 * Xem bản gốc ở shared/types/api-response.ts.
 */
export class ApiEnvelopeError extends Error {
  readonly data: ApiErrorResponse;

  constructor(data: ApiErrorResponse) {
    super(data.message ?? "Yêu cầu không thành công");
    this.name = "ApiEnvelopeError";
    this.data = data;
  }
}
/**
 * Check if error is an AxiosError without relying on axios.isAxiosError mock.
 * This avoids test mocking issues with vi.mock('axios').
 */
function isAxiosError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "isAxiosError" in error &&
    (error as Record<string, unknown>).isAxiosError === true
  );
}

/**
 * Đọc body lỗi bất kể lỗi tới từ đâu: `AxiosError` (HTTP 4xx/5xx bình thường)
 * hoặc `ApiEnvelopeError` (BE trả lỗi nghiệp vụ kèm HTTP 2xx — xem http.ts).
 * Mọi hàm đọc `message`/`error_code`/`errors` bên dưới dùng hàm này thay vì
 * check trực tiếp `axios.isAxiosError` để không bỏ sót case HTTP 2xx.
 */
function getResponseData(error: unknown): ApiErrorResponse | undefined {
  if (isAxiosError(error)) {
    const err = error as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;
    return response?.data as ApiErrorResponse | undefined;
  }
  if (error instanceof ApiEnvelopeError) {
    return error.data;
  }
  return undefined;
}

export interface MockAxiosError {
  isAxiosError: boolean;
  config: Record<string, unknown>;
  response: {
    status: number;
    statusText: string;
    data: Record<string, unknown>;
    headers: Record<string, string>;
  };
  code?: string;
  message: string;
  name: string;
  _isNoPermission?: boolean;
  _isValidationError?: boolean;
  _isConflictError?: boolean;
}

/**
 * Factory function để tạo mock AxiosError cho testing.
 * Giúp tests không cần mock axios module.
 */
export function createMockAxiosError(
  overrides: {
    status?: number;
    statusText?: string;
    data?: Record<string, unknown>;
    code?: string;
    headers?: Record<string, string>;
    _isNoPermission?: boolean;
    _isValidationError?: boolean;
    _isConflictError?: boolean;
  } = {},
): MockAxiosError {
  const {
    status = 400,
    statusText = "Bad Request",
    data = {},
    code,
    headers = {},
    _isNoPermission = false,
    _isValidationError = false,
    _isConflictError = false,
  } = overrides;

  const error: MockAxiosError = {
    isAxiosError: true,
    config: {},
    response: {
      status,
      statusText,
      data,
      headers,
    },
    code,
    message: (data.message as string) || statusText,
    name: "AxiosError",
  };

  if (_isNoPermission) error._isNoPermission = true;
  if (_isValidationError) error._isValidationError = true;
  if (_isConflictError) error._isConflictError = true;

  return error;
}

/**
 * Lỗi đã được chuẩn hoá để UI hiển thị nhất quán.
 * Mọi nơi chỉ cần đọc `message`; `status`/`code`/`errors` dùng khi cần xử lý riêng.
 */
export interface NormalizedError {
  message: string;
  /** HTTP status code (vd 404, 422). */
  status?: number;
  /** Mã lỗi nghiệp vụ từ backend (`error_code`) hoặc axios code. */
  code?: string;
  /** Lỗi validation theo từng field (`errors`). */
  errors?: Record<string, string[] | string>;
  raw: unknown;
}

/**
 * Kiểm tra lỗi có phải là "no-permission" (403) không.
 * Được đánh dấu bởi interceptor trong axios.ts.
 */
export function isNoPermissionError(error: unknown): boolean {
  if (isAxiosError(error)) {
    const err = error as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;
    const data = response?.data as ApiErrorResponse | undefined;
    const status = Number(response?.status);
    const code = getErrorCode(data);

    return (
      err._isNoPermission === true ||
      (status === 403 && code !== "PASSWORD_CHANGE_REQUIRED")
    );
  }

  if (error instanceof ApiEnvelopeError) {
    const code = getErrorCode(error.data);
    return (
      error.data.status === "error" &&
      code !== "PASSWORD_CHANGE_REQUIRED" &&
      (code === "FORBIDDEN" ||
        code === "PERMISSION_DENIED" ||
        code === "NO_PERMISSION" ||
        code === "ACCESS_DENIED")
    );
  }

  return false;
}

/**
 * Kiểm tra lỗi có phải là validation error (422) không.
 */
export function isValidationError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    (error as Record<string, unknown>)._isValidationError === true
  );
}

/**
 * Kiểm tra lỗi có phải là conflict error (409) không.
 */
export function isConflictError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    (error as Record<string, unknown>)._isConflictError === true
  );
}

/**
 * Thông điệp lỗi thân thiện dùng chung ở mutation-level (onError của
 * create/update/delete...): xử lý riêng case 403 - no permission, mọi lỗi
 * khác (409 conflict, 422, 5xx...) fallback nguyên sang `getApiErrorMessage`.
 * Không phải chỉ dành cho 403 dù tên gốc `getNoPermissionMessage` (giữ lại
 * bên dưới để tương thích ngược) dễ gây hiểu nhầm như vậy.
 */
export function getMutationErrorMessage(error: unknown): string {
  if (isNoPermissionError(error)) {
    const err = error as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;
    const data = response?.data as ApiErrorResponse | undefined;
    return (
      data?.message ??
      "Bạn không có quyền thực hiện thao tác này. Liên hệ quản trị viên để được cấp quyền."
    );
  }
  return getApiErrorMessage(error);
}

/**
 * @deprecated Dùng {@link getMutationErrorMessage} — tên này dễ hiểu lầm là
 * chỉ áp dụng cho lỗi 403 trong khi thực chất fallback đúng cho mọi lỗi
 * mutation khác (409, 422, 5xx...). Giữ lại làm alias tương thích ngược.
 */
export const getNoPermissionMessage = getMutationErrorMessage;

const DEFAULT_MESSAGE = "Lỗi hệ thống";

/**
 * Trích thông điệp lỗi thân thiện từ bất kỳ lỗi nào (axios / Error / unknown).
 * Ưu tiên `message` trong envelope API (`{ success, message, error_code, errors }`),
 * sau đó tới lỗi mạng/timeout, cuối cùng là fallback.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = DEFAULT_MESSAGE,
): string {
  const data = getResponseData(error);
  if (data) {
    // BE (ApiError::abort / ApiConventionMiddleware) luôn gửi kèm cả `message`
    // (câu tiếng Việt thân thiện) và `error_code` (mã SCREAMING_SNAKE_CASE
    // dùng để so sánh bằng code, không phải để hiển thị). Phải ưu tiên message
    // trước, nếu không người dùng sẽ luôn thấy mã lỗi thô thay vì câu giải
    // thích — vì error_code hầu như luôn có mặt trên mọi response lỗi.
    if (data.message) return data.message;

    const fieldErrors = formatFieldErrors(getFieldErrors(data));
    if (fieldErrors) return fieldErrors;

    const errorCode = getErrorCode(data);
    if (errorCode) return errorCode;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message?: string }).message
  ) {
    const msg = (error as { message: string }).message;
    if (msg !== "Bad Request" && msg !== "Internal Server Error") {
      return msg;
    }
  }

  if (isAxiosError(error)) {
    const axiosErr = error as Record<string, unknown>;
    if (axiosErr.code === "ECONNABORTED") {
      return "Yêu cầu quá thời gian, vui lòng thử lại.";
    }
    if (axiosErr.code === "ERR_NETWORK") {
      return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
    }

    const response = axiosErr.response as Record<string, unknown> | undefined;
    if (response?.status) {
      const status = Number(response.status);
      if (status >= 500) return fallback;
      return `Máy chủ trả về lỗi (${String(status)}).`;
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Chuyển snake_case thành camelCase.
 * Ví dụ: org_unit_id → orgUnitId, tax_code → taxCode, manager_id → managerId
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Map field errors từ snake_case (BE) sang camelCase (FE form field names).
 * Các field mapping đặc biệt cho M1 P0 modules.
 */
const FIELD_MAP: Record<string, string> = {
  org_unit_id: "orgUnitId",
  tax_code: "taxCode",
  manager_id: "managerId",
  parent_id: "parentId",
  effective_date: "effectiveDate",
  employee_status: "employeeStatus",
  account_status: "accountStatus",
  hire_date: "hireDate",
  personal_tax_code: "personalTaxCode",
  full_name: "fullName",
  unit_type: "unitType",
  permission_ids: "permissionIds",
};

/**
 * Trích danh sách lỗi validation theo từng field từ BE (HTTP 422).
 * Trả về `{ camelCaseFieldName: firstMessage }` (đã map snake_case → camelCase),
 * hoặc `null` nếu không có lỗi field.
 * Dùng để set lỗi inline trong react-hook-form.
 *
 * Đọc cả 2 contract lỗi BE đang publish song song (xem OpenAPI spec thật của
 * dự án, schema `ApiValidationError` vs `ValidationErrorResponse`):
 * root-level `errors` (vd module employee-assignments) và nested
 * `error.details` (đa số endpoint mới — webhooks, sales-order, price-list...).
 * Nếu BE gộp hẳn về 1 trong 2 dạng sau này, hàm này vẫn đọc đúng vì
 * `getFieldErrors()` tự fallback, không cần sửa lại nơi gọi.
 */
export function extractFieldErrors(
  error: unknown,
): Record<string, string> | null {
  const data = getResponseData(error);
  const fieldErrors = getFieldErrors(data);
  if (!fieldErrors) return null;
  const result: Record<string, string> = {};
  for (const [field, msgs] of Object.entries(fieldErrors)) {
    const camelField = FIELD_MAP[field] ?? snakeToCamel(field);
    result[camelField] = Array.isArray(msgs) ? msgs[0] : String(msgs);
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Trích lỗi validation theo field, giữ nguyên tên field gốc (snake_case) từ BE
 * — không map sang camelCase như {@link extractFieldErrors}. Dùng cho các form
 * mà tên field khớp thẳng với payload gửi lên BE (vd `employee_id`, `start_date`).
 */
export function extractFieldErrorsRaw(
  error: unknown,
): Record<string, string> | null {
  const data = getResponseData(error);
  const fieldErrors = getFieldErrors(data);
  if (!fieldErrors) return null;
  const result: Record<string, string> = {};
  for (const [field, msgs] of Object.entries(fieldErrors)) {
    result[field] = Array.isArray(msgs) ? msgs[0] : String(msgs);
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Gom lỗi về một shape thống nhất (dùng khi cần status/code, không chỉ message). */
export function normalizeError(error: unknown): NormalizedError {
  const data = getResponseData(error);
  if (data) {
    const axiosErr = error as Record<string, unknown>;
    const response = axiosErr.response as Record<string, unknown> | undefined;
    return {
      message: getApiErrorMessage(error),
      status: isAxiosError(error)
        ? (response?.status as number | undefined)
        : undefined,
      code:
        getErrorCode(data) ??
        (isAxiosError(error)
          ? (axiosErr.code as string | undefined)
          : undefined),
      errors: getFieldErrors(data),
      raw: error,
    };
  }
  return { message: getApiErrorMessage(error), raw: error };
}

/** request_id để tra log / báo cho BE khi debug lỗi (đọc cả root-level và `meta.request_id`). */
export function getErrorRequestId(error: unknown): string | undefined {
  return getRequestId(getResponseData(error));
}
