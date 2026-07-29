import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, Form, Typography, Spin } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { useLogin } from "@/modules/auth/hooks/use-login";
import {
  loginSchema,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import { FormInput } from "@/shared/components/forms";
import { BRAND } from "@/app/theme";

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: BRAND.gradient,
        position: "relative",
      }}
    >
      {/* Loading overlay khi đang xử lý login/switch context */}
      {isSubmitting && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255, 255, 255, 0.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Spin size="large" />
          <Typography.Text style={{ marginTop: 16, fontSize: 16 }}>
            {login.isPending
              ? "Đang đăng nhập..."
              : "Đang khởi tạo quyền truy cập..."}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ marginTop: 8 }}>
            {login.isPending
              ? "Vui lòng chờ trong giây lát"
              : "Đang chuẩn bị hệ thống cho bạn"}
          </Typography.Text>
        </div>
      )}

      <Card
        variant="borderless"
        style={{
          width: 400,
          maxWidth: "100%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
          opacity: isSubmitting ? 0.5 : 1,
        }}
        styles={{ body: { padding: 32 } }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 12px",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: BRAND.gradient,
              color: "#fff",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            E
          </div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            ERP System
          </Typography.Title>
          <Typography.Text type="secondary">
            Đăng nhập để tiếp tục
          </Typography.Text>
        </div>

        {errorMessage && (
          <Alert
            type="error"
            description={errorMessage}
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        <Form layout="vertical" onSubmitCapture={onSubmit} requiredMark={false}>
          <FormInput
            control={control}
            name="email"
            label="Email"
            placeholder="you@example.com"
            prefix={<MailOutlined style={{ color: "#bbb" }} />}
            autoFocus
            disabled={isSubmitting}
          />

          <FormInput
            control={control}
            name="password"
            label="Mật khẩu"
            placeholder="••••••••"
            prefix={<LockOutlined style={{ color: "#bbb" }} />}
            password
            disabled={isSubmitting}
          />

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={login.isPending}
            disabled={isSubmitting}
            style={{ marginTop: 8 }}
          >
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
