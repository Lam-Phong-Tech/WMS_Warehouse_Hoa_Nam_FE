import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import type { LoginRequest } from "@/modules/auth/types/auth.types";
import { tStatic } from "@/shared/i18n/useT";

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
      toast.success(tStatic("auth.login.success"));

      // BE m1 trả JWT dùng được ngay sau login. Warehouse context chỉ được đổi
      // khi người dùng chủ động gọi /auth/switch-context từ ContextSwitcher.
      setAuth({
        token: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
        contexts: data.available_contexts,
      });

      const from = (location.state as LoginLocationState | null)?.from;
      // Nhánh interceptor (phiên hết hạn giữa chừng) truyền attempted URL qua
      // ?redirect= vì window.location.assign không mang được router state.
      // Chỉ nhận path nội bộ để tránh open-redirect; không quay lại /login.
      const redirectParam = new URLSearchParams(location.search).get(
        "redirect",
      );
      const safeRedirect =
        redirectParam &&
        redirectParam.startsWith("/") &&
        !redirectParam.startsWith("//") &&
        redirectParam !== ROUTES.LOGIN
          ? redirectParam
          : null;
      const nextPath = from?.pathname
        ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
        : (safeRedirect ?? ROUTES.DASHBOARD);
      navigate(nextPath, { replace: true });
    },
    // Cố ý là no-op: LoginPage đã hiển thị nguyên nhân cụ thể (sai mật khẩu /
    // tài khoản bị khóa / mất mạng...) bằng UiAlert ngay trong form qua
    // getLoginErrorMessage. Toast chung chung ở đây chỉ gây thông báo trùng
    // đôi; vẫn phải khai onError để MutationCache fallback không toast thêm.
    onError: () => {},
  });
}
