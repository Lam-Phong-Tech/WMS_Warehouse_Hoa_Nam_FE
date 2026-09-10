import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import { useAfterLogin } from "@/modules/auth/hooks/use-after-login";
import type { LoginRequest } from "@/modules/auth/types/auth.types";
import { tStatic } from "@/shared/i18n/useT";
import { waitForAuthBootstrap } from "@/shared/lib/auth-bootstrap-gate";

export function useLogin() {
  const afterLogin = useAfterLogin();

  return useMutation({
    // Không gửi mật khẩu khi bootstrap còn đang làm mới phiên cũ: hai thao tác cùng
    // đổi phiên mà chạy song song thì refresh trả về SAU sẽ xoá/ghi đè phiên vừa
    // đăng nhập (xem auth-bootstrap-gate). Máy sạch không phải chờ gì. Trong lúc
    // chờ, mutation đã ở trạng thái pending nên nút đăng nhập hiện loading.
    mutationFn: async (credentials: LoginRequest) => {
      await waitForAuthBootstrap();
      return authService.login(credentials);
    },

    onSuccess: (data) => {
      // WWHN-SEC-08: mật khẩu đúng KHÔNG còn đồng nghĩa với "đã đăng nhập".
      //
      // Nhánh mfa_required cố ý không làm gì ở đây — không setAuth, không toast,
      // không điều hướng. LoginPage đọc `login.data` và chuyển sang bước nhập mã.
      // Bất kỳ thao tác "tạm lưu phiên" nào ở nhánh này đều xoá sạch ý nghĩa của
      // lớp thứ hai.
      if (data.kind === "mfa_required") {
        return;
      }

      toast.success(tStatic("auth.login.success"));

      // BE m1 trả JWT dùng được ngay sau login. Warehouse context chỉ được đổi
      // khi người dùng chủ động gọi /auth/switch-context từ ContextSwitcher.
      afterLogin(data);
    },
    // Cố ý là no-op: LoginPage đã hiển thị nguyên nhân cụ thể (sai mật khẩu /
    // tài khoản bị khóa / mất mạng...) bằng UiAlert ngay trong form qua
    // getLoginErrorMessage. Toast chung chung ở đây chỉ gây thông báo trùng
    // đôi; vẫn phải khai onError để MutationCache fallback không toast thêm.
    onError: () => {},
  });
}

/**
 * Bước 2 của đăng nhập. Tách hook riêng thay vì nhét thêm nhánh vào `useLogin`:
 * hai bước có input, lỗi và trạng thái loading khác nhau, gộp lại thì màn hình
 * không phân biệt được "sai mật khẩu" với "sai mã xác thực".
 */
export function useMfaVerify() {
  const afterLogin = useAfterLogin();

  return useMutation({
    mutationFn: async ({
      mfaToken,
      code,
    }: {
      mfaToken: string;
      code: string;
    }) => {
      await waitForAuthBootstrap();
      return authService.verifyMfa(mfaToken, code);
    },
    onSuccess: (data) => {
      toast.success(tStatic("auth.login.success"));
      afterLogin(data);
    },
    onError: () => {},
  });
}
