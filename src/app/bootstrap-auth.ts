import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";

let activeBootstrap: Promise<void> | null = null;

function responseStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

function isInvalidSession(error: unknown): boolean {
  const status = responseStatus(error);
  return status === 401 || status === 403;
}

async function runBootstrap(): Promise<void> {
  useAuthStore.setState({ isBootstrapped: false, bootstrapError: null });
  await Promise.resolve(useAuthStore.persist.rehydrate());

  try {
    const refreshed = await authService.refresh();
    useAuthStore.getState().setToken(refreshed.access_token);
  } catch (error) {
    if (isInvalidSession(error)) {
      // Hết/không có phiên là trạng thái bình thường: xóa mọi session hint cũ.
      useAuthStore.getState().logout();
      await Promise.resolve(useAuthStore.persist.clearStorage());
    } else {
      // Network/5xx/contract lỗi không được giả mạo thành "chưa đăng nhập".
      // ProtectedRoute hiển thị fail-closed state và cho phép retry.
      useAuthStore.setState({ bootstrapError: error });
    }
  } finally {
    useAuthStore.setState({ isBootstrapped: true });
  }
}

/**
 * Phục hồi phiên theo cơ chế single-flight để StrictMode/retry không tạo nhiều
 * request refresh đồng thời hoặc làm state ghi đè lẫn nhau.
 */
export function bootstrapAuth(): Promise<void> {
  if (!activeBootstrap) {
    activeBootstrap = runBootstrap().finally(() => {
      activeBootstrap = null;
    });
  }
  return activeBootstrap;
}
