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
import {
  Box,
  UiAlert,
  UiButton,
  UiFormCheckbox,
  UiFormText,
} from "@/shared/ui";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";
import { ROUTES } from "@/shared/constants/routes";

/**
 * "Ghi nhớ đăng nhập": chỉ lưu identifier (KHÔNG BAO GIỜ lưu mật khẩu) để
 * prefill lần sau; storage bị chặn (private mode) thì bỏ qua trong im lặng.
 */
const REMEMBER_STORAGE_KEY = "hn-wms.login.remember-identifier";

function readRememberedIdentifier(): string {
  try {
    return window.localStorage.getItem(REMEMBER_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistRememberedIdentifier(identifier: string | null): void {
  try {
    if (identifier === null) {
      window.localStorage.removeItem(REMEMBER_STORAGE_KEY);
    } else {
      window.localStorage.setItem(REMEMBER_STORAGE_KEY, identifier.trim());
    }
  } catch {
    // tiện ích phụ — không chặn đăng nhập
  }
}

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
  const rememberedIdentifier = readRememberedIdentifier();
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: rememberedIdentifier,
      password: "",
      remember: rememberedIdentifier !== "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    persistRememberedIdentifier(values.remember ? values.identifier : null);
    login.mutate(toLoginRequest(values));
  });

  const errorMessage = login.isError ? getLoginErrorMessage(login.error) : null;

  const isSubmitting = login.isPending || login.isSuccess;

  return (
    <AuthShell
      titleId="login-title"
      title={
        <>
          Xin chào bạn đến với Hoa Nam!{" "}
          <Box component="span" aria-hidden="true">
            👋
          </Box>
        </>
      }
      subtitle="Vui lòng đăng nhập vào tài khoản của bạn"
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <UiFormText
            control={control}
            name="identifier"
            label="Email"
            placeholder="your@gmail.com"
            autoFocus
            disabled={isSubmitting}
          />

          <UiFormText
            control={control}
            name="password"
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            type="password"
            disabled={isSubmitting}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "4px",
              // Kéo lề checkbox của MUI về thẳng cột với ô nhập.
              marginTop: "-6px",
              "& .MuiFormControlLabel-root": { marginLeft: "-9px" },
            }}
          >
            <UiFormCheckbox
              control={control}
              name="remember"
              label="Ghi nhớ đăng nhập"
              disabled={isSubmitting}
            />
            <Link to={ROUTES.FORGOT_PASSWORD}>Quên mật khẩu?</Link>
          </Box>

          <UiButton
            type="submit"
            fullWidth
            loading={login.isPending}
            disabled={isSubmitting}
          >
            Đăng nhập
          </UiButton>
        </Box>
      </form>
    </AuthShell>
  );
}
