import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  useDeviceResend,
  useDeviceVerify,
  useLogin,
  useMfaVerify,
  useStepUpResend,
  useStepUpVerify,
} from "@/modules/auth/hooks/use-login";
import { useLoginPow } from "@/modules/auth/hooks/use-login-pow";
import { useLimitBrowserInspection } from "@/modules/auth/hooks/use-limit-browser-inspection";
import {
  buildLoginSchema,
  toLoginRequest,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import type {
  LoginRequest,
  StepUpRequired,
  StepUpVerifyResponse,
} from "@/modules/auth/types/auth.types";
import { authService } from "@/modules/auth/services/auth.service";
import { Box, UiButton, UiTextField } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import {
  AuthAccessNotice,
  AuthLoginFeedback,
  AuthSessionReplacementNotice,
} from "@/modules/auth/components/AuthLoginFeedback";
import { MfaOtpInput, MFA_OTP_LENGTH } from "@/modules/auth/components/MfaOtpInput";
import { LoginStepUpPanel } from "@/modules/auth/components/LoginStepUpPanel";
import { DeviceVerificationPanel } from "@/modules/auth/components/DeviceVerificationPanel";
import {
  clearSessionReplacementNotice,
  readSessionReplacementNotice,
} from "@/modules/auth/utils/session-replacement-notice";
import { AUTH_UAT_FORM_SX } from "@/modules/auth/components/AuthLoginFormSx";
import {
  classifyLoginFailure,
  readLoginThrottle,
  rememberLoginThrottle,
  type LoginFeedback,
  type LoginThrottle,
} from "@/modules/auth/utils/login-feedback";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";
import { runtimeConfig } from "@/shared/config/env";
import { useAuthStore } from "@/shared/store/auth.store";

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
    if (identifier === null)
      window.localStorage.removeItem(REMEMBER_STORAGE_KEY);
    else window.localStorage.setItem(REMEMBER_STORAGE_KEY, identifier.trim());
  } catch {
    /* Never block authentication on optional identifier storage. */
  }
}
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
function failureOf(error: unknown): LoginFeedback {
  return classifyLoginFailure(error, {
    offline:
      !isOnline() ||
      (isAxiosError(error) && error.code === OFFLINE_MUTATION_CODE),
  });
}

export function LoginPage() {
  useLimitBrowserInspection();
  const t = useT();
  const copy = useAuthUatCopy();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [replacementNotice, setReplacementNotice] = useState(() =>
    readSessionReplacementNotice(),
  );
  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);
  useEffect(() => {
    if (runtimeConfig.temporaryAutoLogin && isAuthenticated)
      navigate(DASHBOARD_CANONICAL, { replace: true });
  }, [isAuthenticated, navigate]);

  const login = useLogin();
  const mfaVerify = useMfaVerify();
  const stepUpVerify = useStepUpVerify();
  const stepUpResend = useStepUpResend();
  const deviceVerify = useDeviceVerify();
  const deviceResend = useDeviceResend();
  const pow = useLoginPow();

  const [mfaDigits, setMfaDigits] = useState<string[]>(() =>
    Array.from({ length: MFA_OTP_LENGTH }, () => ""),
  );
  const [mfaRecoveryCode, setMfaRecoveryCode] = useState("");
  const [stepUpChallenge, setStepUpChallenge] =
    useState<StepUpRequired | null>(null);
  const [verifiedStepUp, setVerifiedStepUp] =
    useState<StepUpVerifyResponse | null>(null);
  const [powTimeoutMessage, setPowTimeoutMessage] = useState<string | null>(
    null,
  );
  const [throttle, setThrottle] = useState<LoginThrottle | null>(() =>
    readLoginThrottle(),
  );
  const [clock, setClock] = useState(() => Date.now());
  const attemptInFlight = useRef(false);
  const mfaInFlight = useRef(false);
  const powRetriedRef = useRef(false);
  const rememberedIdentifier = readRememberedIdentifier();
  const loginSchema = useMemo(() => buildLoginSchema(t, copy), [t, copy]);
  const { control, getValues, handleSubmit, reset, setValue } =
    useForm<LoginFormValues>({
      resolver: zodResolver(loginSchema),
      defaultValues: {
        identifier: rememberedIdentifier,
        password: "",
        remember: rememberedIdentifier !== "",
      },
    });

  useEffect(() => {
    if (throttle?.until == null) return;
    const timer = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [throttle]);

  const throttled =
    throttle !== null && (throttle.until === null || throttle.until > clock);
  const mfaChallenge = login.data?.kind === "mfa_required" ? login.data : null;
  const deviceChallenge =
    login.data?.kind === "device_verification_required" ? login.data : null;

  const activeMutation = mfaChallenge
    ? mfaVerify
    : deviceChallenge
      ? deviceVerify
      : stepUpChallenge && !verifiedStepUp
        ? stepUpVerify
        : login;
  const rawFeedback = activeMutation.isError
    ? failureOf(activeMutation.error)
    : null;
  // A completed Retry-After unlocks the CTA without submitting anything automatically.
  const feedback: LoginFeedback | null = throttled
    ? { kind: "rate-limited", retryAt: throttle?.until }
    : rawFeedback?.kind === "rate-limited" || rawFeedback?.kind === "pow-required"
      ? null
      : rawFeedback?.kind === "unknown" ||
          rawFeedback?.kind === "account-unavailable"
        ? rawFeedback
        : !online
          ? { kind: "offline" }
          : rawFeedback;
  const unknown = feedback?.kind === "unknown";
  const unavailableAccount = feedback?.kind === "account-unavailable";
  const isAuthenticatedSuccess =
    login.isSuccess && login.data?.kind === "authenticated";
  const isSubmitting =
    login.isPending || pow.solving || isAuthenticatedSuccess;
  const fieldsDisabled = isSubmitting || unknown || unavailableAccount;

  const recordFailure = (error: unknown) => {
    const failure = failureOf(error);
    if (failure.kind === "rate-limited") {
      const next = { until: failure.retryAt ?? null };
      rememberLoginThrottle(next);
      setThrottle(next);
      setClock(Date.now());
    }
    if (failure.kind === "account-unavailable") setValue("password", "");
  };

  const canAttempt = () => {
    const lock = readLoginThrottle();
    return (
      isOnline() &&
      !(lock && (lock.until === null || lock.until > Date.now())) &&
      !unknown &&
      !unavailableAccount
    );
  };

  const executeLogin = (requestPayload: LoginRequest) => {
    attemptInFlight.current = true;
    login.mutate(requestPayload, {
      onSuccess: (data) => {
        if (data.kind === "step_up_required") {
          setStepUpChallenge(data);
          setVerifiedStepUp(null);
        } else {
          setStepUpChallenge(null);
          setVerifiedStepUp(null);
        }
      },
      onError: (error) => {
        const failure = failureOf(error);
        if (failure.kind === "pow-required" && !powRetriedRef.current) {
          powRetriedRef.current = true;
          void (async () => {
            try {
              const challenge =
                failure.challenge ??
                (await authService.powChallenge(requestPayload.email));
              const outcome = await pow.solve(
                challenge.nonce,
                challenge.difficulty,
              );
              if (outcome.kind === "solved") {
                executeLogin({
                  ...requestPayload,
                  pow: {
                    challenge_id: challenge.challenge_id,
                    solution: outcome.solution,
                  },
                });
                return;
              }
              if (outcome.kind === "unsupported") {
                executeLogin({
                  ...requestPayload,
                  pow_supported: false,
                });
                return;
              }
              if (outcome.kind === "timeout") {
                setPowTimeoutMessage(t("auth.login.powTimeout"));
              }
            } catch (powError) {
              recordFailure(powError);
            } finally {
              attemptInFlight.current = false;
            }
          })();
          return;
        }
        recordFailure(error);
        attemptInFlight.current = false;
      },
      onSettled: (_data, error) => {
        if (!error) {
          attemptInFlight.current = false;
        }
      },
    });
  };

  const submitLogin = (values: LoginFormValues) => {
    if (attemptInFlight.current || isSubmitting || !canAttempt()) return;
    powRetriedRef.current = false;
    setPowTimeoutMessage(null);
    persistRememberedIdentifier(values.remember ? values.identifier : null);
    executeLogin(toLoginRequest(values));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(submitLogin)(event);
  };

  const otpCode = mfaDigits.join("");
  const trimmedRecoveryCode = mfaRecoveryCode.trim();
  const isOtpCodeReady = otpCode.length === MFA_OTP_LENGTH;
  const isMfaCodeReady = isOtpCodeReady || trimmedRecoveryCode !== "";

  const onSubmitMfa = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      mfaChallenge === null ||
      !isMfaCodeReady ||
      mfaInFlight.current ||
      mfaVerify.isPending ||
      mfaVerify.isSuccess ||
      !canAttempt()
    )
      return;
    mfaInFlight.current = true;
    mfaVerify.mutate(
      {
        mfaToken: mfaChallenge.mfa_token,
        code: isOtpCodeReady ? otpCode : trimmedRecoveryCode,
      },
      {
        onError: recordFailure,
        onSettled: () => {
          mfaInFlight.current = false;
        },
      },
    );
  };

  const returnToLogin = () => {
    if (attemptInFlight.current || mfaInFlight.current) return;
    pow.cancel();
    login.reset();
    mfaVerify.reset();
    stepUpVerify.reset();
    stepUpResend.reset();
    deviceVerify.reset();
    deviceResend.reset();
    setStepUpChallenge(null);
    setVerifiedStepUp(null);
    setPowTimeoutMessage(null);
    setMfaDigits(Array.from({ length: MFA_OTP_LENGTH }, () => ""));
    setMfaRecoveryCode("");
    reset({ identifier: "", password: "", remember: false });
  };

  if (stepUpChallenge !== null) {
    return (
      <LoginStepUpPanel
        challenge={stepUpChallenge}
        verified={verifiedStepUp}
        feedback={feedback}
        isVerifying={stepUpVerify.isPending}
        isResending={stepUpResend.isPending}
        isContinuing={login.isPending}
        throttled={throttled}
        online={online}
        onVerify={(code) => {
          if (stepUpVerify.isPending || !canAttempt()) return;
          stepUpVerify.mutate(
            { stepUpToken: stepUpChallenge.step_up_token, code },
            {
              onSuccess: (res) => {
                setVerifiedStepUp(res);
              },
              onError: recordFailure,
            },
          );
        }}
        onResend={() =>
          stepUpResend.mutateAsync(stepUpChallenge.step_up_token)
        }
        onContinueLogin={() => {
          if (attemptInFlight.current || login.isPending || !canAttempt())
            return;
          const currentValues = getValues();
          powRetriedRef.current = false;
          executeLogin({
            ...toLoginRequest(currentValues),
            step_up_token: stepUpChallenge.step_up_token,
          });
        }}
        onBack={returnToLogin}
      />
    );
  }

  if (deviceChallenge !== null) {
    return (
      <DeviceVerificationPanel
        challenge={deviceChallenge}
        feedback={feedback}
        isVerifying={deviceVerify.isPending}
        isResending={deviceResend.isPending}
        throttled={throttled}
        online={online}
        onVerify={(code) => {
          if (deviceVerify.isPending || deviceVerify.isSuccess || !canAttempt())
            return;
          deviceVerify.mutate(
            { deviceToken: deviceChallenge.device_token, code },
            { onError: recordFailure },
          );
        }}
        onResend={() =>
          deviceResend.mutateAsync(deviceChallenge.device_token)
        }
        onBack={returnToLogin}
      />
    );
  }

  if (mfaChallenge !== null) {
    return (
      <AuthShell
        baselineScreen="login"
        titleId="login-mfa-title"
        title={t("auth.mfa.challengeTitle")}
        subtitle={t("auth.mfa.challengeSubtitle")}
        showBaselineHeading
      >
        <form onSubmit={onSubmitMfa} noValidate aria-busy={mfaVerify.isPending}>
          <Box
            sx={AUTH_UAT_FORM_SX}
            data-busy={mfaVerify.isPending ? "true" : "false"}
          >
            {feedback && <AuthLoginFeedback feedback={feedback} mfa />}
            <MfaOtpInput
              digits={mfaDigits}
              onChange={setMfaDigits}
              disabled={mfaVerify.isPending || unknown || unavailableAccount}
              label={t("auth.mfa.codeLabel")}
            />
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
                  value={mfaRecoveryCode}
                  onChange={(event) => setMfaRecoveryCode(event.target.value)}
                  autoComplete="off"
                  disabled={
                    mfaVerify.isPending || unknown || unavailableAccount
                  }
                />
              </Box>
            </Box>
            {unknown ? (
              <Box sx={{ color: AUTH_BASELINE.muted, fontSize: 13 }}>
                {copy.unknownHelp}
              </Box>
            ) : unavailableAccount ? (
              <UiButton type="button" fullWidth onClick={returnToLogin}>
                {copy.backToLogin}
              </UiButton>
            ) : (
              <UiButton
                type="submit"
                fullWidth
                loading={mfaVerify.isPending}
                disabled={
                  mfaVerify.isPending ||
                  mfaVerify.isSuccess ||
                  !isMfaCodeReady ||
                  throttled ||
                  !online
                }
              >
                {mfaVerify.isPending
                  ? copy.submitting
                  : t("auth.mfa.verifySubmit")}
              </UiButton>
            )}
          </Box>
        </form>
      </AuthShell>
    );
  }

  const retry =
    feedback?.kind === "offline" || feedback?.kind === "service-unavailable";
  return (
    <AuthShell
      baselineScreen="login"
      titleId="login-title"
      title={t("auth.login.submit")}
      subtitle={t("auth.login.formSubtitle")}
      showBaselineHeading
    >
      <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
        <Box sx={AUTH_UAT_FORM_SX} data-busy={isSubmitting ? "true" : "false"}>
          {replacementNotice && (
            <AuthSessionReplacementNotice
              notice={replacementNotice}
              onDismiss={() => {
                clearSessionReplacementNotice();
                setReplacementNotice(null);
              }}
            />
          )}
          {pow.solving && (
            <Box
              role="status"
              aria-live="polite"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                border: "1px solid var(--auth-border, #c9dfff)",
                borderRadius: "9px",
                backgroundColor: "var(--auth-note, #ECF7FD)",
                color: AUTH_BASELINE.ink,
                padding: "14px 18px",
                fontSize: { xs: 13, sm: 14 },
              }}
            >
              <Box sx={{ fontWeight: 700 }}>{t("auth.login.powSolving")}</Box>
              <UiButton
                type="button"
                appearance="text"
                onClick={() => {
                  pow.cancel();
                  attemptInFlight.current = false;
                }}
              >
                {t("auth.login.powCancel")}
              </UiButton>
            </Box>
          )}
          {powTimeoutMessage && !pow.solving && (
            <Box
              role="alert"
              sx={{
                border: "1px solid var(--auth-alert-warning-border, #ffe0a9)",
                borderRadius: "9px",
                backgroundColor: "var(--auth-alert-warning-bg, #fff0d9)",
                color: "var(--auth-alert-warning-ink, #a55000)",
                padding: "14px 18px",
                fontSize: { xs: 13, sm: 14 },
                fontWeight: 600,
              }}
            >
              {powTimeoutMessage}
            </Box>
          )}
          {feedback && <AuthLoginFeedback feedback={feedback} />}
          <AuthField
            control={control}
            name="identifier"
            label={copy.identifierLabel}
            placeholder={copy.identifierPlaceholder}
            startIcon="user"
            autoFocus
            disabled={fieldsDisabled}
          />
          <AuthField
            control={control}
            name="password"
            label={t("auth.fields.password")}
            placeholder={t("auth.fields.passwordPlaceholder")}
            type="password"
            startIcon="lock"
            disabled={fieldsDisabled}
          />
          {!throttled && !unavailableAccount && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                fontSize: { xs: 14, sm: 15 },
              }}
            >
              {isSubmitting || unknown ? (
                <Box
                  component="span"
                  aria-disabled="true"
                  sx={{ color: AUTH_BASELINE.muted }}
                >
                  {t("auth.login.forgotPassword")}
                </Box>
              ) : (
                <Link to={ROUTES.FORGOT_PASSWORD}>
                  {t("auth.login.forgotPassword")}
                </Link>
              )}
            </Box>
          )}
          {unknown ? (
            <Box
              sx={{
                color: AUTH_BASELINE.muted,
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {copy.unknownHelp}
            </Box>
          ) : unavailableAccount ? (
            <UiButton type="button" fullWidth onClick={returnToLogin}>
              {copy.backToLogin}
            </UiButton>
          ) : (
            <UiButton
              type="submit"
              fullWidth
              loading={login.isPending || pow.solving}
              disabled={isSubmitting || throttled}
              sx={{
                position: "relative",
                "& .hn-login-submit-arrow": {
                  position: "absolute",
                  right: { xs: 18, sm: 22 },
                  fontSize: { xs: 19, sm: 22 },
                  lineHeight: 1,
                },
                "&.Mui-disabled .hn-login-submit-arrow": { opacity: 0.6 },
              }}
            >
              {isSubmitting
                ? copy.submitting
                : retry
                  ? t("common.retry")
                  : t("auth.login.submit")}
              {!isSubmitting && (
                <i
                  className={`${flatIconClass("arrow-right")} hn-login-submit-arrow`}
                  aria-hidden
                />
              )}
            </UiButton>
          )}
          <AuthAccessNotice />
        </Box>
      </form>
    </AuthShell>
  );
}
