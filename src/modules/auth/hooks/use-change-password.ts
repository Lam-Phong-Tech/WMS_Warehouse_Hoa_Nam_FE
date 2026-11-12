import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import type { ChangePasswordRequest } from "@/modules/auth/types/auth.types";
import { tStatic } from "@/shared/i18n/useT";

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
      toast.success(tStatic("auth.changePassword.success"));
      queryClient.clear();
      logoutLocal();
      useAuthStore.persist.clearStorage();
      navigate(ROUTES.LOGIN, { replace: true });
    },
    // Không toast lỗi ở đây: màn đổi mật khẩu tự hiển thị lỗi field dưới đúng ô
    // nhập (và banner chỉ cho lỗi không gắn được vào ô), toast sẽ lặp thông tin.
  });
}
