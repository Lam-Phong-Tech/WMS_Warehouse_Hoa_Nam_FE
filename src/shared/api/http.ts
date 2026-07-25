import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { api } from '@/shared/api/axios';
import {
  isErrorEnvelope,
  ApiEnvelopeError,
  type ApiMeta,
  type ApiResponse,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from '@/shared/types/api-response';

/**
 * Check if error is an AxiosError without relying on axios.isAxiosError mock.
 * This avoids test mocking issues with vi.mock('axios').
 */
function isAxiosError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as Record<string, unknown>).isAxiosError === true
  );
}

/** `body` là object thường (không phải null/array/primitive). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Cảnh báo dev khi response không đúng envelope chuẩn — giúp phát hiện sớm
 * thay vì để lỗi runtime khó debug (vd BE đổi shape mà FE không hay).
 */
function warnUnexpectedShape(url: string, body: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(
      `[http] Response không đúng envelope ApiResponse<T> tại "${url}". Nhận:`,
      body,
    );
  }
}

/**
 * Lớp bọc mỏng quanh axios theo **contract chính thức**:
 *
 * - Thành công: `{ success: true, message?, data: T, meta? }`
 * - Lỗi:       `{ success: false, message, error_code?, errors? }`
 *
 * Mọi method **tự bóc `res.data.data`**, nên service chỉ làm việc với `T`.
 * Nếu body báo lỗi (kể cả khi HTTP 2xx) → ném Error với `message` để
 * `getApiErrorMessage()` (api-error.ts) hiển thị nhất quán.
 *
 * Hardening cho các trường hợp BE không trả đúng envelope (không phải P0 vì
 * BE hiện luôn giữ envelope, nhưng tránh lỗi runtime/`undefined` khó debug
 * nếu một endpoint nào đó lệch chuẩn):
 * - `204 No Content` hoặc body rỗng (`""`/`null`/`undefined`) → trả `undefined as T`,
 *   không cố đọc `.data` trên object không tồn tại.
 * - Body là raw array/primitive (không phải object envelope) → trả thẳng body
 *   như `T`, kèm cảnh báo dev để phát hiện sớm endpoint lệch chuẩn.
 * - Body là object nhưng không có field `data` và không phải error envelope
 *   → trả thẳng body (fallback), kèm cảnh báo dev.
 *
 * @example
 *   const users = await http.get<User[]>(API_ENDPOINTS.USERS);
 */
function unwrap<T>(res: AxiosResponse<ApiResponse<T>>, url: string): T {
  const body = res.data;

  // 204 No Content hoặc body rỗng — không có gì để bóc.
  if (
    res.status === 204 ||
    body === undefined ||
    body === null ||
    (body as unknown) === ''
  ) {
    return undefined as T;
  }

  // Body không phải object envelope (raw array/primitive) — trả thẳng.
  if (!isPlainObject(body)) {
    warnUnexpectedShape(url, body);
    return body as unknown as T;
  }

  if (isErrorEnvelope(body)) {
    throw new ApiEnvelopeError(body as ApiErrorResponse);
  }

  // Object hợp lệ nhưng thiếu field `data` — fallback trả thẳng object.
  if (!('data' in body)) {
    warnUnexpectedShape(url, body);
    return body as unknown as T;
  }

  return (body as ApiSuccessResponse<T>).data;
}

/**
 * `downloadBlob` dùng `responseType: 'blob'`, nên khi BE trả lỗi (4xx/5xx)
 * dưới dạng JSON, axios lại đặt nó vào `error.response.data` dạng `Blob`
 * thay vì object — khiến `getApiErrorMessage()` không đọc được `message` thật
 * và luôn rơi vào fallback chung chung. Hàm này đọc nội dung Blob đó (nếu là
 * JSON) rồi gán lại vào `error.response.data` để lỗi hiển thị đúng như API thường.
 */
async function parseBlobError(error: unknown): Promise<unknown> {
  if (!isAxiosError(error)) return error;
  const axiosErr = error as Record<string, unknown>;
  const response = axiosErr.response as Record<string, unknown> | undefined;
  const data = response?.data;
  if (data instanceof Blob && !data.type?.startsWith('application/json')) {
    try {
      const text = await data.text();
      (axiosErr.response as Record<string, unknown>).data = JSON.parse(text);
    } catch {
      // Không phải JSON hợp lệ — giữ nguyên lỗi gốc.
    }
  }
  return error;
}

export const http = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await api.get<ApiResponse<T>>(url, config), url);
  },

  /**
   * Giống `get` nhưng giữ lại `meta` phân trang thay vì bỏ đi.
   * Dùng cho các endpoint danh sách có `{ data: T[], meta: { total, current_page, ... } }`.
   */
  async getPage<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<{ data: T; meta: ApiMeta }> {
    const res = await api.get<ApiResponse<T>>(url, config);
    const body = res.data;

    if (!isPlainObject(body)) {
      warnUnexpectedShape(url, body);
      return { data: body as unknown as T, meta: {} };
    }

    if (isErrorEnvelope(body)) {
      throw new ApiEnvelopeError(body as ApiErrorResponse);
    }

    if (!('data' in body)) {
      warnUnexpectedShape(url, body);
      return { data: body as unknown as T, meta: {} };
    }

    return { data: body.data, meta: body.meta ?? {} };
  },

  async post<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return unwrap(await api.post<ApiResponse<T>>(url, body, config), url);
  },

  async put<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return unwrap(await api.put<ApiResponse<T>>(url, body, config), url);
  },

  async patch<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return unwrap(await api.patch<ApiResponse<T>>(url, body, config), url);
  },

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await api.delete<ApiResponse<T>>(url, config), url);
  },

  async downloadBlob(url: string, config?: AxiosRequestConfig): Promise<Blob> {
    try {
      const res = await api.get<Blob>(url, {
        ...config,
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await parseBlobError(error);
    }
  },
};
