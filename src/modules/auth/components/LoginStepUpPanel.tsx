import { useEffect, useState, type FormEvent } from "react";
import { Box, UiButton, UiTextField } from "@/shared/ui";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthLoginFeedback } from "@/modules/auth/components/AuthLoginFeedback";
import { AUTH_UAT_FORM_SX } from "@/modules/auth/components/AuthLoginFormSx";
import { MfaOtpInput, MFA_OTP_LENGTH } from "@/modules/auth/components/MfaOtpInput";
import type {
  StepUpRequired,
  StepUpVerifyResponse,
} from "@/modules/auth/types/auth.types";
import type { LoginFeedback } from "@/modules/auth/utils/login-feedback";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { useT } from "@/shared/i18n/useT";

const RESEND_COOLDOWN_SECONDS = 60;

export function LoginStepUpPanel({
  challenge,
  verified,
  feedback,
  isVerifying,
  isResending,
  isContinuing,
  throttled,
  online,
  onVerify,
  onResend,
  onContinueLogin,
  onBack,
}: {
  challenge: StepUpRequired;
  verified: StepUpVerifyResponse | null;
  feedback: LoginFeedback | null;
  isVerifying: boolean;
  isResending: boolean;
  isContinuing: boolean;
  throttled: boolean;
  online: boolean;
  onVerify: (code: string) => void;
  onResend: () => Promise<unknown>;
  onContinueLogin: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const copy = useAuthUatCopy();
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: MFA_OTP_LENGTH }, () => ""),
  );
  const [recoveryCode, setRecoveryCode] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(
    () => Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
  );
  const [now, setNow] = useState(() => Date.now());
  const [resentNotice, setResentNotice] = useState(false);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) setCooldownUntil(null);
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const remainingCooldown =
    cooldownUntil !== null && cooldownUntil > now
      ? Math.ceil((cooldownUntil - now) / 1000)
      : 0;

  const otpCode = digits.join("");
  const trimmedRecovery = recoveryCode.trim();
  const isOtpReady = otpCode.length === MFA_OTP_LENGTH;
  const isCodeReady =
    isOtpReady || (challenge.method === "mfa" && trimmedRecovery !== "");
  const unknown = feedback?.kind === "unknown";
  const unavailableAccount = feedback?.kind === "account-unavailable";
  const busy = isVerifying || isContinuing;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (verified) {
      onContinueLogin();
      return;
    }
    if (!isCodeReady || busy || throttled || !online) return;
    onVerify(isOtpReady ? otpCode : trimmedRecovery);
  };

  const handleResend = async () => {
    if (remainingCooldown > 0 || isResending || busy || throttled || !online) {
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

  const subtitle =
    challenge.method === "mfa"
      ? t("auth.login.stepUpMfaSubtitle")
      : t("auth.login.stepUpEmailSubtitle", {
          email: challenge.masked_email || "email đăng ký",
        });

  return (
    <AuthShell
      baselineScreen="login"
      titleId="login-step-up-title"
      title={t("auth.login.stepUpTitle")}
      subtitle={subtitle}
      showBaselineHeading
    >
      <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <Box
          role="status"
          aria-live="polite"
          sx={AUTH_UAT_FORM_SX}
          data-busy={busy ? "true" : "false"}
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
              {t("auth.login.stepUpResent")}
            </Box>
          )}

          {verified ? (
            <Box
              sx={{
                border: "1px solid var(--auth-border, #c9dfff)",
                borderRadius: "9px",
                backgroundColor: "var(--auth-note, #ECF7FD)",
                padding: "16px 18px",
                color: AUTH_BASELINE.ink,
                fontSize: { xs: 13, sm: 14 },
              }}
            >
              <Box sx={{ fontWeight: 700 }}>
                {t("auth.login.stepUpVerifiedTitle")}
              </Box>
              <Box sx={{ marginTop: "4px" }}>
                {t("auth.login.stepUpVerifiedBody", {
                  count: verified.password_attempts_left,
                })}
              </Box>
            </Box>
          ) : (
            <>
              <MfaOtpInput
                digits={digits}
                onChange={setDigits}
                disabled={busy || unknown || unavailableAccount}
                label={t("auth.login.stepUpCodeLabel")}
              />
              {challenge.method === "mfa" && (
                <Box
                  component="details"
                  sx={{
                    color: AUTH_BASELINE.muted,
                    fontSize: { xs: 12, sm: 13 },
                    "& summary": {
                      cursor: "pointer",
                      color: AUTH_BASELINE.link,
                      fontWeight: 600,
                    },
                  }}
                >
                  <Box component="summary">{t("auth.mfa.codeHelp")}</Box>
                  <Box sx={{ marginTop: "10px" }}>
                    <UiTextField
                      fullWidth
                      label={t("auth.mfa.recoveryTitle")}
                      value={recoveryCode}
                      onChange={(event) => setRecoveryCode(event.target.value)}
                      autoComplete="off"
                      disabled={busy || unknown || unavailableAccount}
                    />
                  </Box>
                </Box>
              )}
              {challenge.method === "email" && (
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
                      busy ||
                      throttled ||
                      !online
                    }
                  >
                    {remainingCooldown > 0
                      ? t("auth.login.stepUpResendIn", {
                          seconds: remainingCooldown,
                        })
                      : t("auth.login.stepUpResend")}
                  </UiButton>
                </Box>
              )}
            </>
          )}

          {unknown ? (
            <Box sx={{ color: AUTH_BASELINE.muted, fontSize: 13 }}>
              {copy.unknownHelp}
            </Box>
          ) : unavailableAccount ? (
            <UiButton type="button" fullWidth onClick={onBack}>
              {copy.backToLogin}
            </UiButton>
          ) : verified ? (
            <UiButton
              type="submit"
              fullWidth
              loading={isContinuing}
              disabled={isContinuing || throttled || !online}
            >
              {isContinuing
                ? copy.submitting
                : t("auth.login.stepUpContinueSubmit")}
            </UiButton>
          ) : (
            <UiButton
              type="submit"
              fullWidth
              loading={isVerifying}
              disabled={isVerifying || !isCodeReady || throttled || !online}
            >
              {isVerifying
                ? copy.submitting
                : t("auth.login.stepUpVerifySubmit")}
            </UiButton>
          )}

          {!unavailableAccount && (
            <UiButton
              type="button"
              appearance="text"
              fullWidth
              onClick={onBack}
              disabled={busy}
            >
              {t("auth.login.deviceBackToLogin")}
            </UiButton>
          )}
        </Box>
      </form>
    </AuthShell>
  );
}
