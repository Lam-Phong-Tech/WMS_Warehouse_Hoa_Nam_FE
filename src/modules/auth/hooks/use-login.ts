import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { useAfterLogin } from "@/modules/auth/hooks/use-after-login";
import type {
  AuthenticatedLogin,
  LoginRequest,
} from "@/modules/auth/types/auth.types";
import { tStatic } from "@/shared/i18n/useT";
import { waitForAuthBootstrap } from "@/shared/lib/auth-bootstrap-gate";

export type AuthenticatedLoginHandler = (
  data: AuthenticatedLogin,
  continueLogin: () => void,
) => void;

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
      // A first-factor or challenge response must NEVER establish an authenticated session.
      if (data.kind !== "authenticated") return;
      const continueLogin = () => {
        if (!data.replaced_existing_session)
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
    mutationFn: async ({
      mfaToken,
      code,
    }: {
      mfaToken: string;
      code: string;
    }) => {
      await waitForAuthBootstrap();
      return authService.verifyMfa(mfaToken, code);
    },
    onSuccess: (data) => {
      const continueLogin = () => {
        if (!data.replaced_existing_session)
          toast.success(tStatic("auth.login.success"));
        afterLogin(data);
      };
      if (onAuthenticated) onAuthenticated(data, continueLogin);
      else continueLogin();
    },
    onError: () => {},
  });
}

export function useStepUpVerify() {
  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async ({
      stepUpToken,
      code,
    }: {
      stepUpToken: string;
      code: string;
    }) => {
      await waitForAuthBootstrap();
      return authService.verifyStepUp(stepUpToken, code);
    },
    onError: () => {},
  });
}

export function useStepUpResend() {
  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async (stepUpToken: string) => {
      await waitForAuthBootstrap();
      return authService.resendStepUp(stepUpToken);
    },
    onError: () => {},
  });
}

export function useDeviceVerify(onAuthenticated?: AuthenticatedLoginHandler) {
  const afterLogin = useAfterLogin();
  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async ({
      deviceToken,
      code,
    }: {
      deviceToken: string;
      code: string;
    }) => {
      await waitForAuthBootstrap();
      return authService.verifyDevice(deviceToken, code);
    },
    onSuccess: (data) => {
      const continueLogin = () => {
        toast.success(tStatic("auth.login.deviceTrustedToast"));
        afterLogin(data);
      };
      if (onAuthenticated) onAuthenticated(data, continueLogin);
      else continueLogin();
    },
    onError: () => {},
  });
}

export function useDeviceResend() {
  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async (deviceToken: string) => {
      await waitForAuthBootstrap();
      return authService.resendDevice(deviceToken);
    },
    onError: () => {},
  });
}
