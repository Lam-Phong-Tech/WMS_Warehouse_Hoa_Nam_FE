import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authService } from "@/modules/auth/services/auth.service";
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
      queryClient.clear();
      logoutLocal();
      useAuthStore.persist.clearStorage();
      navigate(ROUTES.LOGIN, { replace: true });
    },
  });
}
