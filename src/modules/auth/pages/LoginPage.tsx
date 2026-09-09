import { useMemo, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import { useLogin, useMfaVerify } from "@/modules/auth/hooks/use-login";
import {
  buildLoginSchema,
  toLoginRequest,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import { Box, UiAlert, UiButton, UiFormCheckbox, UiTextField } from "@/shared/ui";
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
  const mfaVerify = useMfaVerify();
  const [mfaCode, setMfaCode] = useState("");
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

  // WWHN-SEC-08 — bước 2. Điều kiện render dựa trên KẾT QUẢ của bước 1, không
  // phải một state riêng: state riêng có thể lệch với dữ liệu (ví dụ người dùng
  // bấm Back rồi submit lại) và tạo ra màn hình nhập mã cho một phiên chờ đã hết.
  const challenge = login.data?.kind === "mfa_required" ? login.data : null;

  const mfaErrorMessage = mfaVerify.isError
    ? getLoginErrorMessage(mfaVerify.error, t)
    : null;

  const onSubmitMfa = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (challenge === null || mfaCode.trim() === "") return;
    mfaVerify.mutate({ mfaToken: challenge.mfa_token, code: mfaCode.trim() });
  };

  const errorMessage = login.isError
    ? getLoginErrorMessage(login.error, t)
    : null;

  const isSubmitting = login.isPending || login.isSuccess;

  // WWHN-SEC-08 — màn nhập mã. Trả về sớm, KHÔNG render kèm form mật khẩu:
  // để hai form cùng tồn tại thì người dùng có thể submit lại mật khẩu và sinh
  // một phiên chờ thứ hai, còn phiên đang hiển thị thì im lặng chết.
  if (challenge !== null) {
    return (
      <AuthShell
        titleId="login-mfa-title"
        title={<>{t("auth.mfa.challengeTitle")}</>}
        subtitle={t("auth.mfa.challengeSubtitle")}
        loadingText={mfaVerify.isPending ? t("auth.login.authenticating") : null}
      >
        {mfaErrorMessage && (
          <Box sx={{ marginBottom: "14px" }}>
            <UiAlert tone="error" title={t("auth.login.errorTitle")}>
              {mfaErrorMessage}
            </UiAlert>
          </Box>
        )}

        <form onSubmit={onSubmitMfa} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <UiTextField
              label={t("auth.mfa.codeLabel")}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="123456"
              autoFocus
              // inputMode numeric bật bàn phím số trên điện thoại, nhưng KHÔNG
              // dùng type="number": mã bắt đầu bằng 0 sẽ bị trình duyệt cắt mất,
              // và mã khôi phục có cả chữ lẫn dấu gạch.
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={mfaVerify.isPending}
              helperText={t("auth.mfa.codeHelp")}
            />

            <UiButton
              type="submit"
              fullWidth
              loading={mfaVerify.isPending}
              disabled={mfaVerify.isPending || mfaCode.trim() === ""}
            >
              {t("auth.mfa.verifySubmit")}
            </UiButton>
          </Box>
        </form>
      </AuthShell>
    );
  }

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
            placeholder={t("auth.fields.passwordPlaceholder")}
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
