import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import type { ResetPasswordRequest } from "@/modules/auth/types/auth.types";

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => authService.resetPassword(data),
    onSuccess: () => {
      toast.success("Đặt lại mật khẩu thành công, vui lòng đăng nhập lại");
      navigate(ROUTES.LOGIN, { replace: true });
    },
  });
}
