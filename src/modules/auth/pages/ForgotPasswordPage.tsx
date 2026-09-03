import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useForgotPassword } from "@/modules/auth/hooks/use-forgot-password";
import { useVerifyOtp } from "@/modules/auth/hooks/use-verify-otp";
import { useResetPassword } from "@/modules/auth/hooks/use-reset-password";
import {
  buildForgotPasswordEmailSchema,
  buildOtpSchema,
  buildResetPasswordFormSchema,
  type ForgotPasswordEmailFormValues,
  type OtpFormValues,
  type ResetPasswordFormValues,
} from "@/modules/auth/schemas/forgot-password.schema";
import { Box, UiAlert, UiButton } from "@/shared/ui";
import {
  AuthShell,
  AuthNote,
  AuthBackLink,
} from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { useT } from "@/shared/i18n/useT";

/** Đồng bộ với config/password_reset.php (otp_ttl_minutes=5) phía BE — chỉ là
 * đếm ngược hiển thị, BE mới là nguồn sự thật về hạn thật của OTP. */
const OTP_TTL_SECONDS = 5 * 60;

type Step = "email" | "otp" | "password";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return fallback;
}

export function ForgotPasswordPage() {
  const t = useT();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  // Đổi mỗi lần gửi/gửi lại OTP để trigger effect đếm ngược bên dưới — không
  // dùng ref cầm interval id (react-hooks/refs cấm đọc/ghi ref trong closure
  // được tạo lúc render, ví dụ bên trong handleSubmit()).
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (otpSentAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [otpSentAt]);

  const secondsLeft =
    otpSentAt === null
      ? OTP_TTL_SECONDS
      : Math.max(0, OTP_TTL_SECONDS - Math.floor((now - otpSentAt) / 1000));

  const forgotPassword = useForgotPassword();
  const verifyOtp = useVerifyOtp();
  const resetPassword = useResetPassword();

  const forgotPasswordEmailSchema = useMemo(
    () => buildForgotPasswordEmailSchema(t),
    [t],
  );
  const otpSchema = useMemo(() => buildOtpSchema(t), [t]);
  const resetPasswordFormSchema = useMemo(
    () => buildResetPasswordFormSchema(t),
    [t],
  );

  const emailForm = useForm<ForgotPasswordEmailFormValues>({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: "" },
  });
  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });
  const passwordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: "", newPasswordConfirmation: "" },
  });

  const isExpired = step === "otp" && secondsLeft <= 0;

  const onSubmitEmail = emailForm.handleSubmit((values) => {
    const trimmedEmail = values.email.trim();
    forgotPassword.mutate(
      { email: trimmedEmail },
      {
        onSuccess: () => {
          setEmail(trimmedEmail);
          otpForm.reset({ otp: "" });
          setStep("otp");
          setOtpSentAt(Date.now());
        },
      },
    );
  });

  const onResendOtp = () => {
    forgotPassword.mutate(
      { email },
      {
        onSuccess: () => {
          otpForm.reset({ otp: "" });
          setOtpSentAt(Date.now());
        },
      },
    );
  };

  const onSubmitOtp = otpForm.handleSubmit((values) => {
    verifyOtp.mutate(
      { email, otp: values.otp },
      {
        onSuccess: (data) => {
          setResetToken(data.reset_token);
          setStep("password");
        },
      },
    );
  });

  const onSubmitPassword = passwordForm.handleSubmit((values) => {
    resetPassword.mutate({
      email,
      reset_token: resetToken,
      new_password: values.newPassword,
      new_password_confirmation: values.newPasswordConfirmation,
    });
  });

  const isBusy =
    forgotPassword.isPending || verifyOtp.isPending || resetPassword.isPending;

  return (
    <AuthShell
      titleId="forgot-password-title"
      illustration="forgot"
      title={t("auth.forgotPassword.title")}
      subtitle={
        <>
          {step === "email" && t("auth.forgotPassword.subtitleEmail")}
          {step === "otp" && t("auth.forgotPassword.subtitleOtp", { email })}
          {step === "password" && t("auth.forgotPassword.subtitlePassword")}
        </>
      }
      loadingText={isBusy ? t("auth.forgotPassword.processing") : null}
    >
      {step === "email" && (
        <form onSubmit={onSubmitEmail} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            <AuthField
              control={emailForm.control}
              name="email"
              label={t("auth.fields.email")}
              placeholder="your@gmail.com"
              autoFocus
              disabled={forgotPassword.isPending}
            />

            <UiButton
              loading={forgotPassword.isPending}
              disabled={forgotPassword.isPending}
              type="submit"
              fullWidth
            >
              {t("auth.forgotPassword.sendOtp")}
            </UiButton>

            <AuthBackLink>{t("auth.forgotPassword.backToLogin")}</AuthBackLink>
          </Box>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={onSubmitOtp} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            {verifyOtp.isError && (
              <UiAlert tone="error">
                {getApiErrorMessage(
                  verifyOtp.error,
                  t("auth.forgotPassword.otpInvalid"),
                )}
              </UiAlert>
            )}

            <AuthField
              control={otpForm.control}
              name="otp"
              label={t("auth.forgotPassword.otpLabel")}
              placeholder={t("auth.forgotPassword.otpPlaceholder")}
              numericOnly
              maxLength={6}
              autoFocus
              disabled={verifyOtp.isPending || isExpired}
            />

            <AuthNote sx={{ marginTop: 0 }}>
              {isExpired
                ? t("auth.forgotPassword.otpExpired")
                : t("auth.forgotPassword.otpValidFor", {
                    time: formatCountdown(secondsLeft),
                  })}
            </AuthNote>

            {isExpired ? (
              <UiButton
                loading={forgotPassword.isPending}
                onClick={onResendOtp}
                fullWidth
              >
                {t("auth.forgotPassword.resendOtp")}
              </UiButton>
            ) : (
              <UiButton
                loading={verifyOtp.isPending}
                disabled={verifyOtp.isPending}
                type="submit"
                fullWidth
              >
                {t("auth.forgotPassword.verify")}
              </UiButton>
            )}

            <AuthBackLink>{t("auth.forgotPassword.backToLogin")}</AuthBackLink>
          </Box>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={onSubmitPassword} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            {resetPassword.isError && (
              <UiAlert tone="error">
                {getApiErrorMessage(
                  resetPassword.error,
                  t("auth.forgotPassword.resetFailed"),
                )}
              </UiAlert>
            )}

            <AuthField
              control={passwordForm.control}
              name="newPassword"
              label={t("auth.fields.newPassword")}
              placeholder={t("auth.fields.newPasswordPlaceholder")}
              type="password"
              autoFocus
              disabled={resetPassword.isPending}
            />

            <AuthField
              control={passwordForm.control}
              name="newPasswordConfirmation"
              label={t("auth.fields.confirmNewPassword")}
              placeholder={t("auth.fields.confirmNewPasswordPlaceholder")}
              type="password"
              disabled={resetPassword.isPending}
            />

            <UiButton
              loading={resetPassword.isPending}
              disabled={resetPassword.isPending}
              type="submit"
              fullWidth
            >
              {t("auth.forgotPassword.submitReset")}
            </UiButton>
          </Box>
        </form>
      )}
    </AuthShell>
  );
}
