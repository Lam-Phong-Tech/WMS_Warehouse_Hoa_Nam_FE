import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { getMutationErrorMessage } from "@/shared/api/api-error";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import type { ChangePasswordRequest } from "@/modules/auth/types/auth.types";

/**
 * POST /auth/change-password revokes every refresh token on BE m1. Keeping the
 * current FE session after a successful change would leave a JWT that cannot be
 * refreshed later, so the client deliberately clears all local auth state and
 * requires a clean login with the new password.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logoutLocal = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      authService.changePassword(data),
    onSuccess: () => {
      toast.success("Đổi mật khẩu thành công, vui lòng đăng nhập lại");
      queryClient.clear();
      logoutLocal();
      useAuthStore.persist.clearStorage();
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (error) => {
      // Phải đưa nguyên nhân thật ra UI ("Mật khẩu hiện tại không đúng"...) —
      // toast chung chung khiến người dùng không biết sửa gì.
      toast.error(getMutationErrorMessage(error));
    },
  });
}
