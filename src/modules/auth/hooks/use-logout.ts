import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const logoutAction = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      logoutAction();
      queryClient.clear(); // Xoá cache để không lẫn dữ liệu/quyền của user cũ
      navigate(ROUTES.LOGIN, { replace: true });
    },
  });
};
