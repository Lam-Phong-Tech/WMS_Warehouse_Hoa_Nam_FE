import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { runtimeConfig } from "@/shared/config/env";
import type { ApiMeta, ApiResponse } from "@/shared/types/api-response";

/**
 * WWHN-252 — client HTTP cho nhóm endpoint App PV ẩn danh.
 *
 * Vì sao KHÔNG dùng lại `api` (shared/api/axios.ts):
 * 1. SRS §3 + Annex C (`security: []`) định nghĩa người xem App PV là actor ẩn
 *    danh. `api` luôn gắn `Authorization: Bearer …` khi có token trong memory —
 *    tức là một nhân viên đang đăng nhập sẽ gửi kèm token của mình tới một
 *    endpoint public có thể nằm sau CDN/cache. Đó là rò rỉ credential không cần
 *    thiết, không phải tính năng.
 * 2. Interceptor 401 của `api` sẽ refresh token rồi `window.location.assign('/login')`.
 *    Trang PV công khai không được phép đá khách vãng lai sang màn đăng nhập vì
 *    một lỗi phía sau; nó phải hiện trạng thái lỗi tại chỗ.
 *
 * Client này chỉ nhận biết 429 (Annex C khai 429 cho cả 4 operation PV) để tầng
 * query lùi theo Retry-After thay vì gọi lại ngay và tự kéo dài cửa sổ khoá.
 */
export const publicApi = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
  timeout: runtimeConfig.apiTimeoutMs,
  // Không gửi cookie: request PV phải hoàn toàn ẩn danh.
  withCredentials: false,
});

export interface PublicApiError extends Error {
  status?: number;
  code?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  isRateLimited?: boolean;
  isOffline?: boolean;
  isNotFound?: boolean;
}

function toPublicApiError(error: unknown): PublicApiError {
  const axiosError = error as AxiosError<{
    message?: string;
    error?: { code?: string };
    error_code?: string;
    meta?: { request_id?: string };
  }>;
  const status = axiosError?.response?.status;
  const body = axiosError?.response?.data;

  const publicError: PublicApiError = new Error(
    body?.message ||
      (status === undefined
        ? "Không kết nối được máy chủ. Kiểm tra đường truyền rồi thử lại."
        : "Không tải được dữ liệu App PV."),
  );
  publicError.status = status;
  publicError.code = body?.error?.code ?? body?.error_code;
  publicError.requestId = body?.meta?.request_id;
  publicError.isNotFound = status === 404;
  publicError.isRateLimited = status === 429;
  // Không có response nghĩa là request chưa bao giờ tới BE: mất mạng, DNS, CORS.
  publicError.isOffline = status === undefined;

  if (status === 429) {
    const retryAfter = Number(axiosError.response?.headers?.["retry-after"]);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      publicError.retryAfterSeconds = retryAfter;
    }
  }

  return publicError;
}

export interface PublicPage<T> {
  data: T;
  meta: ApiMeta & {
    data_as_of?: string;
    max_staleness_seconds?: number;
    inventory_freshness?: string;
    /** Mốc client nhận response, đóng dấu ngay tại tầng transport. */
    received_at?: number;
  };
}

export const publicHttp = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<PublicPage<T>> {
    try {
      const res = await publicApi.get<ApiResponse<T>>(url, config);
      const body = res.data as { data?: T; meta?: ApiMeta } | undefined;
      return {
        data: (body?.data ?? (undefined as unknown)) as T,
        meta: {
          ...((body?.meta ?? {}) as PublicPage<T>["meta"]),
          // NFR-SRS-016: tuổi dữ liệu phải đo bằng (lúc NHẬN − data_as_of).
          // Đóng dấu tại đây thay vì trong component vì component không được gọi
          // Date.now() lúc render, và mốc này chính xác hơn: nó là thời điểm
          // response thực sự tới, kể cả khi bị một tầng cache giữ lại.
          received_at: Date.now(),
        },
      };
    } catch (error) {
      throw toPublicApiError(error);
    }
  },
};
