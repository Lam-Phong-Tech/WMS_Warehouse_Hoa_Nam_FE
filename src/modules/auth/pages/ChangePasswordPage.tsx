import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Form, Spin, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { Navigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useChangePassword } from "@/modules/auth/hooks/use-change-password";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/modules/auth/schemas/change-password.schema";
import { FormInput } from "@/shared/components/forms";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";

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
    <main className="hn-login-page">
      {changePassword.isPending && (
        <div className="hn-login-loading" role="status" aria-live="polite">
          <div className="hn-login-loading-card">
            <Spin size="large" />
            <Typography.Text strong style={{ display: "block", marginTop: 12 }}>
              Đang cập nhật mật khẩu...
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ display: "block", marginTop: 4, fontSize: 12 }}
            >
              Hoa Nam WMS
            </Typography.Text>
          </div>
        </div>
      )}

      <section
        className="hn-login-wrap"
        aria-labelledby="change-password-title"
      >
        <div className="hn-login-kicker">
          Hoa Nam Tools <span>WMS · Quản lý kho</span>
        </div>

        <div className="hn-login-frame">
          <header className="hn-login-head">
            <div className="hn-login-brand">
              <div className="hn-login-mark" aria-hidden="true">
                HN
              </div>
              <div>
                <h1 id="change-password-title" className="hn-login-title">
                  Đổi mật khẩu
                </h1>
                <div className="hn-login-subtitle">
                  Thiết lập mật khẩu mới trước khi tiếp tục sử dụng hệ thống.
                </div>
              </div>
            </div>
          </header>

          <div className="hn-login-form">
            {errorMessage && !/mật khẩu hiện tại/i.test(errorMessage) && (
              <Alert
                type="error"
                title="Không thể đổi mật khẩu"
                description={errorMessage}
                style={{ marginBottom: 14 }}
                showIcon
              />
            )}

            <Form
              layout="vertical"
              onSubmitCapture={onSubmit}
              requiredMark={false}
              noValidate
            >
              <FormInput
                control={control}
                name="currentPassword"
                label="Mật khẩu hiện tại"
                placeholder="Nhập mật khẩu hiện tại"
                prefix={<LockOutlined style={{ color: "#8c887e" }} />}
                password
                autoFocus
                disabled={changePassword.isPending}
              />

              <FormInput
                control={control}
                name="newPassword"
                label="Mật khẩu mới"
                placeholder="Tối thiểu 8 ký tự"
                prefix={<LockOutlined style={{ color: "#8c887e" }} />}
                password
                disabled={changePassword.isPending}
              />

              <FormInput
                control={control}
                name="newPasswordConfirmation"
                label="Xác nhận mật khẩu mới"
                placeholder="Nhập lại mật khẩu mới"
                prefix={<LockOutlined style={{ color: "#8c887e" }} />}
                password
                disabled={changePassword.isPending}
              />

              <Button
                className="hn-login-submit"
                type="primary"
                htmlType="submit"
                block
                loading={changePassword.isPending}
                disabled={changePassword.isPending}
              >
                Đổi mật khẩu
              </Button>
            </Form>

            <div className="hn-login-note">
              Sau khi đổi mật khẩu thành công, toàn bộ refresh token bị thu hồi
              theo contract backend. Bạn sẽ được đưa về màn đăng nhập để tạo
              phiên JWT mới bằng mật khẩu vừa đặt.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
