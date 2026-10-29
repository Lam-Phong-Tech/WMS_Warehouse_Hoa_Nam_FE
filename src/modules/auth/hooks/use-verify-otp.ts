import { useMutation } from "@tanstack/react-query";
import { authService } from "@/modules/auth/services/auth.service";
import type { VerifyOtpRequest } from "@/modules/auth/types/auth.types";

export function useVerifyOtp() {
  return useMutation({
    retry: false,
    gcTime: 0,
    networkMode: "always",
    onError: () => {},
    mutationFn: (data: VerifyOtpRequest) => authService.verifyOtp(data),
  });
}
