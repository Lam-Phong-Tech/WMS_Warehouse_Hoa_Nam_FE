import { localizeMessage } from "@/shared/i18n/localize-message";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForgotPassword } from "@/modules/auth/hooks/use-forgot-password";
import { useVerifyOtp } from "@/modules/auth/hooks/use-verify-otp";
import { useResetPassword } from "@/modules/auth/hooks/use-reset-password";
import { useLimitBrowserInspection } from "@/modules/auth/hooks/use-limit-browser-inspection";
import {
  buildForgotPasswordEmailSchema,
  buildOtpSchema,
  buildResetPasswordFormSchema,
  type ForgotPasswordEmailFormValues,
  type OtpFormValues,
  type ResetPasswordFormValues,
} from "@/modules/auth/schemas/forgot-password.schema";
import { NEW_PASSWORD_MAX_LENGTH } from "@/modules/auth/schemas/change-password.schema";
import { Box, UiButton } from "@/shared/ui";
import { AuthShell, AuthNote } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { AUTH_UAT_FORM_SX } from "@/modules/auth/components/AuthLoginFormSx";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { useT } from "@/shared/i18n/useT";
import { PasswordRecoveryError } from "@/modules/auth/services/password-recovery.service";

/** Existing BE contract: email -> OTP -> verified reset_token. Do not label an
 * OTP request as "send link" or invent a username/email lookup. See UAT handoff. */
const OTP_TTL_SECONDS = 5 * 60;
type Step = "email" | "otp" | "password" | "expired" | "success";
function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function RecoveryError({ children }: { children: string }) {
  return (
    <Box
      role="alert"
      aria-live="polite"
      sx={{
        borderRadius: "var(--ops-radius-card)",
        padding: "13px 15px",
        color: "var(--auth-error-ink, #A33348)",
        backgroundColor: "var(--auth-error-bg, #FFF1F3)",
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      {children}
    </Box>
  );
}
export function ForgotPasswordPage() {
  useLimitBrowserInspection();
  const t = useT();
  const navigate = useNavigate();
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
  const resendSecondsLeft = otpSentAt === null ? 0 : Math.max(0, 45 - Math.floor((now - otpSentAt) / 1000));
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
  useEffect(() => {
    // Revalidate only errors already shown; retain server messages from their raw source.
    for (const field of ["email"] as const) {
      const error = emailForm.getFieldState(field).error;
      if (error?.type === "server" && failure?.fields.email)
        emailForm.setError(field, {
          type: "server",
          message: localizeMessage(failure.fields.email),
        });
      else if (error && error.type !== "server") void emailForm.trigger(field);
    }
    for (const field of ["otp"] as const) {
      const error = otpForm.getFieldState(field).error;
      if (error?.type === "server" && failure?.fields.otp)
        otpForm.setError(field, {
          type: "server",
          message: localizeMessage(failure.fields.otp),
        });
      else if (error && error.type !== "server") void otpForm.trigger(field);
    }
    for (const [field, serverField] of [
      ["newPassword", "new_password"],
      ["newPasswordConfirmation", "new_password_confirmation"],
    ] as const) {
      const error = passwordForm.getFieldState(field).error;
      const message = failure?.fields[serverField];
      if (error?.type === "server" && message)
        passwordForm.setError(field, {
          type: "server",
          message: localizeMessage(message),
        });
      else if (error && error.type !== "server")
        void passwordForm.trigger(field);
    }
  }, [t, failure, emailForm, otpForm, passwordForm]);

  const isBusy =
    forgotPassword.isPending || verifyOtp.isPending || resetPassword.isPending;
  const emailValue = useWatch({ control: emailForm.control, name: "email" });
  const otpValue = useWatch({ control: otpForm.control, name: "otp" });
  const passwordValue = useWatch({ control: passwordForm.control, name: "newPassword" });
  const confirmValue = useWatch({ control: passwordForm.control, name: "newPasswordConfirmation" });
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
        setStep("expired");
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
    if (recoveryError.kind === "token") {
      setResetToken("");
      passwordForm.reset();
      setStep("expired");
    }
    if (recoveryError.kind === "otp") setOtpFailures((count) => count + 1);
    const fields = recoveryError.fields;
    if (fields.email) emailForm.setError("email", { type: "server", message: localizeMessage(fields.email) });
    if (fields.otp) otpForm.setError("otp", { type: "server", message: localizeMessage(fields.otp) });
    if (fields.new_password)
      passwordForm.setError("newPassword", { type: "server", message: localizeMessage(fields.new_password) });
    if (fields.new_password_confirmation)
      passwordForm.setError("newPasswordConfirmation", {
        type: "server",
        message: localizeMessage(fields.new_password_confirmation),
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
            setStep("success");
          },
          onError: showFailure,
          onSettled: release,
        },
      );
    })(event);
  };
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
      showBaselineHeading={step !== "success" && step !== "expired"}
      recoveryStep={step === "email" ? t("auth.forgotPassword.stepAccount") : step === "otp" ? t("auth.forgotPassword.stepVerify") : step === "password" ? t("auth.forgotPassword.stepPassword") : step === "success" ? t("auth.forgotPassword.stepDone") : undefined}
      extendIllustration={step === "otp"}
      hideRecoveryBack={step === "success"}
      showRecoveryBack={step === "expired"}
      title={
        step === "success" ? t("auth.forgotPassword.doneTitle") : step === "expired" ? t("auth.forgotPassword.expiredTitle") : step === "password" ? t("auth.forgotPassword.newPasswordTitle") : step === "otp" ? t("auth.forgotPassword.verifyTitle") : t("auth.forgotPassword.title")
      }
      subtitle={
        step === "email"
          ? t("auth.forgotPassword.subtitleEmail")
          : step === "otp"
            ? t("auth.forgotPassword.subtitleOtp", { email })
            : step === "success" ? t("auth.forgotPassword.doneSubtitle") : step === "expired" ? t("auth.forgotPassword.expiredSubtitle") : t("auth.forgotPassword.newPasswordSubtitle")
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
              disabled={blocked || !emailValue.trim()}
              type="submit"
              fullWidth
            >
              {isBusy
                ? t("auth.forgotPassword.processing")
                : t("auth.forgotPassword.sendOtp")}
            </UiButton>
            <Box role="note" sx={{ display: "flex", alignItems: "center", gap: "18px", minHeight: 80,
              padding: "17px 22px", borderRadius: "9px", color: "var(--auth-ink, #071c57)", backgroundColor: "var(--auth-note, #ebf6ff)", fontSize: 17 }}>
              <Box aria-hidden="true" sx={{ color: "var(--auth-link)", fontSize: 29, lineHeight: 1 }}>✉</Box>
              {t("auth.forgotPassword.emailNotice")}
            </Box>
          </Box>
        </form>
      )}
      {step === "otp" && (
        <form onSubmit={onSubmitOtp} noValidate aria-busy={isBusy}>
          <Box sx={AUTH_UAT_FORM_SX} data-busy={isBusy ? "true" : "false"}>
            {failure?.kind !== "otp" && errorBanner}
            {needsNewOtp && (
              <AuthNote>{t("auth.forgotPassword.otpNewRequired")}</AuthNote>
            )}
            <Controller control={otpForm.control} name="otp" render={({ field, fieldState }) => (
              <Box>
                <Box component="label" htmlFor="recovery-otp" sx={{ display: "block", mb: 1 }}>
                  {t("auth.forgotPassword.otpLabel")} (6 {t("auth.forgotPassword.digits")})
                </Box>
                <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: { xs: "6px", sm: "12px" } }}>
                  {Array.from({ length: 6 }, (_, index) => <Box key={index} className="otp-digit" aria-hidden="true"
                    sx={{ display: "grid", placeItems: "center", height: { xs: 54, sm: 72 }, border: `1px solid ${fieldState.error || failure?.kind === "otp" ? "#f32637" : !isExpired && field.value.length === index ? "var(--auth-link)" : "var(--auth-border, #c9dfff)"}`,
                      borderRadius: "9px", backgroundColor: "var(--auth-field, #f9fcff)", fontSize: { xs: 22, sm: 27 } }}>
                    {field.value[index] ?? ""}
                  </Box>)}
                  <Box component="input" id="recovery-otp" autoFocus value={field.value} ref={field.ref}
                    onBlur={field.onBlur} onChange={(event: React.ChangeEvent<HTMLInputElement>) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={isBusy || isExpired || needsNewOtp} autoComplete="one-time-code" inputMode="numeric" maxLength={6}
                    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "text" }} />
                </Box>
                {(fieldState.error || failure?.kind === "otp") && <Box role="alert" sx={{ mt: 1, color: "#ed1426", fontSize: 14 }}>
                  {fieldState.error?.message ?? t("auth.forgotPassword.otpInvalid")}
                </Box>}
              </Box>
            )} />
            <Box sx={{ color: isExpired ? "#e9a75a" : "var(--auth-muted, #657db3)", fontSize: 16 }}>
              {isExpired ? t("auth.forgotPassword.otpExpired") : t("auth.forgotPassword.otpValidFor", { time: formatCountdown(secondsLeft) })}
            </Box>
            {!isExpired && !needsNewOtp && (
              <UiButton
                className="hn-auth-primary-cta"
                loading={isBusy}
                disabled={blocked || otpValue.length !== 6}
                type="submit"
                fullWidth
              >
                {t("auth.forgotPassword.verify")}
              </UiButton>
            )}
            <UiButton
              className="hn-auth-resend"
              type="button"
              appearance={isExpired || needsNewOtp ? "filled" : "text"}
              loading={isBusy}
              disabled={blocked || (!isExpired && !needsNewOtp && resendSecondsLeft > 0)}
              onClick={() => sendOtp(email)}
              fullWidth
            >
              {isExpired ? t("auth.forgotPassword.sendNewCode") : !needsNewOtp && resendSecondsLeft > 0
                ? t("auth.forgotPassword.resendIn", { time: formatCountdown(resendSecondsLeft) })
                : t("auth.forgotPassword.resendOtp")}
            </UiButton>
            <UiButton type="button" appearance="text" fullWidth disabled={isBusy} onClick={() => {
              setStep("email"); setEmail(""); setOtpSentAt(null); setOtpFailures(0); setFailure(null);
              otpForm.reset(); emailForm.reset(); verifyOtp.reset(); forgotPassword.reset();
            }}>{t("auth.forgotPassword.otherAccount")}</UiButton>
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
              maxLength={NEW_PASSWORD_MAX_LENGTH}
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
              maxLength={NEW_PASSWORD_MAX_LENGTH}
              disabled={isBusy || resetExpired}
            />
            <AuthNote sx={{ marginTop: 0 }}>
              {t("auth.forgotPassword.passwordPolicyNotice")}
            </AuthNote>
            {!resetExpired && (
              <UiButton
                className="hn-auth-primary-cta"
                loading={isBusy}
                disabled={blocked || !passwordValue || !confirmValue}
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
          </Box>
        </form>
      )}
      {step === "success" && (
        <Box sx={{ textAlign: "center" }}>
          <Box aria-hidden="true" sx={{ mx: "auto", my: 4, width: 96, height: 96, display: "grid", placeItems: "center",
            borderRadius: "50%", border: "5px solid #39bf79", color: "#098444", backgroundColor: "#ebfff3", fontSize: 54 }}>✓</Box>
          <Box sx={{ color: "var(--auth-ink, #071c57)", fontSize: 36, lineHeight: 1.2, fontWeight: 800, m: 0 }}>
            {t("auth.forgotPassword.doneTitle")}
          </Box>
          <Box sx={{ color: "var(--auth-muted, #657db3)", fontSize: 19, mt: 2, mb: 6 }}>
            {t("auth.forgotPassword.doneSubtitle")}
          </Box>
          <UiButton type="button" onClick={() => navigate("/login")} fullWidth appearance="filled">
            {t("auth.forgotPassword.doneLogin")}
          </UiButton>
        </Box>
      )}
      {step === "expired" && <Box sx={{ textAlign: "center" }}>
        <Box aria-hidden="true" sx={{ mx: "auto", mb: 3, width: 82, height: 82, display: "grid", placeItems: "center",
          borderRadius: "50%", border: "4px solid #ffad32", color: "#ffad32", fontSize: 46 }}>◷</Box>
        <Box sx={{ color: "var(--auth-ink, #071c57)", fontSize: 36, lineHeight: 1.2, fontWeight: 800, m: 0 }}>
          {t("auth.forgotPassword.expiredTitle")}
        </Box>
        <Box sx={{ color: "var(--auth-muted, #657db3)", fontSize: 19, mt: 2, mb: 6 }}>
          {t("auth.forgotPassword.expiredSubtitle")}
        </Box>
        <UiButton className="hn-auth-primary-cta" type="button" fullWidth disabled={blocked} loading={isBusy}
          onClick={() => sendOtp(email)}>{t("auth.forgotPassword.requestNewCode")}</UiButton>
      </Box>}
    </AuthShell>
  );
}
