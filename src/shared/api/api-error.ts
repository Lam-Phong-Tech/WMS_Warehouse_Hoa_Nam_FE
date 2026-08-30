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

/**
 * Câu tổng chung chung của BE cho lỗi nhập liệu: đúng về mặt kỹ thuật nhưng
 * không nói được người dùng đã sai ở đâu. Khi response kèm theo `errors` chi
 * tiết theo từng trường, các câu này phải nhường chỗ cho chi tiết đó.
 */
const GENERIC_VALIDATION_MESSAGES = new Set([
  "Dữ liệu gửi lên không hợp lệ.",
  "Dữ liệu đầu vào không hợp lệ.",
  "Dữ liệu không hợp lệ.",
  "Dữ liệu không đáp ứng quy tắc nghiệp vụ.",
  "Yêu cầu không hợp lệ.",
  "Không thể thực hiện yêu cầu do dữ liệu hoặc trạng thái hiện tại không hợp lệ.",
  "The given data was invalid.",
  "Validation failed.",
]);

function isGenericValidationMessage(message?: string): boolean {
  return !!message && GENERIC_VALIDATION_MESSAGES.has(message.trim());
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PURE_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * `errors`/`error.details` được thiết kế cho lỗi VALIDATE (giá trị luôn là một
 * câu tiếng Việt hoàn chỉnh, xem lang/vi/validation.php — mọi câu đều dạng
 * ":Attribute ..."). Một số endpoint nghiệp vụ (không phải validate) tái dùng
 * đúng field này để đính kèm SIÊU DỮ LIỆU audit cho việc retry/debug (uuid sự
 * kiện, version, cờ boolean...) — đó không phải câu dành cho người đọc.
 *
 * Nếu không lọc, một lỗi in nhãn thất bại sẽ hiện đúng như đã gặp thật:
 * "54ce74be-9359-... In thất bại 4 false" thay vì một câu rõ nghĩa, vì
 * {@link formatFieldErrors} nối thẳng mọi giá trị trong `errors` lại. Loại các
 * giá trị không "trông giống câu" (UUID/số thuần/boolean) trước khi hiển thị;
 * không đụng tới câu message thật nào vì câu message luôn có khoảng trắng/chữ
 * cái, không bao giờ khớp các mẫu dưới đây.
 */
function looksLikeDisplayMessage(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (trimmed === "true" || trimmed === "false") return false;
  if (UUID_PATTERN.test(trimmed)) return false;
  if (PURE_NUMBER_PATTERN.test(trimmed)) return false;
  return true;
}

/**
 * Ghép các lỗi theo từng trường thành một câu đọc được.
 *
 * KHÔNG kèm tên trường thô (`email: ...`): tên đó là khoá kỹ thuật snake_case
 * của API, người dùng cuối không hiểu. Message của BE đã tự mở đầu bằng nhãn
 * tiếng Việt của chính trường đó (xem lang/vi/validation.php — mọi câu đều
 * dạng ":Attribute ..."), nên nối thẳng là đủ ngữ cảnh và đọc tự nhiên hơn.
 */
function formatFieldErrors(
  errors?: Record<string, string[] | string>,
): string | undefined {
  if (!errors || Object.keys(errors).length === 0) return undefined;
  const messages = Object.values(errors)
    .map((message) => (Array.isArray(message) ? message[0] : String(message)))
    .filter(looksLikeDisplayMessage);
  return messages.length > 0 ? messages.join(" ") : undefined;
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
 * WWHN-267 (FE267-D06) — danh mục mã lỗi 403 mà backend thực sự phát ra.
 *
 * SRS §8.2 liệt kê `PERMISSION_DENIED` / `DATA_SCOPE_DENIED` ở cột *ví dụ*, còn cài
 * đặt dùng `ACCESS_DENIED` làm mã mặc định và thêm `WAREHOUSE_SCOPE_DENIED` cho
 * denial theo phạm vi kho. Khác biệt tên gọi đang chờ disposition của BA + Tech Lead
 * (xem `docs/evidence/WWHN-267/HTTP_ERROR_CODE_PAIRING.json` → DIV-403-01), nên FE
 * không được đoán *một* tên: mỗi nơi tự viết `code === "ACCESS_DENIED"` là một chỗ sẽ
 * âm thầm mất thông điệp riêng ngay khi backend trả tên khác trong cùng hạng 403.
 *
 * Quy tắc: ưu tiên nhận diện theo HTTP 403; chỉ dùng danh mục này cho nhánh không có
 * status (lỗi nghiệp vụ gói trong envelope 2xx) hoặc khi cần phân biệt thông điệp.
 */
export const FORBIDDEN_ERROR_CODES = [
  "FORBIDDEN",
  "NO_PERMISSION",
  "ACCESS_DENIED",
  "PERMISSION_DENIED",
  "DATA_SCOPE_DENIED",
  "WAREHOUSE_SCOPE_DENIED",
] as const;

/** True nếu `code` thuộc danh mục 403 đã chốt của backend. */
export function isForbiddenErrorCode(code: string | undefined): boolean {
  return (
    code !== undefined &&
    (FORBIDDEN_ERROR_CODES as readonly string[]).includes(code)
  );
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
    // WWHN-289: §8.2 xếp DATA_SCOPE_DENIED cùng hạng 403 với PERMISSION_DENIED.
    // Nhánh axios đã bắt theo status===403, nhưng nhánh ApiEnvelopeError (BE trả lỗi
    // nghiệp vụ kèm HTTP 2xx) không có status để dựa vào nên phải so theo danh mục.
    // WWHN-267: danh mục đó chuyển sang FORBIDDEN_ERROR_CODES — trước đây thiếu
    // WAREHOUSE_SCOPE_DENIED (ScanController phát mã này ở hạng 403) nên denial theo
    // phạm vi kho hiện ra như lỗi hệ thống chung chung, đúng lỗi mà WWHN-289 đã sửa
    // một lần cho DATA_SCOPE_DENIED.
    return (
      error.data.status === "error" &&
      code !== "PASSWORD_CHANGE_REQUIRED" &&
      isForbiddenErrorCode(code)
    );
  }

  return false;
}

/**
 * WWHN-289: lỗi 429 RATE_LIMIT_EXCEEDED (khoá brute-force `/auth/login`, nhóm
 * PV ẩn danh). Dùng để UI hiển thị đúng thông điệp chờ và để query layer KHÔNG
 * retry trong cửa sổ khoá — mỗi lần gọi lại đều bị đếm và đẩy Retry-After xa thêm.
 */
export function isRateLimitedError(error: unknown): boolean {
  if (isAxiosError(error)) {
    const err = error as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;
    return err._isRateLimited === true || Number(response?.status) === 429;
  }

  if (error instanceof ApiEnvelopeError) {
    return getErrorCode(error.data) === "RATE_LIMIT_EXCEEDED";
  }

  return false;
}

/** Số giây phải chờ trước khi thử lại (header `Retry-After`), nếu BE có gửi. */
export function getRetryAfterSeconds(error: unknown): number | undefined {
  if (!isAxiosError(error)) return undefined;

  const err = error as Record<string, unknown>;
  if (typeof err._retryAfterSeconds === "number") return err._retryAfterSeconds;

  const response = err.response as Record<string, unknown> | undefined;
  const headers = response?.headers as Record<string, unknown> | undefined;
  const retryAfter = Number(headers?.["retry-after"]);

  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
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

const DEFAULT_MESSAGE =
  "Hệ thống đang gặp sự cố, vui lòng thử lại sau ít phút. Nếu vẫn lỗi, liên hệ quản trị viên.";

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
    // Lỗi nhập liệu: `errors` nói chính xác trường nào sai và sai thế nào, còn
    // `message` chỉ là câu tổng ("Dữ liệu gửi lên không hợp lệ."). Ưu tiên chi
    // tiết trước — trước đây `message` được trả về vô điều kiện nên phần
    // `errors` không bao giờ tới được người dùng, mọi lỗi nhập liệu trên toàn
    // hệ thống đều hiện đúng một câu chung chung.
    const fieldErrors = formatFieldErrors(getFieldErrors(data));
    if (fieldErrors) {
      // Message nghiệp vụ cụ thể (vd "Không đủ tồn để xuất") vẫn phải giữ:
      // nó mang thông tin mà chi tiết theo trường không có.
      return isGenericValidationMessage(data.message) || !data.message
        ? fieldErrors
        : `${data.message} ${fieldErrors}`;
    }

    // BE (ApiError::abort / ApiConventionMiddleware) luôn gửi kèm cả `message`
    // (câu tiếng Việt thân thiện) và `error_code` (mã SCREAMING_SNAKE_CASE
    // dùng để so sánh bằng code, không phải để hiển thị). Phải ưu tiên message
    // trước, nếu không người dùng sẽ luôn thấy mã lỗi thô thay vì câu giải
    // thích — vì error_code hầu như luôn có mặt trên mọi response lỗi.
    if (data.message) return data.message;

    // Không fallback về `error_code` (vd "VALIDATION_ERROR") — đó là mã kỹ
    // thuật để so sánh bằng code, không phải câu dành cho người dùng cuối.
    // Nếu BE lỡ không kèm `message`, rơi xuống các fallback thân thiện phía
    // dưới thay vì lộ mã thô ra UI.
  }

  // Lỗi axios không có envelope: dịch sang câu tiếng Việt có nguyên nhân +
  // cách xử lý. Nhánh này phải chạy TRƯỚC nhánh đọc `error.message` chung —
  // AxiosError luôn mang message kỹ thuật tiếng Anh ("Network Error",
  // "timeout of 30000ms exceeded", "Request failed with status code 500"...)
  // nên nếu để nhánh chung chạy trước thì các câu dưới đây thành mã chết.
  if (isAxiosError(error)) {
    const axiosErr = error as Record<string, unknown>;
    if (axiosErr.code === "ECONNABORTED" || axiosErr.code === "ETIMEDOUT") {
      return "Yêu cầu quá thời gian, vui lòng thử lại.";
    }
    if (axiosErr.code === "ERR_NETWORK") {
      return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
    }

    const response = axiosErr.response as Record<string, unknown> | undefined;
    if (response?.status) {
      const status = Number(response.status);
      if (status === 429) {
        const retryAfter = Number(axiosErr._retryAfterSeconds);
        return Number.isFinite(retryAfter) && retryAfter > 0
          ? `Thao tác tạm bị khóa do thực hiện quá nhiều lần. Vui lòng đợi ${String(Math.ceil(retryAfter))} giây rồi thử lại.`
          : "Thao tác tạm bị khóa do thực hiện quá nhiều lần. Vui lòng đợi một lát rồi thử lại.";
      }
      if (status >= 500) return fallback;
      if (status === 404) {
        return "Không tìm thấy dữ liệu yêu cầu — có thể đã bị xóa hoặc thay đổi. Hãy tải lại trang.";
      }
      return "Yêu cầu chưa thực hiện được. Kiểm tra lại thông tin rồi thử lại; nếu vẫn lỗi, liên hệ quản trị viên.";
    }
    // AxiosError nhưng không có mã lỗi/response cụ thể: message của axios là
    // câu kỹ thuật tiếng Anh, không đưa ra UI.
    return fallback;
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

/**
 * Chia lỗi từ server thành hai phần cho các form dựng tay bằng MUI + `useState`
 * (phần lớn màn nghiệp vụ của dự án, không đi qua react-hook-form nên không
 * dùng được `applyServerErrors`):
 *
 *  - `fieldErrors`: những lỗi gắn được vào một ô nhập cụ thể trên form, để hiện
 *    ngay dưới ô đó (`error` + `helperText`);
 *  - `message`: phần còn lại — lỗi của field form không có ô tương ứng, hoặc
 *    lỗi nghiệp vụ chung — để hiện ở banner. `null` khi mọi lỗi đã gắn hết vào
 *    field, lúc đó banner phải ẩn đi thay vì lặp lại thông tin.
 *
 * Không truyền `formFields` thì mọi lỗi field đều trả về trong `fieldErrors`.
 *
 * @example
 * ```tsx
 * catch (error) {
 *   const { fieldErrors, message } = resolveFormErrors(error, ["email", "username"]);
 *   setFieldErrors((current) => ({ ...current, ...fieldErrors }));
 *   setFormError(message ?? "");
 * }
 * ```
 */
export function resolveFormErrors(
  error: unknown,
  formFields?: readonly string[],
): { fieldErrors: Record<string, string>; message: string | null } {
  const extracted = extractFieldErrorsRaw(error);
  if (!extracted) {
    return { fieldErrors: {}, message: getMutationErrorMessage(error) };
  }

  const supported = formFields ? new Set(formFields) : null;
  const fieldErrors: Record<string, string> = {};
  const leftovers: string[] = [];

  for (const [serverField, message] of Object.entries(extracted)) {
    if (!message) continue;

    // Các form trong dự án đặt tên state không thống nhất: màn IAM dùng
    // camelCase (`displayName`), màn PV/master-data dùng thẳng tên field của BE
    // (`industry_id`). Thử cả hai biến thể rồi lấy cái form thật sự có ô hiển
    // thị — nếu chỉ thử một kiểu thì nửa số màn sẽ nuốt mất lỗi trong im lặng.
    const camelField = FIELD_MAP[serverField] ?? snakeToCamel(serverField);
    const matched = !supported
      ? camelField
      : supported.has(serverField)
        ? serverField
        : supported.has(camelField)
          ? camelField
          : null;

    if (matched) {
      fieldErrors[matched] = message;
    } else {
      leftovers.push(message);
    }
  }

  if (Object.keys(fieldErrors).length === 0) {
    return { fieldErrors: {}, message: getMutationErrorMessage(error) };
  }

  return {
    fieldErrors,
    message: leftovers.length > 0 ? leftovers.join(" ") : null,
  };
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
