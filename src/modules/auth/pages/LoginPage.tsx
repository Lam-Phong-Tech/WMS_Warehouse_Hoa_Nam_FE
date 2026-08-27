import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Form, Spin, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@/shared/components/icons";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import { useLogin } from "@/modules/auth/hooks/use-login";
import {
  loginSchema,
  toLoginRequest,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import { FormInput } from "@/shared/components/forms";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";
import { ROUTES } from "@/shared/constants/routes";
import { ActionButton } from "@/shared/components/actions";

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const responseData = error.response?.data;
    if (
      responseData &&
      typeof responseData === "object" &&
      "message" in responseData &&
      typeof responseData.message === "string" &&
      responseData.message.trim() !== ""
    ) {
      return responseData.message;
    }

    if (!error.response) {
      // WWHN-325: guard offline chặn mutation ngay tại axios (không có
      // response); phải hiển thị đúng thông điệp khóa ghi ngoại tuyến thay vì
      // báo lỗi kết nối chung chung khiến người dùng tưởng BE hỏng.
      if (error.code === OFFLINE_MUTATION_CODE) {
        return error.message;
      }
      if (error.code === "ECONNABORTED") {
        return "Máy chủ xác thực phản hồi quá thời gian. Vui lòng thử lại.";
      }
      return "Không thể kết nối đến máy chủ xác thực. Kiểm tra Backend hoặc cấu hình CORS.";
    }

    return `Đăng nhập thất bại (HTTP ${error.response.status}).`;
  }

  return error instanceof Error && error.message
    ? error.message
    : "Đăng nhập thất bại";
}

export function LoginPage() {
  const login = useLogin();
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = handleSubmit((values) =>
    login.mutate(toLoginRequest(values)),
  );

  const errorMessage = login.isError ? getLoginErrorMessage(login.error) : null;

  const isSubmitting = login.isPending || login.isSuccess;

  return (
    <main className="hn-login-page">
      {isSubmitting && (
        <div className="hn-login-loading" role="status" aria-live="polite">
          <div className="hn-login-loading-card">
            <Spin size="large" />
            <Typography.Text strong style={{ display: "block", marginTop: 12 }}>
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
                title="Không thể đăng nhập"
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
                name="identifier"
                label="Đăng nhập bằng Gmail"
                placeholder="your@gmail.com"
                prefix={<UserOutlined style={{ color: "#8c887e" }} />}
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
                disabled={isSubmitting}
              />

              <div style={{ textAlign: "right", marginBottom: 14 }}>
                <Link to={ROUTES.FORGOT_PASSWORD}>Quên mật khẩu?</Link>
              </div>

              <ActionButton
                kind="login"
                className="hn-login-submit"
                loading={login.isPending}
                disabled={isSubmitting}
                type="submit"
                fullWidth
              >
                Đăng nhập
              </ActionButton>
            </Form>
          </div>
        </div>
      </section>
    </main>
  );
}
