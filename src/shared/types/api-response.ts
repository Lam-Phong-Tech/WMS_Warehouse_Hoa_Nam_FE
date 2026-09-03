import { tStatic } from "@/shared/i18n/useT";

/** Meta phân trang (kèm trong response danh sách). */
export interface ApiMeta {
  request_id?: string;
  timestamp?: string;
  current_page?: number;
  per_page?: number;
  last_page?: number;
  total?: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

/**
 * Envelope thành công.
 *
 * Nhiều endpoint đã test thật (xem `docs/api-evidence/*`) trả kèm cả
 * `success: true` lẫn `status: "success"`; một số chỉ trả `status` (không có
 * `success`) — model cả hai field là optional để không bị TS thu hẹp sai.
 *
 * ```json
 * { "success": true, "status": "success", "message": "string", "data": T, "meta": {} }
 * ```
 */
export interface ApiSuccessResponse<T> {
  success?: true;
  status?: "success";
  message?: string;
  data: T;
  meta?: ApiMeta;
}

/**
 * Envelope lỗi.
 *
 * BE dùng lẫn cả 2 kiểu báo lỗi tuỳ endpoint — có nơi `success: false`
 * (kèm hoặc không kèm `status: "error"`), có nơi CHỈ có `status: "error"`
 * mà không có `success` (đã thấy ở response lỗi thật của `/auth/login`,
 * `/auth/me`, `/user-role-scopes` — xem `docs/api-evidence/`). Nếu chỉ check
 * `success === false` thì các response chỉ có `status: "error"` sẽ lọt qua
 * và bị unwrap thành `data: undefined` thay vì throw lỗi rõ ràng — đặc biệt
 * nguy hiểm nếu BE từng trả lỗi kèm HTTP 2xx.
 *
 * Ngoài ra, đối chiếu với OpenAPI spec thật của dự án
 * (`GET /docs?api-docs.json`, schema `ApiError`/`ApiValidationError` vs
 * `ErrorResponse`/`ValidationErrorResponse`), BE đang publish CẢ HAI dạng lỗi
 * tuỳ module:
 * - Flat (root-level) — dùng ở `employee-assignments`...:
 *   `{ "status": "error", "error_code": "string", "message": "string", "errors": {} }`
 * - Nested (theo API_Convention.md, chiếm đa số endpoint mới: webhooks,
 *   sales-order, price-list, inventory...):
 *   `{ "success": false, "message": "string", "error": { "code": "string", "details": {} }, "meta": { "request_id": "string" } }`
 *
 * Type dưới đây model cả hai để FE đọc được bất kể module nào trả dạng nào.
 * Dùng các hàm `getErrorCode`/`getFieldErrors`/`getRequestId` bên dưới thay vì
 * đọc trực tiếp `error_code`/`errors` — chúng tự fallback sang field nested.
 */
export interface ApiErrorResponse {
  success?: false;
  status?: "error";
  message: string;
  error_code?: string;
  errors?: Record<string, string[] | string>;
  request_id?: string;
  /** Dạng nested theo API_Convention.md (`error.code` / `error.details`). */
  error?: {
    code?: string;
    details?: Record<string, string[] | string>;
  };
  /** Dạng nested theo API_Convention.md (`meta.request_id`). */
  meta?: {
    request_id?: string;
    [key: string]: unknown;
  };
}

/** Mã lỗi nghiệp vụ — đọc `error_code` (flat) trước, fallback `error.code` (nested). */
export function getErrorCode(
  body: ApiErrorResponse | undefined,
): string | undefined {
  return body?.error_code ?? body?.error?.code;
}

/** Lỗi validation theo field — đọc `errors` (flat) trước, fallback `error.details` (nested). */
export function getFieldErrors(
  body: ApiErrorResponse | undefined,
): Record<string, string[] | string> | undefined {
  return body?.errors ?? body?.error?.details;
}

/** request_id để tra log — đọc root-level trước, fallback `meta.request_id` (nested). */
export function getRequestId(
  body: ApiErrorResponse | undefined,
): string | undefined {
  return body?.request_id ?? body?.meta?.request_id;
}

/** Envelope hợp nhất (dùng ở interceptor / axios). */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Lỗi ném ra khi body báo lỗi (`isErrorEnvelope` true) nhưng HTTP status là 2xx
 * (BE trả lỗi nghiệp vụ kèm HTTP 200/201 — đã thấy thực tế ở một số endpoint).
 * `http.ts` ném lỗi này thay vì `Error` thường để giữ nguyên `error_code`/`errors`/
 * `error.details` — nếu không, `extractFieldErrors()`/`getApiErrorMessage()` (vốn chỉ
 * đọc được `AxiosError`) sẽ mất trắng field errors trong trường hợp này.
 */
export class ApiEnvelopeError extends Error {
  readonly data: ApiErrorResponse;

  constructor(data: ApiErrorResponse) {
    super(data.message ?? tStatic("shared.api.requestFailed"));
    this.name = "ApiEnvelopeError";
    this.data = data;
  }
}

/**
 * Kiểm tra body response có phải lỗi không.
 * Hỗ trợ cả 2 contract BE đang dùng lẫn lộn: `success: false` (đã test thật:
 * `/auth/login`, `/auth/me`...) và `status: "error"` (đã test thật:
 * `/user-role-scopes`, `/user-data-scopes`...). Chỉ cần MỘT trong hai field
 * báo lỗi là coi là lỗi — tránh lọt case BE trả `status: "error"` kèm HTTP 2xx.
 */
export function isErrorEnvelope(
  body: { success?: boolean; status?: string } | null | undefined,
): body is ApiErrorResponse {
  if (!body) return false;
  return body.success === false || body.status === "error";
}
