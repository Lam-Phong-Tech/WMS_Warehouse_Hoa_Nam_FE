import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { memoryStorage } from "@/shared/lib/memory-storage";

let activeBootstrap: Promise<void> | null = null;

function responseStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

function isInvalidSession(error: unknown): boolean {
  const status = responseStatus(error);
  return status === 401 || status === 403 || status === 422;
}

async function clearSessionHint(): Promise<void> {
  useAuthStore.getState().logout();
  await Promise.resolve(useAuthStore.persist.clearStorage());
}

async function runBootstrap(): Promise<void> {
  useAuthStore.setState({ isBootstrapped: false, bootstrapError: null });
  await Promise.resolve(useAuthStore.persist.rehydrate());

  // BE m1 yêu cầu refresh_token trong request body. Token hiện được giữ
  // memory-only, nên sau F5/đóng tab không còn token để restore phiên. Đây là
  // trạng thái unauthenticated bình thường, không phải lỗi hạ tầng/contract.
  if (!memoryStorage.getRefreshToken()) {
    await clearSessionHint();
    useAuthStore.setState({ isBootstrapped: true });
    return;
  }

  try {
    const refreshed = await authService.refresh();
    useAuthStore.getState().setToken(refreshed.access_token);
  } catch (error) {
    if (isInvalidSession(error)) {
      await clearSessionHint();
    } else {
      // Network/5xx/contract lỗi không được giả mạo thành "chưa đăng nhập".
      useAuthStore.setState({ bootstrapError: error });
    }
  } finally {
    useAuthStore.setState({ isBootstrapped: true });
  }
}

/** Single-flight để StrictMode/retry không tạo nhiều refresh song song. */
export function bootstrapAuth(): Promise<void> {
  if (!activeBootstrap) {
    activeBootstrap = runBootstrap().finally(() => {
      activeBootstrap = null;
    });
  }
  return activeBootstrap;
}
