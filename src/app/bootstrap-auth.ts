import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Rehydrate persisted, non-sensitive session hints, then try to restore the
 * memory-only access token from the HttpOnly refresh cookie.
 */
export async function bootstrapAuth(): Promise<void> {
  await Promise.resolve(useAuthStore.persist.rehydrate());
  try {
    const refreshed = await authService.refresh();
    if (refreshed?.access_token) {
      useAuthStore.getState().setToken(refreshed.access_token);
    }
  } catch {
    // No valid refresh session or transient refresh failure. Route guards decide
    // whether to show login, loading, or the protected shell.
  } finally {
    useAuthStore.setState({ isBootstrapped: true });
  }
}
