import { useAuthStore } from '@/shared/store/auth.store';
import { authService } from '@/modules/auth/services/auth.service';

/**
 * Tách riêng khỏi main.tsx để test được (main.tsx gọi side-effect ngay khi
 * import nên không mock/test trực tiếp được) — xem bootstrap-auth.test.ts.
 *
 * Token là memory-only (không còn trong cookie persist, xem auth.store.ts) —
 * sau F5, `state.token` luôn null ngay sau rehydrate. Để không bắt user login
 * lại mỗi lần F5, thử `POST /auth/refresh` (đọc HttpOnly cookie
 * `refresh_token` do BE set khi login) để lấy access token mới trước khi coi
 * là "chưa đăng nhập". Refresh thất bại (401 - không có/hết hạn refresh
 * cookie, hoặc lỗi mạng) → coi như chưa đăng nhập, không báo lỗi/redirect cho
 * user — ProtectedRoute chờ `isBootstrapped` trước khi tự quyết định redirect.
 */
export async function bootstrapAuth(): Promise<void> {
  await Promise.resolve(useAuthStore.persist.rehydrate());
  try {
    const { access_token } = await authService.refresh();
    useAuthStore.getState().setToken(access_token);
  } catch {
    // Không có refresh token hợp lệ (hoặc lỗi mạng) — user thực sự chưa
    // đăng nhập. Cố ý im lặng: đây là luồng bình thường mỗi lần F5 khi chưa
    // login, không phải lỗi cần báo cho user hay log ồn console.
  } finally {
    useAuthStore.setState({ isBootstrapped: true });
  }
}
