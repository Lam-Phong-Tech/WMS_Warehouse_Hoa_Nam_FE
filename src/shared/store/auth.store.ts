import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cookieStorage } from "@/shared/lib/cookie-storage";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { queryClient } from "@/app/providers/query-client";

/**
 * Token là memory-only thật sự (không nằm trong `partialize` bên dưới) —
 * BE đã có `POST /auth/refresh` (HttpOnly cookie `refresh_token`, xác nhận
 * qua curl thật trên astrodev.test8.io.vn 2026-07-15). F5/đóng tab mất token
 * trong memory, nhưng `main.tsx` gọi `authService.refresh()` lúc bootstrap
 * để lấy access token mới từ refresh cookie mà không cần login lại.
 * memoryStorage vẫn là nguồn thật mà axios interceptor đọc token từ đó (xem
 * src/shared/api/axios.ts) — `token` trong store chỉ để UI reactive.
 *
 * Ref: docs/TOKEN_STORAGE_HARDENING.md, docs/tickets/BE_REFRESH_ENDPOINT_TICKET.md
 */
import type { User } from "@/shared/types/user";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { MeContext, MeResponse } from "@/modules/auth/types/me.types";

/** Hồ sơ tài khoản (không gồm active_context/available_contexts — 2 field đó
 * có state riêng vì chi phối permission/data-scope). */
export type AuthProfile = Omit<
  MeResponse,
  "active_context" | "available_contexts"
>;

interface AuthState {
  token: string | null;
  user: User | null;
  /** Danh sách context khả dụng để hiển thị trong ContextSwitcher — seed từ
   * login (available_contexts, chưa có permission_codes), rồi được thay bằng
   * bản đầy đủ hơn (có permission_codes) sau lần GET /auth/me đầu tiên. */
  contexts: AuthContext[];
  /** Context THẬT SỰ đang active trong JWT hiện tại (đồng bộ từ
   * GET /auth/me → active_context, sau khi POST /auth/switch-context thành
   * công + refetch /auth/me). null nếu super-admin hoặc chưa switch-context
   * lần nào dù có ≥2 context khả dụng. */
  currentContext: AuthContext | null;
  isAuthenticated: boolean;
  /**
   * true sau khi `useAuthStore.persist.rehydrate()` (gọi ở main.tsx) hoàn tất
   * — kể cả khi rehydrate lỗi. Route guard (`ProtectedRoute`) chờ cờ này
   * trước khi đọc `isAuthenticated`, để tránh "flash redirect" về /login nếu
   * storage rehydrate trở thành bất đồng bộ thật sự (vd đổi cookieStorage
   * sang cơ chế khác chậm hơn) — hiện tại rehydrate về cơ bản là đồng bộ nên
   * chưa quan sát được flash, nhưng cờ này làm rõ trạng thái bootstrap thay vì
   * ngầm định "storage luôn nhanh".
   */
  isBootstrapped: boolean;

  // Hồ sơ + phân quyền (từ GET /auth/me, không persist — F5 nạp lại)
  profile: AuthProfile | null;
  /** permission_codes CỦA RIÊNG active_context hiện tại — không phải union
   * toàn tài khoản. Đổi context (switch-context) → đổi permissionCodes. */
  permissionCodes: string[];
  isSuperAdmin: boolean;
  isProfileLoaded: boolean;

  setAuth: (data: {
    token: string;
    refreshToken?: string;
    user: User;
    contexts?: AuthContext[];
  }) => void;
  /** Cập nhật token sau khi POST /auth/switch-context cấp JWT mới. Không tự
   * refetch /auth/me — gọi kèm invalidateQueries(['auth','me']) ở nơi dùng
   * (xem useSwitchContext) để permission/currentContext đồng bộ theo. */
  setToken: (token: string) => void;
  setProfile: (me: MeResponse) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      contexts: [],
      currentContext: null,
      isAuthenticated: false,
      isBootstrapped: false,

      profile: null,
      permissionCodes: [],
      isSuperAdmin: false,
      isProfileLoaded: false,

      setAuth: ({ token, refreshToken, user, contexts = [] }) => {
        // Đồng bộ token vào memoryStorage để axios.ts đọc — token KHÔNG nằm
        // trong `partialize` bên dưới nên không persist vào cookie; memory-only
        // thật sự (xem docs/TOKEN_STORAGE_HARDENING.md).
        memoryStorage.setItem(token);
        if (refreshToken) {
          memoryStorage.setRefreshToken(refreshToken);
        }
        set({
          token,
          user,
          contexts,
          currentContext: contexts[0] ?? null,
          isAuthenticated: true,
        });
      },
      setToken: (token) => {
        // Dùng cho switch-context VÀ refresh lúc bootstrap (main.tsx) — cả 2
        // đều là bằng chứng phiên hợp lệ nên set luôn isAuthenticated.
        memoryStorage.setItem(token);
        set({ token, isAuthenticated: true });
      },
      setProfile: (me) => {
        const { active_context, available_contexts, ...profile } = me;
        // Ưu tiên field `is_super_admin` thật từ BE runtime (xác minh curl
        // 2026-07-12, xem đính chính trong me.types.ts). Fallback về heuristic
        // cũ (active_context null + available_contexts rỗng) chỉ khi BE không
        // trả field này — heuristic cũ SAI với tài khoản Super Admin có gán
        // thêm active_context qua user_role_scopes.
        const isSuperAdmin =
          me.is_super_admin ??
          (active_context === null && available_contexts.length === 0);
        set({
          profile,
          currentContext: active_context,
          permissionCodes: active_context?.permission_codes ?? [],
          isSuperAdmin,
          // Giữ danh sách context cũ (từ login) nếu /auth/me không trả gì —
          // không nên xảy ra theo contract nhưng tránh dropdown trống oan.
          contexts:
            available_contexts.length > 0 ? available_contexts : get().contexts,
          isProfileLoaded: true,
        });
      },
      logout: () => {
        // Xóa token khỏi memory storage
        memoryStorage.clear();
        set({
          token: null,
          user: null,
          contexts: [],
          currentContext: null,
          isAuthenticated: false,
          profile: null,
          permissionCodes: [],
          isSuperAdmin: false,
          isProfileLoaded: false,
        });
        // Xoá sạch cache React Query — tránh user kế tiếp đăng nhập trên cùng
        // tab thấy thoáng qua dữ liệu (scope-sensitive) của tài khoản trước.
        queryClient.clear();
      },
    }),
    {
      name: "erp-auth",
      storage: createJSONStorage(() => cookieStorage),
      // Chỉ lưu phiên tối thiểu (non-sensitive) vào cookie; hồ sơ/quyền nạp
      // lại qua /auth/me. `token` KHÔNG nằm trong danh sách này — memory-only
      // thật sự, phục hồi lúc bootstrap qua authService.refresh() (main.tsx),
      // không qua cookie persist nữa (BE đã có /auth/refresh).
      partialize: (state) => ({
        user: state.user,
        contexts: state.contexts,
        currentContext: state.currentContext,
      }),
      // Rehydrate luôn là bất đồng bộ (kể cả cookieStorage đồng bộ) — nếu để
      // tự động, nó có thể resolve TRỄ và merge/replace đè lên state đã set
      // thủ công (vd. permissionCodes trong test) tại một thời điểm không
      // xác định, gây race condition (thấy rõ trong test OrgUnitsPage: state
      // set qua setState() bị xoá về rỗng sau vài chục ms). Bootstrap gọi
      // rehydrate() 1 lần, đồng bộ hoá thời điểm — xem main.tsx.
      skipHydration: true,
    },
  ),
);

export type { MeContext };
