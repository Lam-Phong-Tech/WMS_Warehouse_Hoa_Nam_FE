import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cookieStorage } from "@/shared/lib/cookie-storage";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { queryClient } from "@/app/providers/query-client";
import type { User } from "@/shared/types/user";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { MeContext, MeResponse } from "@/modules/auth/types/me.types";

/** Hồ sơ tài khoản, tách active context vì context chi phối permission/data-scope. */
export type AuthProfile = Omit<
  MeResponse,
  "active_context" | "available_contexts"
>;

interface AuthState {
  token: string | null;
  user: User | null;
  contexts: AuthContext[];
  currentContext: AuthContext | null;
  isAuthenticated: boolean;
  isBootstrapped: boolean;
  /** Lỗi hạ tầng/contract khi phục hồi phiên. 401/403 hết phiên không nằm ở đây. */
  bootstrapError: unknown | null;

  profile: AuthProfile | null;
  /** Chỉ chứa permission của active_context trong JWT hiện tại. */
  permissionCodes: string[];
  isSuperAdmin: boolean;
  isProfileLoaded: boolean;

  setAuth: (data: {
    token: string;
    refreshToken?: string;
    user: User;
    contexts?: AuthContext[];
  }) => void;
  /**
   * Cập nhật JWT sau refresh/switch-context và lập tức thu hồi profile/quyền cũ.
   * ProtectedRoute sẽ fail-closed cho tới khi GET /auth/me của JWT mới thành công.
   */
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
      bootstrapError: null,

      profile: null,
      permissionCodes: [],
      isSuperAdmin: false,
      isProfileLoaded: false,

      setAuth: ({ token, refreshToken, user, contexts = [] }) => {
        memoryStorage.setItem(token);
        if (refreshToken) memoryStorage.setRefreshToken(refreshToken);

        // Không suy diễn context đầu tiên là active context. Chỉ /auth/me của
        // JWT hiện tại mới được phép xác nhận context, permission và data-scope.
        set({
          token,
          user,
          contexts,
          currentContext: null,
          isAuthenticated: true,
          bootstrapError: null,
          profile: null,
          permissionCodes: [],
          isSuperAdmin: false,
          isProfileLoaded: false,
        });
      },

      setToken: (token) => {
        memoryStorage.setItem(token);
        set({
          token,
          isAuthenticated: true,
          bootstrapError: null,
          currentContext: null,
          profile: null,
          permissionCodes: [],
          isSuperAdmin: false,
          isProfileLoaded: false,
        });
      },

      setProfile: (me) => {
        const { active_context, available_contexts, ...profile } = me;
        const isSuperAdmin =
          me.is_super_admin ??
          (active_context === null && available_contexts.length === 0);

        set({
          profile,
          currentContext: active_context,
          permissionCodes: active_context?.permission_codes ?? [],
          isSuperAdmin,
          contexts:
            available_contexts.length > 0 ? available_contexts : get().contexts,
          isProfileLoaded: true,
        });
      },

      logout: () => {
        memoryStorage.clear();
        set({
          token: null,
          user: null,
          contexts: [],
          currentContext: null,
          isAuthenticated: false,
          bootstrapError: null,
          profile: null,
          permissionCodes: [],
          isSuperAdmin: false,
          isProfileLoaded: false,
        });
        queryClient.clear();
      },
    }),
    {
      name: "erp-auth",
      storage: createJSONStorage(() => cookieStorage),
      // Chỉ giữ hint không nhạy cảm. Không persist token, permission, profile
      // hoặc currentContext vì tất cả có thể stale sau refresh/switch/logout.
      partialize: (state) => ({
        user: state.user,
        contexts: state.contexts,
      }),
      skipHydration: true,
    },
  ),
);

export type { MeContext };
