import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import type { LoginRequest } from "@/modules/auth/types/auth.types";

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),

    onSuccess: (data) => {
      // BE m1 trả JWT dùng được ngay sau login. Warehouse context chỉ được đổi
      // khi người dùng chủ động gọi /auth/switch-context từ ContextSwitcher.
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
