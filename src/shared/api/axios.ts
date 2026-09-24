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
import { installRequestActivityTracker } from "@/shared/api/request-activity";

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

// Đăng ký trước interceptor auth: response lỗi được chốt bộ đếm trước khi tầng
// auth refresh/retry; request retry sau đó được tính thành một lượt mới độc lập.
installRequestActivityTracker(api);

function responseStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

/** Payload của POST /auth/refresh mà FE được phép giữ — không có refresh token. */
export interface RefreshSessionPayload {
  access_token: string;
  token_type: string;
  expires_in: number;
  user?: unknown;
}

const REFRESH_LOCK_NAME = "wms-auth-refresh";

/**
 * Hai tab cùng hết hạn access token sẽ cùng gọi /auth/refresh với CÙNG một cookie.
 * BE xoay vòng token ở lần đầu và coi lần thứ hai là replay → thu hồi TOÀN BỘ phiên
 * → mọi tab văng ra màn đăng nhập. Web Locks xếp hàng các lần refresh giữa mọi tab
 * cùng origin: tab sau chờ tab trước xoay vòng xong mới gửi, lúc đó cookie đã là
 * token mới. Trình duyệt không có Web Locks vẫn còn single-flight trong từng tab.
 */
function withCrossTabRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks || typeof locks.request !== "function") return task();

  return new Promise<T>((resolve, reject) => {
    locks
      .request(REFRESH_LOCK_NAME, { mode: "exclusive" }, () =>
        task().then(resolve, reject),
      )
      .catch(reject);
  });
}

let refreshPromise: Promise<RefreshSessionPayload> | null = null;

/**
 * P1 bảo mật 10/09/2026 — làm mới phiên CHỈ bằng cookie HttpOnly.
 *
 * Body rỗng: refresh token nằm trong cookie `wms_refresh_token` mà JavaScript không
 * đọc được, và BE từ chối (422) nếu body mang `refresh_token`. Trước đây FE giữ
 * refresh token trong bộ nhớ JS và gửi lại ở đây — một lỗi XSS là đủ để lấy
 * credential 14 ngày mang đi. Single-flight dùng chung cho interceptor lẫn
 * bootstrap (`authService.refresh`).
 */
export function refreshSession(): Promise<RefreshSessionPayload> {
  if (!refreshPromise) {
    refreshPromise = withCrossTabRefreshLock(() =>
      api.post<{ success: boolean; data?: Partial<RefreshSessionPayload> }>(
        API_ENDPOINTS.REFRESH,
        {},
        { withCredentials: true },
      ),
    )
      .then((res) => {
        const data = res.data?.data;
        const token = data?.access_token;
        if (typeof token !== "string" || token.trim() === "") {
          throw new Error(
            "AUTH_REFRESH_CONTRACT_INVALID: missing access_token",
          );
        }
        // Dựng object tường minh: BE cũ còn kèm refresh_token cũng không lọt vào state.
        return {
          access_token: token,
          token_type: data?.token_type ?? "bearer",
          expires_in: Number(data?.expires_in),
          user: data?.user,
        };
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

let accessTokenRefresh: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!accessTokenRefresh) {
    accessTokenRefresh = refreshSession()
      .then(({ access_token }) => {
        memoryStorage.setItem(access_token);
        // setToken revokes stale permission/profile before retrying the request.
        useAuthStore.getState().setToken(access_token);
        return access_token;
      })
      .finally(() => {
        accessTokenRefresh = null;
      });
  }
  return accessTokenRefresh;
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
