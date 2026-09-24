import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { useSyncExternalStore } from "react";

/**
 * Bộ đếm request dùng cho cổng loading ở cấp trang.
 *
 * React Query bao phủ phần lớn dữ liệu, nhưng một số màn vận hành vẫn gọi
 * service trực tiếp trong effect (ví dụ phát hành mã vật lý). Theo dõi ở tầng
 * transport giúp cổng trang chờ đủ cả hai kiểu mà không buộc từng màn tự nối
 * thêm một cờ loading riêng.
 */
let activeRequestCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function beginRequest() {
  activeRequestCount += 1;
  emit();
}

function endRequest() {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  emit();
}

export function subscribeRequestActivity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveRequestCount() {
  return activeRequestCount;
}

export function useActiveRequestCount() {
  return useSyncExternalStore(
    subscribeRequestActivity,
    getActiveRequestCount,
    getActiveRequestCount,
  );
}

/**
 * Gắn bộ đếm vào một Axios instance đúng một lần tại nơi instance được tạo.
 * WeakSet đảm bảo một config chỉ được tính một lần trong mỗi lượt dispatch và
 * được xoá khi response kết thúc để request retry vẫn tạo một lượt mới.
 */
export function installRequestActivityTracker(client: AxiosInstance) {
  const tracked = new WeakSet<InternalAxiosRequestConfig>();

  const settle = (config?: InternalAxiosRequestConfig) => {
    if (!config || !tracked.delete(config)) return;
    endRequest();
  };

  const requestInterceptor = client.interceptors.request.use(
    (config) => {
      if (!tracked.has(config)) {
        tracked.add(config);
        beginRequest();
      }
      return config;
    },
    (error: AxiosError) => {
      settle(error.config);
      return Promise.reject(error);
    },
  );

  const responseInterceptor = client.interceptors.response.use(
    (response: AxiosResponse) => {
      settle(response.config);
      return response;
    },
    (error: AxiosError) => {
      settle(error.config);
      return Promise.reject(error);
    },
  );

  return () => {
    client.interceptors.request.eject(requestInterceptor);
    client.interceptors.response.eject(responseInterceptor);
  };
}
