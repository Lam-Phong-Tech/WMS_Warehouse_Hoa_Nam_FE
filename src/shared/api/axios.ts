import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/shared/store/auth.store";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { ROUTES } from "@/shared/constants/routes";
import {
  getErrorCode,
  type ApiErrorResponse,
} from "@/shared/types/api-response";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { runtimeConfig } from "@/shared/config/env";
import {
  isOfflineMutationBlocked,
  OFFLINE_MUTATION_CODE,
  OFFLINE_MUTATION_MESSAGE,
} from "@/shared/pwa/offline-policy";

declare module "axios" {
  interface AxiosError {
    _isNoPermission?: boolean;
    _isValidationError?: boolean;
    _isConflictError?: boolean;
    /**
     * WWHN-289: BE nay có rate limit thật (khoá brute-force /auth/login và nhóm
     * PV ẩn danh — SRS §8.1 bảng Security + Annex C error set 400,404,429,500).
     * 429 phải được nhận diện riêng để UI/query lùi theo Retry-After thay vì
     * retry ngay và tự kéo dài cửa sổ khoá.
     */
    _isRateLimited?: boolean;
    _retryAfterSeconds?: number;
  }
  interface InternalAxiosRequestConfig {
    _isRetryAfterRefresh?: boolean;
  }
}

export const api = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
  timeout: runtimeConfig.apiTimeoutMs,
  withCredentials: runtimeConfig.apiWithCredentials,
});

function responseStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

function callRefresh() {
  const refreshToken = memoryStorage.getRefreshToken();
  return api.post<{
    success: boolean;
    data: {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
    };
  }>(
    API_ENDPOINTS.REFRESH,
    refreshToken ? { refresh_token: refreshToken } : undefined,
  );
}

let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = callRefresh()
      .then((res) => {
        const token = res.data?.data?.access_token;
        if (typeof token !== "string" || token.trim() === "") {
          throw new Error(
            "AUTH_REFRESH_CONTRACT_INVALID: missing access_token",
          );
        }
        const refreshToken = res.data.data.refresh_token;
        memoryStorage.setItem(token);
        if (refreshToken) memoryStorage.setRefreshToken(refreshToken);
        // setToken revokes stale permission/profile before retrying the request.
        useAuthStore.getState().setToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function redirectToLogin() {
  useAuthStore.getState().logout();
  useAuthStore.persist.clearStorage();
  if (window.location.pathname !== ROUTES.LOGIN) {
    // WWHN-165/QA2-LOGIN-001: phiên hết hạn giữa chừng vẫn phải giữ attempted
    // URL để đăng nhập lại quay về đúng màn đang làm việc. Chỉ nhận path nội
    // bộ (bắt đầu bằng "/" đơn) — không nhận URL tuyệt đối/"//" để tránh
    // open-redirect.
    const attempted = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const redirectQuery =
      attempted.startsWith("/") && !attempted.startsWith("//")
        ? `?redirect=${encodeURIComponent(attempted)}`
        : "";
    window.location.assign(`${ROUTES.LOGIN}${redirectQuery}`);
  }
}

api.interceptors.request.use((config) => {
  // WWHN-325 fail-safe: never queue or optimistically execute mutations while
  // the browser is offline. This covers stock-changing and other private API
  // writes without relying on individual screens to remember an offline guard.
  if (isOfflineMutationBlocked(config.method)) {
    return Promise.reject(
      new AxiosError(OFFLINE_MUTATION_MESSAGE, OFFLINE_MUTATION_CODE, config),
    );
  }

  const token = memoryStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const url = config.url || "";
  const idempotencyMatch = url.match(
    /^\/employees\/(\d+)\/(account|account\/reissue-temporary-credential)$/,
  );
  if (idempotencyMatch) {
    const employeeId = idempotencyMatch[1];
    const isReissue =
      idempotencyMatch[2] === "account/reissue-temporary-credential";
    config.headers["Idempotency-Key"] = isReissue
      ? `reissue:${employeeId}:${Date.now()}`
      : `employee:${employeeId}:initial-account:v1`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data as ApiErrorResponse | undefined;
    const config = error.config as InternalAxiosRequestConfig | undefined;

    if (status === 401) {
      const isAuthEndpoint =
        config?.url === API_ENDPOINTS.REFRESH ||
        config?.url === API_ENDPOINTS.LOGIN;

      // Caller owns login/refresh failure semantics. In particular bootstrap
      // must distinguish expired session from network/5xx and stay fail-closed.
      if (isAuthEndpoint) return Promise.reject(error);

      if (config && !config._isRetryAfterRefresh) {
        try {
          const token = await refreshAccessToken();
          config._isRetryAfterRefresh = true;
          config.headers.Authorization = `Bearer ${token}`;
          return api.request(config);
        } catch (refreshError) {
          const refreshStatus = responseStatus(refreshError);
          if (refreshStatus === 401 || refreshStatus === 403) redirectToLogin();
          // Network/5xx must not silently destroy an otherwise recoverable
          // session; surface the actual refresh error to the UI/query layer.
          return Promise.reject(refreshError);
        }
      }

      redirectToLogin();
      return Promise.reject(error);
    }

    if (status === 403) {
      if (
        getErrorCode(data) === "PASSWORD_CHANGE_REQUIRED" &&
        window.location.pathname !== ROUTES.CHANGE_PASSWORD
      ) {
        window.location.assign(ROUTES.CHANGE_PASSWORD);
        return Promise.reject(error);
      }
      error._isNoPermission = true;
      return Promise.reject(error);
    }

    if (status === 422) {
      error._isValidationError = true;
      return Promise.reject(error);
    }

    if (status === 409) {
      error._isConflictError = true;
      return Promise.reject(error);
    }

    // WWHN-289: 429 RATE_LIMIT_EXCEEDED. Không tự retry ở tầng axios — mỗi lần
    // gọi lại trong cửa sổ khoá đều bị tính và đẩy Retry-After xa thêm.
    if (status === 429) {
      error._isRateLimited = true;
      const retryAfter = Number(error.response?.headers?.["retry-after"]);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        error._retryAfterSeconds = retryAfter;
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
