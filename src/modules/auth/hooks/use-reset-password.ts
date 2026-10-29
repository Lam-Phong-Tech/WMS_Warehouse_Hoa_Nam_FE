import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import type { ResetPasswordRequest } from "@/modules/auth/types/auth.types";
import { tStatic } from "@/shared/i18n/useT";
import { useAuthStore } from "@/shared/store/auth.store";
import { useQueryClient } from "@tanstack/react-query";

export function useResetPassword() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    gcTime: 0,
    networkMode: "always",
    onError: () => {},
    mutationFn: (data: ResetPasswordRequest) => authService.resetPassword(data),
    onSuccess: () => {
      useAuthStore.getState().logout();
      queryClient.clear();
      toast.success(tStatic("auth.forgotPassword.resetSuccess"));
      navigate(ROUTES.LOGIN, { replace: true });
    },
  });
}
