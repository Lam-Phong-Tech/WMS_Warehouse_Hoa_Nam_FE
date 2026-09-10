import {
  authService,
  meResponseFromRefreshUser,
} from "@/modules/auth/services/auth.service";
import { queryClient } from "@/app/providers/query-client";
import { mark } from "@/shared/perf/marks";
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

/**
 * Đường dẫn KHÔNG cần đăng nhập. Vào thẳng một trong số này mà chưa từng đăng
 * nhập trên máy thì không có gì để làm mới — xem `shouldAttemptRefresh`.
 */
const PUBLIC_PATH_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/pv"];

/**
 * Có nên thử `POST /auth/refresh` lúc khởi động không?
 *
 * TRƯỚC: luôn thử. Hệ quả đo được: mở trang /login trên máy sạch luôn tốn một
 * request CHẮC CHẮN HỎNG — BE trả 422 vì không có refresh token ở body lẫn
 * cookie HttpOnly nào để làm mới (P1: refresh token chỉ đi qua cookie). Request đó nằm
 * trên đường tới nội dung đầu tiên của trang đăng nhập, và mỗi lần F5 của khách
 * vãng lai đều tạo một dòng lỗi trong log BE.
 *
 * SAU: chỉ thử khi CÓ LÝ DO tin rằng phiên tồn tại —
 *   (a) còn dấu vết phiên đã đăng nhập (cookie `erp-auth` giữ `user`), hoặc
 *   (b) đang vào một đường dẫn CẦN đăng nhập (kể cả khi không còn dấu vết:
 *       cookie refresh là HttpOnly nên JavaScript không đọc được, phải thử mới
 *       biết — giữ nguyên hành vi fail-closed của ProtectedRoute).
 *
 * Nói cách khác: chỉ BỎ QUA đúng một trường hợp — trang công khai + không dấu
 * vết phiên. Mọi trường hợp khác vẫn thử y như trước.
 */
function shouldAttemptRefresh(): boolean {
  if (useAuthStore.getState().user !== null) return true;
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  return !PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/"),
  );
}

async function runBootstrap(): Promise<void> {
  useAuthStore.setState({ isBootstrapped: false, bootstrapError: null });
  await Promise.resolve(useAuthStore.persist.rehydrate());

  if (!shouldAttemptRefresh()) {
    // Không có phiên để khôi phục: đánh dấu đã khởi động xong và dừng. KHÔNG gọi
    // logout()/clearStorage() ở đây — không có gì để dọn, và gọi thừa sẽ xoá mất
    // dấu vết của một tab khác đang đăng nhập.
    useAuthStore.setState({ isBootstrapped: true });
    return;
  }

  // Always attempt one refresh. After F5 the access token held in JS memory is
  // intentionally gone (the refresh token never lives in JS at all), while the
  // server-issued HttpOnly refresh cookie can still represent a valid session.
  // JavaScript cannot inspect that cookie, so "no memory token" must never be used
  // as proof that the user is logged out.
  try {
    mark("refresh:start");
    const refreshed = await authService.refresh();
    mark("refresh:done");
    useAuthStore.getState().setToken(refreshed.access_token);

    // `/auth/refresh` trả kèm hồ sơ đầy đủ của đúng JWT vừa cấp. Dùng luôn ở đây
    // để bỏ một vòng mạng NỐI TIẾP (`/auth/me`) khỏi đường tới hạn của mọi lần
    // F5 — đo thật trên máy này là ~170-380ms mỗi lần tải trang, và dưới tải
    // thật (VPS, 3000 người) chi phí một vòng mạng còn lớn hơn.
    //
    // Gieo vào React Query bằng ĐÚNG queryKey mà useMe() dùng, nên useMe() thấy
    // dữ liệu còn tươi (staleTime 5 phút) và không bắn thêm request. Thiếu bước
    // gieo này thì vòng mạng thứ hai vẫn còn, chỉ khác là không chặn UI nữa.
    const profile = meResponseFromRefreshUser(refreshed.user);
    if (profile) {
      queryClient.setQueryData(["auth", "me", refreshed.access_token], profile);
      useAuthStore.getState().setProfile(profile);
    }
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
