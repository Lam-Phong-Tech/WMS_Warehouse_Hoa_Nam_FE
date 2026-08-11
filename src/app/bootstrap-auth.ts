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
  return status === 401 || status === 403 || status === 422;
}

async function clearSessionHint(): Promise<void> {
  useAuthStore.getState().logout();
  await Promise.resolve(useAuthStore.persist.clearStorage());
}

async function runBootstrap(): Promise<void> {
  useAuthStore.setState({ isBootstrapped: false, bootstrapError: null });
  await Promise.resolve(useAuthStore.persist.rehydrate());

  // Always attempt one refresh. After F5 the access/refresh tokens held in JS
  // memory are intentionally gone, while the server-issued HttpOnly refresh cookie
  // can still represent a valid session. JavaScript cannot inspect that cookie, so
  // "no memory token" must never be used as proof that the user is logged out.
  try {
    const refreshed = await authService.refresh();
    useAuthStore.getState().setToken(refreshed.access_token);
  } catch (error) {
    if (isInvalidSession(error)) {
      await clearSessionHint();
    } else {
      // Network/5xx/contract lỗi không được giả mạo thành "chưa đăng nhập".
      // Giữ persisted user/context hint để UI có thể retry thay vì destructive logout.
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
