import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import type { ChangePasswordRequest } from "@/modules/auth/types/auth.types";

/**
 * POST /auth/change-password — bắt buộc dùng khi password_change_required=true
 * (sau khi được cấp tài khoản/reset mật khẩu). Sau khi đổi thành công, BE tự
 * chuyển password_change_required về false — cần refetch /auth/me để mọi API
 * khác (đang bị chặn 403 PASSWORD_CHANGE_REQUIRED) hoạt động lại bình thường.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      authService.changePassword(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate(ROUTES.DASHBOARD, { replace: true });
    },
  });
}
