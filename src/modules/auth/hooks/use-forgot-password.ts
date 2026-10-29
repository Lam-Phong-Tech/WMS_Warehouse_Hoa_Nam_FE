import { useMutation } from "@tanstack/react-query";
import { authService } from "@/modules/auth/services/auth.service";
import type { ForgotPasswordRequest } from "@/modules/auth/types/auth.types";

/** Dùng cho cả bước gửi lần đầu lẫn "Gửi lại mã" — BE không có endpoint resend riêng. */
export function useForgotPassword() {
  return useMutation({
    retry: false,
    gcTime: 0,
    networkMode: "always",
    onError: () => {}, // The recovery page owns inline error presentation.
    mutationFn: (data: ForgotPasswordRequest) =>
      authService.forgotPassword(data),
  });
}
