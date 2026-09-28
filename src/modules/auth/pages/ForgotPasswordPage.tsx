import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForgotPassword } from "@/modules/auth/hooks/use-forgot-password";
import { useVerifyOtp } from "@/modules/auth/hooks/use-verify-otp";
import { useResetPassword } from "@/modules/auth/hooks/use-reset-password";
import {
  buildForgotPasswordEmailSchema, buildOtpSchema, buildResetPasswordFormSchema,
  type ForgotPasswordEmailFormValues, type OtpFormValues, type ResetPasswordFormValues,
} from "@/modules/auth/schemas/forgot-password.schema";
import { Box, UiButton } from "@/shared/ui";
import { AuthShell, AuthNote, AuthBackLink } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { AUTH_UAT_FORM_SX } from "@/modules/auth/components/AuthLoginFeedback";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { useT } from "@/shared/i18n/useT";

/** Existing BE contract: email -> OTP -> verified reset_token. Do not label an
 * OTP request as "send link" or invent a username/email lookup. See UAT handoff. */
const OTP_TTL_SECONDS = 5 * 60;
type Step = "email" | "otp" | "password";
function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function RecoveryError({ children }: { children: string }) {
  return <Box role="alert" aria-live="polite" sx={{ borderRadius: "9px", padding: "13px 15px",
    color: "#A33348", backgroundColor: "#FFF1F3", fontSize: 14, lineHeight: 1.45 }}>{children}</Box>;
}
export function ForgotPasswordPage() {
  const t = useT();
  const copy = useAuthUatCopy();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  useEffect(() => {
    if (otpSentAt === null || step !== "otp") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [otpSentAt, step]);
  const secondsLeft = otpSentAt === null ? OTP_TTL_SECONDS
    : Math.max(0, OTP_TTL_SECONDS - Math.floor((now - otpSentAt) / 1000));
  const forgotPassword = useForgotPassword();
  const verifyOtp = useVerifyOtp();
  const resetPassword = useResetPassword();
  const emailSchema = useMemo(() => buildForgotPasswordEmailSchema(t), [t]);
  const otpSchema = useMemo(() => buildOtpSchema(t), [t]);
  const passwordSchema = useMemo(() => buildResetPasswordFormSchema(t), [t]);
  const emailForm = useForm<ForgotPasswordEmailFormValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
  const otpForm = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema), defaultValues: { otp: "" } });
  const passwordForm = useForm<ResetPasswordFormValues>({ resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", newPasswordConfirmation: "" } });
  const isBusy = forgotPassword.isPending || verifyOtp.isPending || resetPassword.isPending;
  const isExpired = step === "otp" && secondsLeft <= 0;
  const release = () => { inFlight.current = false; };
  const sendOtp = (address: string) => {
    if (inFlight.current || isBusy) return;
    inFlight.current = true;
    forgotPassword.mutate({ email: address }, {
      onSuccess: () => {
        const sentAt = Date.now();
        setEmail(address); otpForm.reset({ otp: "" }); verifyOtp.reset();
        setStep("otp"); setOtpSentAt(sentAt); setNow(sentAt);
      },
      onSettled: release,
    });
  };
  const onSubmitEmail = (event: FormEvent<HTMLFormElement>) => {
    void emailForm.handleSubmit((values) => sendOtp(values.email.trim()))(event);
  };
  const onSubmitOtp = (event: FormEvent<HTMLFormElement>) => {
    void otpForm.handleSubmit((values) => {
      if (inFlight.current || isBusy || otpSentAt === null || Date.now() - otpSentAt >= OTP_TTL_SECONDS * 1000) return;
      inFlight.current = true;
      verifyOtp.mutate({ email, otp: values.otp }, {
        onSuccess: (data) => { setResetToken(data.reset_token); setStep("password"); },
        onSettled: release,
      });
    })(event);
  };
  const onSubmitPassword = (event: FormEvent<HTMLFormElement>) => {
    void passwordForm.handleSubmit((values) => {
      if (inFlight.current || isBusy || !resetToken) return;
      inFlight.current = true;
      resetPassword.mutate({ email, reset_token: resetToken, new_password: values.newPassword,
        new_password_confirmation: values.newPasswordConfirmation }, { onSettled: release });
    })(event);
  };
  const back = isBusy ? null : <AuthBackLink>{t("auth.forgotPassword.backToLogin")}</AuthBackLink>;
  return (
    <AuthShell titleId="forgot-password-title" illustration="forgot" baselineScreen="login" showBaselineHeading
      title={step === "password" ? copy.resetTitle : t("auth.forgotPassword.title")}
      subtitle={step === "email" ? t("auth.forgotPassword.subtitleEmail")
        : step === "otp" ? t("auth.forgotPassword.subtitleOtp", { email }) : copy.resetSubtitle}>
      {step === "email" && <form onSubmit={onSubmitEmail} noValidate aria-busy={isBusy}>
        <Box sx={AUTH_UAT_FORM_SX} data-busy={isBusy ? "true" : "false"}>
          {forgotPassword.isError && <RecoveryError>{copy.forgotFailed}</RecoveryError>}
          <AuthField control={emailForm.control} name="email" label={t("auth.fields.email")}
            placeholder="your@gmail.com" startIcon="envelope" autoFocus disabled={isBusy} />
          <UiButton className="hn-auth-primary-cta" loading={isBusy} disabled={isBusy} type="submit" fullWidth>
            {isBusy ? t("auth.forgotPassword.processing") : t("auth.forgotPassword.sendOtp")}
          </UiButton>
          {back}
        </Box>
      </form>}
      {step === "otp" && <form onSubmit={onSubmitOtp} noValidate aria-busy={isBusy}>
        <Box sx={AUTH_UAT_FORM_SX} data-busy={isBusy ? "true" : "false"}>
          {verifyOtp.isError && <RecoveryError>{t("auth.forgotPassword.otpInvalid")}</RecoveryError>}
          {forgotPassword.isError && <RecoveryError>{copy.forgotFailed}</RecoveryError>}
          <AuthField control={otpForm.control} name="otp" label={t("auth.forgotPassword.otpLabel")}
            placeholder={t("auth.forgotPassword.otpPlaceholder")} numericOnly maxLength={6} startIcon="key"
            autoFocus disabled={isBusy || isExpired} />
          <AuthNote sx={{ marginTop: 0 }}>{isExpired ? t("auth.forgotPassword.otpExpired")
            : t("auth.forgotPassword.otpValidFor", { time: formatCountdown(secondsLeft) })}</AuthNote>
          {isExpired ? <UiButton type="button" className="hn-auth-primary-cta" loading={isBusy} disabled={isBusy}
            onClick={() => sendOtp(email)} fullWidth>{t("auth.forgotPassword.resendOtp")}</UiButton>
            : <UiButton className="hn-auth-primary-cta" loading={isBusy} disabled={isBusy} type="submit" fullWidth>
                {t("auth.forgotPassword.verify")}
              </UiButton>}
          {back}
        </Box>
      </form>}
      {step === "password" && <form onSubmit={onSubmitPassword} noValidate aria-busy={isBusy}>
        <Box sx={AUTH_UAT_FORM_SX} data-busy={isBusy ? "true" : "false"}>
          {resetPassword.isError && <RecoveryError>{t("auth.forgotPassword.resetFailed")}</RecoveryError>}
          <AuthField control={passwordForm.control} name="newPassword" label={t("auth.fields.newPassword")}
            placeholder={t("auth.fields.newPasswordPlaceholder")} type="password" startIcon="lock" autoFocus disabled={isBusy} />
          <AuthField control={passwordForm.control} name="newPasswordConfirmation" label={t("auth.fields.confirmNewPassword")}
            placeholder={t("auth.fields.confirmNewPasswordPlaceholder")} type="password" startIcon="lock" disabled={isBusy} />
          <AuthNote sx={{ marginTop: 0 }}>{t("auth.validation.passwordStrength")}</AuthNote>
          <UiButton className="hn-auth-primary-cta" loading={isBusy} disabled={isBusy} type="submit" fullWidth>
            {isBusy ? t("auth.forgotPassword.processing") : copy.savePassword}
          </UiButton>
          {back}
        </Box>
      </form>}
    </AuthShell>
  );
}
