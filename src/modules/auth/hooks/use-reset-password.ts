import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import type { ResetPasswordRequest } from "@/modules/auth/types/auth.types";
import { tStatic } from "@/shared/i18n/useT";

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => authService.resetPassword(data),
    onSuccess: () => {
      toast.success(tStatic("auth.forgotPassword.resetSuccess"));
      navigate(ROUTES.LOGIN, { replace: true });
    },
  });
}
