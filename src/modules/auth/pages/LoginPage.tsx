import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Form, Spin, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { useLogin } from "@/modules/auth/hooks/use-login";
import {
  loginSchema,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import { FormInput } from "@/shared/components/forms";

export function LoginPage() {
  const login = useLogin();
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  const errorMessage = login.isError
    ? isAxiosError(login.error)
      ? (login.error.response?.data?.message ?? "Đăng nhập thất bại")
      : "Đăng nhập thất bại"
    : null;

  const isSubmitting = login.isPending || login.isSuccess;

  return (
    <main className="hn-login-page">
      {isSubmitting && (
        <div className="hn-login-loading" role="status" aria-live="polite">
          <div className="hn-login-loading-card">
            <Spin size="large" />
            <Typography.Text
              strong
              style={{ display: "block", marginTop: 12 }}
            >
              {login.isPending
                ? "Đang xác thực tài khoản..."
                : "Đang tải quyền truy cập..."}
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

      <section className="hn-login-wrap" aria-labelledby="login-title">
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
                <h1 id="login-title" className="hn-login-title">
                  Đăng nhập hệ thống
                </h1>
                <div className="hn-login-subtitle">
                  Sử dụng tài khoản Hoa Nam để truy cập nghiệp vụ kho.
                </div>
              </div>
            </div>
          </header>

          <div className="hn-login-form">
            {errorMessage && (
              <Alert
                type="error"
                message="Không thể đăng nhập"
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
                name="email"
                label="Email"
                placeholder="name@hoanam.vn"
                prefix={<MailOutlined style={{ color: "#8c887e" }} />}
                type="email"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
              />

              <FormInput
                control={control}
                name="password"
                label="Mật khẩu"
                placeholder="Nhập mật khẩu"
                prefix={<LockOutlined style={{ color: "#8c887e" }} />}
                password
                autoComplete="current-password"
                disabled={isSubmitting}
              />

              <Button
                className="hn-login-submit"
                type="primary"
                htmlType="submit"
                block
                loading={login.isPending}
                disabled={isSubmitting}
              >
                Đăng nhập
              </Button>
            </Form>

            <div className="hn-login-note">
              Phiên đăng nhập sử dụng JWT. Hệ thống tự xoay vòng refresh token
              và cập nhật quyền/phạm vi kho từ tài khoản hiện hành.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
