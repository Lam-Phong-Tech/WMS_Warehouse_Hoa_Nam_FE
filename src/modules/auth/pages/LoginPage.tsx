import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import { useLogin } from "@/modules/auth/hooks/use-login";
import {
  loginSchema,
  toLoginRequest,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import { Box, UiAlert, UiFormText } from "@/shared/ui";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { AuthShell } from "@/modules/auth/components/AuthShell";
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
    <AuthShell
      titleId="login-title"
      title="Đăng nhập hệ thống"
      subtitle="Sử dụng tài khoản Hoa Nam để truy cập nghiệp vụ kho."
      loadingText={
        isSubmitting
          ? login.isPending
            ? "Đang xác thực tài khoản..."
            : "Đang tải quyền truy cập..."
          : null
      }
    >
      {errorMessage && (
        <Box sx={{ marginBottom: "14px" }}>
          <UiAlert tone="error" title="Không thể đăng nhập">
            {errorMessage}
          </UiAlert>
        </Box>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
          <UiFormText
            control={control}
            name="identifier"
            label="Đăng nhập bằng Gmail"
            placeholder="your@gmail.com"
            startIcon="user"
            autoFocus
            disabled={isSubmitting}
          />

          <UiFormText
            control={control}
            name="password"
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            startIcon="lock"
            type="password"
            disabled={isSubmitting}
          />

          <Box sx={{ textAlign: "right", "& a": { color: S.primary } }}>
            <Link to={ROUTES.FORGOT_PASSWORD}>Quên mật khẩu?</Link>
          </Box>

          <ActionButton
            kind="login"
            loading={login.isPending}
            disabled={isSubmitting}
            type="submit"
            fullWidth
          >
            Đăng nhập
          </ActionButton>
        </Box>
      </form>
    </AuthShell>
  );
}
