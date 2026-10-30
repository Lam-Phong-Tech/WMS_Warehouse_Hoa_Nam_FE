import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Box, UiButton } from "@/shared/ui";
import {
  AuthShell,
  AuthNote,
  AuthBackLink,
} from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { AUTH_UAT_FORM_SX } from "@/modules/auth/components/AuthLoginFormSx";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { useT } from "@/shared/i18n/useT";
import { PasswordRecoveryError } from "@/modules/auth/services/password-recovery.service";

/** Existing BE contract: email -> OTP -> verified reset_token. Do not label an
 * OTP request as "send link" or invent a username/email lookup. See UAT handoff. */
const OTP_TTL_SECONDS = 5 * 60;
type Step = "email" | "otp" | "password";
function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function RecoveryError({ children }: { children: string }) {
  return (
    <Box
      role="alert"
      aria-live="polite"
      sx={{
        borderRadius: "var(--ops-radius-card)",
        padding: "13px 15px",
        color: "#A33348",
        backgroundColor: "#FFF1F3",
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      {children}
    </Box>
  );
}
export function ForgotPasswordPage() {
  const t = useT();
  const copy = useAuthUatCopy();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetExpiresAt, setResetExpiresAt] = useState<number | null>(null);
  const [otpFailures, setOtpFailures] = useState(0);
  const [failure, setFailure] = useState<PasswordRecoveryError | null>(null);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  useEffect(() => {
    if (
      otpSentAt === null &&
      resetExpiresAt === null &&
      failure?.kind !== "rate-limit"
    )
      return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [otpSentAt, resetExpiresAt, failure?.kind]);
  const secondsLeft =
    otpSentAt === null
      ? OTP_TTL_SECONDS
      : Math.max(0, OTP_TTL_SECONDS - Math.floor((now - otpSentAt) / 1000));
  const forgotPassword = useForgotPassword();
  const verifyOtp = useVerifyOtp();
  const resetPassword = useResetPassword();
  const emailSchema = useMemo(() => buildForgotPasswordEmailSchema(t), [t]);
  const otpSchema = useMemo(() => buildOtpSchema(t), [t]);
  const passwordSchema = useMemo(() => buildResetPasswordFormSchema(t), [t]);
  const emailForm = useForm<ForgotPasswordEmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });
  const passwordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", newPasswordConfirmation: "" },
  });
  const isBusy =
    forgotPassword.isPending || verifyOtp.isPending || resetPassword.isPending;
  const isExpired = step === "otp" && secondsLeft <= 0;
  const resetExpired = resetExpiresAt !== null && now >= resetExpiresAt;
  const needsNewOtp =
    otpFailures >= 5 || (step === "otp" && otpSentAt === null);
  const isRateLocked = (at: number) =>
    failure?.kind === "rate-limit" &&
    (failure.retryAt === null || at < failure.retryAt);
  const blocked = isBusy || isRateLocked(now);
  useEffect(() => {
    if (resetExpiresAt === null) return;
    const timer = window.setTimeout(
      () => {
        setNow(Date.now());
        setResetToken("");
        passwordForm.reset();
      },
      Math.max(0, resetExpiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [resetExpiresAt, passwordForm]);
  const cleanupActions = useRef([
    emailForm.reset,
    otpForm.reset,
    passwordForm.reset,
    forgotPassword.reset,
    verifyOtp.reset,
    resetPassword.reset,
  ]);
  useEffect(() => {
    const actions = cleanupActions.current;
    return () => actions.forEach((reset) => reset());
  }, []);
  const showFailure = (error: unknown) => {
    const recoveryError =
      error instanceof PasswordRecoveryError
        ? error
        : new PasswordRecoveryError("unavailable");
    setNow(Date.now());
    setFailure(recoveryError);
    if (recoveryError.kind === "otp") setOtpFailures((count) => count + 1);
    const fields = recoveryError.fields;
    if (fields.email) emailForm.setError("email", { message: fields.email });
    if (fields.otp) otpForm.setError("otp", { message: fields.otp });
    if (fields.new_password)
      passwordForm.setError("newPassword", { message: fields.new_password });
    if (fields.new_password_confirmation)
      passwordForm.setError("newPasswordConfirmation", {
        message: fields.new_password_confirmation,
      });
  };
  const release = () => {
    inFlight.current = false;
  };
  const sendOtp = (address: string) => {
    if (inFlight.current || isBusy || isRateLocked(Date.now())) return;
    inFlight.current = true;
    setFailure(null);
    setResetToken("");
    setResetExpiresAt(null);
    passwordForm.reset();
    otpForm.reset();
    verifyOtp.reset();
    resetPassword.reset();
    setOtpSentAt(null);
    forgotPassword.mutate(
      { email: address },
      {
        onSuccess: () => {
          const sentAt = Date.now();
          setEmail(address);
          otpForm.reset({ otp: "" });
          verifyOtp.reset();
          setOtpFailures(0);
          setStep("otp");
          setOtpSentAt(sentAt);
          setNow(sentAt);
        },
        onError: showFailure,
        onSettled: release,
      },
    );
  };
  const onSubmitEmail = (event: FormEvent<HTMLFormElement>) => {
    void emailForm.handleSubmit((values) =>
      sendOtp(values.email.trim().toLowerCase()),
    )(event);
  };
  const onSubmitOtp = (event: FormEvent<HTMLFormElement>) => {
    void otpForm.handleSubmit((values) => {
      if (
        inFlight.current ||
        isBusy ||
        isRateLocked(Date.now()) ||
        needsNewOtp ||
        otpSentAt === null ||
        Date.now() - otpSentAt >= OTP_TTL_SECONDS * 1000
      )
        return;
      inFlight.current = true;
      setFailure(null);
      verifyOtp.mutate(
        { email, otp: values.otp },
        {
          onSuccess: (data) => {
            setResetToken(data.reset_token);
            setResetExpiresAt(Date.now() + data.expires_in * 1000);
            otpForm.reset();
            verifyOtp.reset();
            setStep("password");
          },
          onError: showFailure,
          onSettled: release,
        },
      );
    })(event);
  };
  const onSubmitPassword = (event: FormEvent<HTMLFormElement>) => {
    void passwordForm.handleSubmit((values) => {
      if (
        inFlight.current ||
        isBusy ||
        isRateLocked(Date.now()) ||
        !resetToken ||
        resetExpiresAt === null ||
        Date.now() >= resetExpiresAt
      )
        return;
      inFlight.current = true;
      setFailure(null);
      resetPassword.mutate(
        {
          email,
          reset_token: resetToken,
          new_password: values.newPassword,
          new_password_confirmation: values.newPasswordConfirmation,
        },
        {
          onSuccess: () => {
            setResetToken("");
            setEmail("");
            otpForm.reset();
            passwordForm.reset();
            emailForm.reset();
          },
          onError: showFailure,
          onSettled: release,
        },
      );
    })(event);
  };
  const back = isBusy ? null : (
    <AuthBackLink>{t("auth.forgotPassword.backToLogin")}</AuthBackLink>
  );
  const errorMessage =
    failure?.kind === "rate-limit" && !isRateLocked(now)
      ? null
      : failure?.kind === "rate-limit"
        ? failure.retryAt === null
          ? t("auth.forgotPassword.rateUnknown")
          : t("auth.forgotPassword.rateWaiting", {
              seconds: String(
                Math.max(0, Math.ceil((failure.retryAt - now) / 1000)),
              ),
            })
        : failure?.kind === "offline"
          ? t("auth.forgotPassword.recoveryOffline")
          : failure?.kind === "validation"
            ? t("auth.forgotPassword.recoveryValidation")
            : failure?.kind === "otp"
              ? t("auth.forgotPassword.otpInvalid")
              : failure?.kind === "token" || resetExpired
                ? t("auth.forgotPassword.resetTokenInvalid")
                : failure
                  ? t("auth.forgotPassword.recoveryUnavailable")
                  : null;
  const errorBanner = errorMessage ? (
    <RecoveryError>{`${errorMessage}${failure?.requestId ? ` ${t("auth.forgotPassword.recoveryRequestId", { id: failure.requestId })}` : ""}`}</RecoveryError>
  ) : null;
  return (
    <AuthShell
      titleId="forgot-password-title"
      illustration="forgot"
      baselineScreen="login"
      showBaselineHeading
      title={
        step === "password" ? copy.resetTitle : t("auth.forgotPassword.title")
      }
      subtitle={
        step === "email"
          ? t("auth.forgotPassword.subtitleEmail")
          : step === "otp"
            ? t("auth.forgotPassword.subtitleOtp", { email })
            : copy.resetSubtitle
      }
    >
      {step === "email" && (
        <form onSubmit={onSubmitEmail} noValidate aria-busy={isBusy}>
          <Box sx={AUTH_UAT_FORM_SX} data-busy={isBusy ? "true" : "false"}>
            {errorBanner}
            <AuthField
              control={emailForm.control}
              name="email"
              label={t("auth.fields.email")}
              placeholder="your@gmail.com"
              startIcon="envelope"
              autoFocus
              disabled={isBusy}
            />
            <UiButton
              className="hn-auth-primary-cta"
              loading={isBusy}
              disabled={blocked}
              type="submit"
              fullWidth
            >
              {isBusy
                ? t("auth.forgotPassword.processing")
                : t("auth.forgotPassword.sendOtp")}
            </UiButton>
            {back}
          </Box>
        </form>
      )}
      {step === "otp" && (
        <form onSubmit={onSubmitOtp} noValidate aria-busy={isBusy}>
          <Box sx={AUTH_UAT_FORM_SX} data-busy={isBusy ? "true" : "false"}>
            {errorBanner}
            {needsNewOtp && (
              <AuthNote>{t("auth.forgotPassword.otpNewRequired")}</AuthNote>
            )}
            <AuthField
              control={otpForm.control}
              name="otp"
              label={t("auth.forgotPassword.otpLabel")}
              placeholder={t("auth.forgotPassword.otpPlaceholder")}
              numericOnly
              maxLength={6}
              startIcon="key"
              autoFocus
              disabled={isBusy || isExpired || needsNewOtp}
            />
            <AuthNote sx={{ marginTop: 0 }}>
              {isExpired
                ? t("auth.forgotPassword.otpExpired")
                : t("auth.forgotPassword.otpValidFor", {
                    time: formatCountdown(secondsLeft),
                  })}
            </AuthNote>
            {!isExpired && !needsNewOtp && (
              <UiButton
                className="hn-auth-primary-cta"
                loading={isBusy}
                disabled={blocked}
                type="submit"
                fullWidth
              >
                {t("auth.forgotPassword.verify")}
              </UiButton>
            )}
            <UiButton
              type="button"
              appearance={isExpired || needsNewOtp ? "filled" : "text"}
              loading={isBusy}
              disabled={blocked}
              onClick={() => sendOtp(email)}
              fullWidth
            >
              {t("auth.forgotPassword.resendOtp")}
            </UiButton>
            {back}
          </Box>
        </form>
      )}
      {step === "password" && (
        <form onSubmit={onSubmitPassword} noValidate aria-busy={isBusy}>
          <Box sx={AUTH_UAT_FORM_SX} data-busy={isBusy ? "true" : "false"}>
            {errorBanner}
            <AuthField
              control={passwordForm.control}
              name="newPassword"
              label={t("auth.fields.newPassword")}
              placeholder={t("auth.fields.newPasswordPlaceholder")}
              type="password"
              startIcon="lock"
              autoFocus
              disabled={isBusy || resetExpired}
            />
            <AuthField
              control={passwordForm.control}
              name="newPasswordConfirmation"
              label={t("auth.fields.confirmNewPassword")}
              placeholder={t("auth.fields.confirmNewPasswordPlaceholder")}
              type="password"
              startIcon="lock"
              disabled={isBusy || resetExpired}
            />
            <AuthNote sx={{ marginTop: 0 }}>
              {t("auth.validation.passwordStrength")}
            </AuthNote>
            {!resetExpired && (
              <UiButton
                className="hn-auth-primary-cta"
                loading={isBusy}
                disabled={blocked}
                type="submit"
                fullWidth
              >
                {isBusy
                  ? t("auth.forgotPassword.processing")
                  : copy.savePassword}
              </UiButton>
            )}
            {(resetExpired || failure?.kind === "token") && (
              <UiButton
                type="button"
                disabled={blocked}
                onClick={() => sendOtp(email)}
                fullWidth
              >
                {t("auth.forgotPassword.resendOtp")}
              </UiButton>
            )}
            {back}
          </Box>
        </form>
      )}
    </AuthShell>
  );
}
