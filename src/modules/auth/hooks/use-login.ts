import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { useSwitchContext } from "./use-switch-context";
import { ROUTES } from "@/shared/constants/routes";
import type {
  LoginRequest,
  SwitchContextRequest,
} from "@/modules/auth/types/auth.types";

interface LoginLocationState {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
}

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const switchContext = useSwitchContext();

  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    onSuccess: async (data) => {
      setAuth({
        token: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
        contexts: data.available_contexts,
      });

      // Auto-switch context đầu tiên nếu user có ≥2 contexts
      // để tránh lỗi INVALID_ACTIVE_CONTEXT (403) khi truy cập API
      if (data.available_contexts.length >= 2) {
        const firstContext = data.available_contexts[0];
        const switchRequest: SwitchContextRequest = {
          role_id: firstContext.role_id,
          org_unit_id: firstContext.org_unit_id ?? undefined,
          department_id: firstContext.department_id ?? undefined,
          warehouse_id: firstContext.warehouse_id ?? undefined,
        };

        try {
          await switchContext.mutateAsync(switchRequest);
        } catch (error) {
          // Log error nhưng không chặn login flow
          // User có thể retry thủ công qua ContextSwitcher
          if (import.meta.env.DEV) {
            console.error(
              "[Auth] Failed to auto-switch context after login:",
              error,
            );
          }
        }
      }

      const from = (location.state as LoginLocationState | null)?.from;
      const nextPath = from?.pathname
        ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
        : ROUTES.DASHBOARD;

      navigate(nextPath, { replace: true });
    },
  });
}
