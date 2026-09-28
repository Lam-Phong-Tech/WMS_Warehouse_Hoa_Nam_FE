import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { useAfterLogin } from "@/modules/auth/hooks/use-after-login";
import type { AuthenticatedLogin, LoginRequest } from "@/modules/auth/types/auth.types";
import { tStatic } from "@/shared/i18n/useT";
import { waitForAuthBootstrap } from "@/shared/lib/auth-bootstrap-gate";

export type AuthenticatedLoginHandler = (data: AuthenticatedLogin, continueLogin: () => void) => void;

export function useLogin(onAuthenticated?: AuthenticatedLoginHandler) {
  const afterLogin = useAfterLogin();
  return useMutation({
    // AUTH UAT 03/05/08: no automatic replay of a session-creating POST and no
    // queued offline login. Keep the existing bootstrap single-flight gate.
    retry: false,
    networkMode: "always",
    mutationFn: async (credentials: LoginRequest) => {
      await waitForAuthBootstrap();
      return authService.login(credentials);
    },
    onSuccess: (data) => {
      // A first-factor success must NEVER establish an authenticated session.
      if (data.kind === "mfa_required") return;
      const continueLogin = () => {
        toast.success(tStatic("auth.login.success"));
        afterLogin(data);
      };
      if (onAuthenticated) onAuthenticated(data, continueLogin);
      else continueLogin();
    },
    // The form owns the safe, localised error banner. Avoid a duplicate toast.
    onError: () => {},
  });
}

export function useMfaVerify(onAuthenticated?: AuthenticatedLoginHandler) {
  const afterLogin = useAfterLogin();
  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async ({ mfaToken, code }: { mfaToken: string; code: string }) => {
      await waitForAuthBootstrap();
      return authService.verifyMfa(mfaToken, code);
    },
    onSuccess: (data) => {
      const continueLogin = () => {
        toast.success(tStatic("auth.login.success"));
        afterLogin(data);
      };
      if (onAuthenticated) onAuthenticated(data, continueLogin);
      else continueLogin();
    },
    onError: () => {},
  });
}
