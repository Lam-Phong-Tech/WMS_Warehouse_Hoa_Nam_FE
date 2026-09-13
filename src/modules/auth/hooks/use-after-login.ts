import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import { startWorkSession } from "@/shared/lib/session-idle";
import type { AuthenticatedLogin } from "@/modules/auth/types/auth.types";

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

/**
 * WWHN-SEC-08 — phần "sau khi đã có token" của luồng đăng nhập, tách ra dùng
 * chung cho CẢ HAI đường vào: đăng nhập một bước, và bước 2 của MFA.
 *
 * VÌ SAO PHẢI TÁCH: nếu chép logic điều hướng sang hook MFA thì hai bản sẽ trôi
 * khỏi nhau, và triệu chứng là "đăng nhập thường thì quay lại đúng trang đang
 * dở, đăng nhập có MFA thì luôn về Dashboard" — một khác biệt vô lý với người
 * dùng và rất khó truy ra nguyên nhân.
 */
export function useAfterLogin(): (data: AuthenticatedLogin) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useCallback(
    (data: AuthenticatedLogin) => {
      // P1 bảo mật 10/09/2026: chỉ access token vào bộ nhớ JS; refresh token nằm
      // trong cookie HttpOnly do BE đặt và FE không bao giờ chạm tới.
      setAuth({
        token: data.access_token,
        user: data.user,
        contexts: data.available_contexts,
      });
      startWorkSession();

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
    [location.search, location.state, navigate, setAuth],
  );
}
