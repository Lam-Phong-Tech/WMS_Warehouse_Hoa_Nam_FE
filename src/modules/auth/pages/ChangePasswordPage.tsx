import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useChangePassword } from "@/modules/auth/hooks/use-change-password";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/modules/auth/schemas/change-password.schema";
import { Box, UiAlert, UiFormText } from "@/shared/ui";
import { AuthShell, AuthNote } from "@/modules/auth/components/AuthShell";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import { ActionButton } from "@/shared/components/actions";

export function ChangePasswordPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const changePassword = useChangePassword();
  const { control, handleSubmit, setError } = useForm<ChangePasswordFormValues>(
    {
      resolver: zodResolver(changePasswordSchema),
      defaultValues: {
        currentPassword: "",
        newPassword: "",
        newPasswordConfirmation: "",
      },
    },
  );

  const onSubmit = handleSubmit((values) =>
    changePassword.mutate({
      current_password: values.currentPassword,
      new_password: values.newPassword,
      new_password_confirmation: values.newPasswordConfirmation,
    }),
  );

  const errorMessage = changePassword.isError
    ? isAxiosError(changePassword.error)
      ? (changePassword.error.response?.data?.message ??
        "Đổi mật khẩu thất bại")
      : "Đổi mật khẩu thất bại"
    : null;

  useEffect(() => {
    if (!errorMessage) return;
    if (/mật khẩu hiện tại/i.test(errorMessage)) {
      setError("currentPassword", { type: "server", message: errorMessage });
    }
  }, [errorMessage, setError]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <AuthShell
      titleId="change-password-title"
      title="Đổi mật khẩu"
      subtitle="Thiết lập mật khẩu mới trước khi tiếp tục sử dụng hệ thống."
      loadingText={
        changePassword.isPending ? "Đang cập nhật mật khẩu..." : null
      }
    >
      {errorMessage && !/mật khẩu hiện tại/i.test(errorMessage) && (
        <Box sx={{ marginBottom: "14px" }}>
          <UiAlert tone="error" title="Không thể đổi mật khẩu">
            {errorMessage}
          </UiAlert>
        </Box>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
          <UiFormText
            control={control}
            name="currentPassword"
            label="Mật khẩu hiện tại"
            placeholder="Nhập mật khẩu hiện tại"
            startIcon="lock"
            type="password"
            autoFocus
            disabled={changePassword.isPending}
          />

          <UiFormText
            control={control}
            name="newPassword"
            label="Mật khẩu mới"
            placeholder="Tối thiểu 8 ký tự"
            startIcon="lock"
            type="password"
            disabled={changePassword.isPending}
          />

          <UiFormText
            control={control}
            name="newPasswordConfirmation"
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu mới"
            startIcon="lock"
            type="password"
            disabled={changePassword.isPending}
          />

          <ActionButton
            kind="password"
            loading={changePassword.isPending}
            disabled={changePassword.isPending}
            type="submit"
            fullWidth
          >
            Đổi mật khẩu
          </ActionButton>
        </Box>
      </form>

      <AuthNote>
        Sau khi đổi mật khẩu thành công, toàn bộ refresh token bị thu hồi theo
        contract backend. Bạn sẽ được đưa về màn đăng nhập để tạo phiên JWT mới
        bằng mật khẩu vừa đặt.
      </AuthNote>
    </AuthShell>
  );
}
