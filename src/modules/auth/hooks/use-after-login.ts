import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
import { clearWorkSession } from "@/shared/lib/session-idle";
import type { AuthenticatedLogin } from "@/modules/auth/types/auth.types";

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

/** Shared completion for password and MFA. AUTH UAT requires explicit Start work;
 * the existing ProtectedRoute still verifies /me and permissions before the gate. */
export function useAfterLogin(): (data: AuthenticatedLogin) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useCallback(
    (data: AuthenticatedLogin) => {
      // Clear the previous confirmation BEFORE publishing the new identity. Only
      // the Start work action creates an activity timestamp; never an auth token.
      clearWorkSession();
      setAuth({
        token: data.access_token,
        user: data.user,
        contexts: data.available_contexts,
      });
      const from = (location.state as LoginLocationState | null)?.from;
      const redirectParam = new URLSearchParams(location.search).get("redirect");
      const safeRedirect =
        redirectParam && redirectParam.startsWith("/") &&
        !redirectParam.startsWith("//") && redirectParam !== ROUTES.LOGIN
          ? redirectParam : null;
      const nextPath = from?.pathname
        ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
        : (safeRedirect ?? DASHBOARD_CANONICAL);
      navigate(nextPath, { replace: true });
    },
    [location.search, location.state, navigate, setAuth],
  );
}
