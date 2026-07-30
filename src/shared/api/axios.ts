import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/shared/store/auth.store";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { ROUTES } from "@/shared/constants/routes";
import {
  getErrorCode,
  type ApiErrorResponse,
} from "@/shared/types/api-response";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { runtimeConfig } from "@/shared/config/env";

// Extend AxiosError type to include custom flags
declare module "axios" {
  interface AxiosError {
    _isNoPermission?: boolean;
    _isValidationError?: boolean;
    _isConflictError?: boolean;
  }
  interface InternalAxiosRequestConfig {
    _isRetryAfterRefresh?: boolean;
  }
}

export const api = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
  timeout: runtimeConfig.apiTimeoutMs,
  // Bắt buộc để trình duyệt gửi/nhận cookie HttpOnly `refresh_token` (BE set
  // ở path /auth, domain .test8.io.vn) khi FE ở subdomain khác cùng site —
  // xem docs/tickets/BE_REFRESH_ENDPOINT_TICKET.md.
  withCredentials: true,
});

/**
 * Gọi thẳng axios instance (không qua `http`) để tránh phụ thuộc vòng
 * (auth.service.ts import `api` gián tiếp qua `http`) — endpoint refresh
 * cũng không cần đi qua interceptor response bên dưới (tránh tự refresh
 * chính request refresh khi nó 401).
 */
function callRefresh() {
  return api.post<{
    success: boolean;
    data: { access_token: string; token_type: string; expires_in: number };
  }>(API_ENDPOINTS.REFRESH);
}

let refreshPromise: Promise<string> | null = null;

/** Gom mọi request 401 đồng thời vào 1 lần gọi /auth/refresh duy nhất. */
function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = callRefresh()
      .then((res) => {
        const token = res.data.data.access_token;
        memoryStorage.setItem(token);
        useAuthStore.setState({ token, isAuthenticated: true });
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
    window.location.assign(ROUTES.LOGIN);
  }
}

// Đính token vào mỗi request - đọc từ memoryStorage (không từ cookie)
api.interceptors.request.use((config) => {
  const token = memoryStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Idempotency-Key bắt buộc cho các endpoint cấp/cấp lại tài khoản nhân sự.
  // BE enforce header này (trả 400 IDEMPOTENCY_KEY_REQUIRED nếu thiếu).
  // Mỗi lần người dùng bấm nút thật sự (không phải retry mạng) phải sinh key MỚI
  // để không bị trả lại response cũ từ cache 24h.
  const url = config.url || "";
  const idempotencyMatch = url.match(
    /^\/employees\/(\d+)\/(account|account\/reissue-temporary-credential)$/,
  );
  if (idempotencyMatch) {
    const employeeId = idempotencyMatch[1];
    const isReissue =
      idempotencyMatch[2] === "account/reissue-temporary-credential";
    const timestamp = Date.now();

    if (isReissue) {
      // Reissue: BE dùng account_id, nhưng FE không có sẵn ở đây nên dùng
      // employee_id + timestamp. Đủ unique cho mỗi lần bấm nút thật.
      config.headers["Idempotency-Key"] = `reissue:${employeeId}:${timestamp}`;
    } else {
      // Tạo mới: theo gợi ý BA doc §11
      config.headers["Idempotency-Key"] =
        `employee:${employeeId}:initial-account:v1`;
    }
  }

  return config;
});

// 401 → thử refresh access token 1 lần (qua HttpOnly refresh_token cookie)
// rồi retry request gốc; refresh thất bại (hoặc request refresh chính nó
// 401) → đăng xuất + về /login.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data as ApiErrorResponse | undefined;
    const config = error.config as InternalAxiosRequestConfig | undefined;

    // 401: Token không hợp lệ hoặc hết hạn
    if (status === 401) {
      const skipAutoRefresh =
        config?.url === API_ENDPOINTS.REFRESH ||
        config?.url === API_ENDPOINTS.LOGIN;
      if (!skipAutoRefresh && config && !config._isRetryAfterRefresh) {
        try {
          const token = await refreshAccessToken();
          config._isRetryAfterRefresh = true;
          config.headers.Authorization = `Bearer ${token}`;
          return api.request(config);
        } catch {
          redirectToLogin();
          return Promise.reject(error);
        }
      }

      redirectToLogin();
      return Promise.reject(error);
    }

    // 403: Thiếu quyền truy cập
    if (status === 403) {
      // Bắt buộc đổi mật khẩu lần đầu (sau khi được cấp tài khoản/reset) — BE
      // chặn 403 mọi API trừ login/logout/change-password (xem
      // docs/employee-account-provisioning-flow.md mục 4). Giữ nguyên token,
      // chỉ điều hướng sang màn đổi mật khẩu.
      // Đọc cả error_code root-level lẫn error.code nested (BE publish song song
      // 2 contract lỗi tuỳ module — xem api-response.ts).
      if (
        getErrorCode(data) === "PASSWORD_CHANGE_REQUIRED" &&
        window.location.pathname !== ROUTES.CHANGE_PASSWORD
      ) {
        window.location.assign(ROUTES.CHANGE_PASSWORD);
        return Promise.reject(error);
      }

      // Đánh dấu lỗi là "no-permission" để UI hiển thị trạng thái phù hợp
      error._isNoPermission = true;
      return Promise.reject(error);
    }

    // 422: Validation error - đánh dấu để UI biết hiển thị lỗi field-level
    if (status === 422) {
      error._isValidationError = true;
      return Promise.reject(error);
    }

    // 409: Conflict - thường là duplicate key hoặc business rule conflict
    if (status === 409) {
      error._isConflictError = true;
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
