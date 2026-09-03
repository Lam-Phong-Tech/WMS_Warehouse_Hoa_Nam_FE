import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import { useLogin } from "@/modules/auth/hooks/use-login";
import {
  buildLoginSchema,
  toLoginRequest,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import { Box, UiAlert, UiButton, UiFormCheckbox } from "@/shared/ui";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";
import { ROUTES } from "@/shared/constants/routes";
import { useT, type TranslateFn } from "@/shared/i18n/useT";

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

function getLoginErrorMessage(error: unknown, t: TranslateFn): string {
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
        return t("auth.login.errorTimeout");
      }
      return t("auth.login.errorNetwork");
    }

    if (error.response.status === 401) {
      return t("auth.login.errorInvalidCredentials");
    }
    if (error.response.status === 429) {
      return t("auth.login.errorTooManyAttempts");
    }
    return t("auth.login.errorGeneric");
  }

  return error instanceof Error && error.message
    ? error.message
    : t("auth.login.failed");
}

export function LoginPage() {
  const t = useT();
  const login = useLogin();
  const rememberedIdentifier = readRememberedIdentifier();
  const loginSchema = useMemo(() => buildLoginSchema(t), [t]);
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

  const errorMessage = login.isError
    ? getLoginErrorMessage(login.error, t)
    : null;

  const isSubmitting = login.isPending || login.isSuccess;

  return (
    <AuthShell
      titleId="login-title"
      title={<>{t("auth.login.title")}</>}
      subtitle={t("auth.login.subtitle")}
      loadingText={
        isSubmitting
          ? login.isPending
            ? t("auth.login.authenticating")
            : t("auth.login.loadingAccess")
          : null
      }
    >
      {errorMessage && (
        <Box sx={{ marginBottom: "14px" }}>
          <UiAlert tone="error" title={t("auth.login.errorTitle")}>
            {errorMessage}
          </UiAlert>
        </Box>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <AuthField
            control={control}
            name="identifier"
            label={t("auth.fields.email")}
            placeholder="your@gmail.com"
            autoFocus
            disabled={isSubmitting}
          />

          <AuthField
            control={control}
            name="password"
            label={t("auth.fields.password")}
            placeholder="············"
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
              label={t("auth.login.remember")}
              disabled={isSubmitting}
            />
            <Link to={ROUTES.FORGOT_PASSWORD}>
              {t("auth.login.forgotPassword")}
            </Link>
          </Box>

          <UiButton
            type="submit"
            fullWidth
            loading={login.isPending}
            disabled={isSubmitting}
          >
            {t("auth.login.submit")}
          </UiButton>
        </Box>
      </form>
    </AuthShell>
  );
}
