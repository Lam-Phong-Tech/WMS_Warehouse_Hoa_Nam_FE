import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { ROUTES } from "@/shared/constants/routes";
import type {
  LoginRequest,
  SwitchContextRequest,
} from "@/modules/auth/types/auth.types";

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const loginResult = await authService.login(credentials);
      let finalToken = loginResult.access_token;

      // Với nhiều context, không mở protected shell bằng JWT chưa có active
      // context. Chỉ commit auth state sau khi switch-context thành công.
      if (loginResult.available_contexts.length >= 2) {
        const firstContext = loginResult.available_contexts[0];
        const switchRequest: SwitchContextRequest = {
          role_id: firstContext.role_id,
          org_unit_id: firstContext.org_unit_id,
          department_id: firstContext.department_id,
          warehouse_id: firstContext.warehouse_id,
        };

        memoryStorage.setItem(loginResult.access_token);
        try {
          const switched = await authService.switchContext(switchRequest);
          finalToken = switched.access_token;
        } catch (error) {
          try {
            await authService.logout();
          } catch {
            // Best effort revoke; local session is always cleared below.
          }
          useAuthStore.getState().logout();
          throw error;
        }
      }

      return { ...loginResult, access_token: finalToken };
    },

    onSuccess: (data) => {
      setAuth({
        token: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
        contexts: data.available_contexts,
      });

      const from = (location.state as LoginLocationState | null)?.from;
      const nextPath = from?.pathname
        ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
        : ROUTES.DASHBOARD;
      navigate(nextPath, { replace: true });
    },
  });
}
