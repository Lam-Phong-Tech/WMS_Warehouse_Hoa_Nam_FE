import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cookieStorage } from "@/shared/lib/cookie-storage";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { queryClient } from "@/app/providers/query-client";
import { useNotificationStore } from "@/shared/store/notification.store";
import { clearPersistedQueryCache } from "@/shared/cache/query-persister";
import { disconnectEcho } from "@/shared/lib/echo";
import type { User } from "@/shared/types/user";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { MeContext, MeResponse } from "@/modules/auth/types/me.types";

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
  bootstrapError: unknown | null;

  profile: AuthProfile | null;
  permissionCodes: string[];
  isSuperAdmin: boolean;
  isProfileLoaded: boolean;

  setAuth: (data: {
    token: string;
    refreshToken?: string;
    user: User;
    contexts?: AuthContext[];
  }) => void;
  setToken: (token: string) => void;
  setCurrentContext: (context: AuthContext | null) => void;
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
        set({
          token,
          user,
          contexts,
          currentContext: contexts[0] ?? null,
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
          profile: null,
          permissionCodes: [],
          isSuperAdmin: false,
          isProfileLoaded: false,
        });
      },

      setCurrentContext: (context) => set({ currentContext: context }),

      setProfile: (me) => {
        const { active_context, available_contexts, ...profile } = me;
        const isSuperAdmin =
          me.is_super_admin ??
          me.roles.some((role) => role.role_code === "SUPER_ADMIN");
        const currentContext =
          active_context ??
          get().currentContext ??
          available_contexts[0] ??
          null;

        set({
          profile,
          currentContext,
          // BE m1 trả permission ở top-level /auth/me, không theo active_context.
          permissionCodes: me.permissions,
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
        // queryClient.clear() chỉ dọn RAM. Máy trong kho là máy DÙNG CHUNG giữa
        // các ca, nên phải xoá luôn bản sao trên IndexedDB — nếu không, ca sau
        // đăng nhập tài khoản khác vẫn còn danh mục/kho của ca trước nằm trên đĩa.
        void clearPersistedQueryCache();
        disconnectEcho();
        useNotificationStore.getState().reset();
      },
    }),
    {
      name: "erp-auth",
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({
        user: state.user,
        contexts: state.contexts,
      }),
      skipHydration: true,
    },
  ),
);

export type { MeContext };
