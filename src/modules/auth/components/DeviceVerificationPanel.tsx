import { useEffect, useState, type FormEvent } from "react";
import { Box, UiButton } from "@/shared/ui";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthLoginFeedback } from "@/modules/auth/components/AuthLoginFeedback";
import { AUTH_UAT_FORM_SX } from "@/modules/auth/components/AuthLoginFormSx";
import { MfaOtpInput, MFA_OTP_LENGTH } from "@/modules/auth/components/MfaOtpInput";
import type { DeviceVerificationRequired } from "@/modules/auth/types/auth.types";
import type { LoginFeedback } from "@/modules/auth/utils/login-feedback";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { useT } from "@/shared/i18n/useT";

const RESEND_COOLDOWN_SECONDS = 60;

export function DeviceVerificationPanel({
  challenge,
  feedback,
  isVerifying,
  isResending,
  throttled,
  online,
  onVerify,
  onResend,
  onBack,
}: {
  challenge: DeviceVerificationRequired;
  feedback: LoginFeedback | null;
  isVerifying: boolean;
  isResending: boolean;
  throttled: boolean;
  online: boolean;
  onVerify: (code: string) => void;
  onResend: () => Promise<unknown>;
  onBack: () => void;
}) {
  const t = useT();
  const copy = useAuthUatCopy();
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: MFA_OTP_LENGTH }, () => ""),
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resentNotice, setResentNotice] = useState(false);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const remainingCooldown =
    cooldownUntil !== null && cooldownUntil > now
      ? Math.ceil((cooldownUntil - now) / 1000)
      : 0;

  const otpCode = digits.join("");
  const isOtpReady = otpCode.length === MFA_OTP_LENGTH;
  const unknown = feedback?.kind === "unknown";
  const unavailableAccount = feedback?.kind === "account-unavailable";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOtpReady || isVerifying || throttled || !online) return;
    onVerify(otpCode);
  };

  const handleResend = async () => {
    if (
      remainingCooldown > 0 ||
      isResending ||
      isVerifying ||
      throttled ||
      !online
    ) {
      return;
    }
    setResentNotice(false);
    try {
      await onResend();
      const target = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setCooldownUntil(target);
      setNow(Date.now());
      setResentNotice(true);
    } catch {
      // Error banner is handled by parent mutation state.
    }
  };

  return (
    <AuthShell
      baselineScreen="login"
      titleId="login-device-title"
      title={t("auth.login.deviceTitle")}
      subtitle={t("auth.login.deviceSubtitle", {
        email: challenge.masked_email || "email đăng ký",
      })}
      showBaselineHeading
    >
      <form onSubmit={handleSubmit} noValidate aria-busy={isVerifying}>
        <Box
          role="status"
          aria-live="polite"
          sx={AUTH_UAT_FORM_SX}
          data-busy={isVerifying ? "true" : "false"}
        >
          {feedback && <AuthLoginFeedback feedback={feedback} mfa />}
          {resentNotice && !feedback && (
            <Box
              sx={{
                color: AUTH_BASELINE.ink,
                fontSize: { xs: 13, sm: 14 },
                fontWeight: 600,
              }}
            >
              {t("auth.login.deviceResent")}
            </Box>
          )}
          <MfaOtpInput
            digits={digits}
            onChange={setDigits}
            disabled={isVerifying || unknown || unavailableAccount}
            label={t("auth.login.deviceCodeLabel")}
          />
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: { xs: 13, sm: 14 },
            }}
          >
            <UiButton
              type="button"
              appearance="text"
              onClick={() => void handleResend()}
              disabled={
                remainingCooldown > 0 ||
                isResending ||
                isVerifying ||
                throttled ||
                !online
              }
            >
              {remainingCooldown > 0
                ? t("auth.login.deviceResendIn", { seconds: remainingCooldown })
                : t("auth.login.deviceResend")}
            </UiButton>
          </Box>
          {unknown ? (
            <Box sx={{ color: AUTH_BASELINE.muted, fontSize: 13 }}>
              {copy.unknownHelp}
            </Box>
          ) : unavailableAccount ? (
            <UiButton type="button" fullWidth onClick={onBack}>
              {copy.backToLogin}
            </UiButton>
          ) : (
            <UiButton
              type="submit"
              fullWidth
              loading={isVerifying}
              disabled={isVerifying || !isOtpReady || throttled || !online}
            >
              {isVerifying
                ? copy.submitting
                : t("auth.login.deviceVerifySubmit")}
            </UiButton>
          )}
          {!unavailableAccount && (
            <UiButton
              type="button"
              appearance="text"
              fullWidth
              onClick={onBack}
              disabled={isVerifying}
            >
              {t("auth.login.deviceBackToLogin")}
            </UiButton>
          )}
        </Box>
      </form>
    </AuthShell>
  );
}
