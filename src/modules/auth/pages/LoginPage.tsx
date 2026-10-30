import {
  useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useLogin, useMfaVerify } from "@/modules/auth/hooks/use-login";
import { buildLoginSchema, toLoginRequest, type LoginFormValues } from "@/modules/auth/schemas/login.schema";
import { Box, UiButton, UiTextField } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { AuthAccessNotice, AuthLoginFeedback } from "@/modules/auth/components/AuthLoginFeedback";
import { AUTH_UAT_FORM_SX } from "@/modules/auth/components/AuthLoginFormSx";
import { classifyLoginFailure, readLoginThrottle, rememberLoginThrottle, type LoginFeedback, type LoginThrottle } from "@/modules/auth/utils/login-feedback";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";
import { runtimeConfig } from "@/shared/config/env";
import { useAuthStore } from "@/shared/store/auth.store";

const REMEMBER_STORAGE_KEY = "hn-wms.login.remember-identifier";
function readRememberedIdentifier(): string {
  try { return window.localStorage.getItem(REMEMBER_STORAGE_KEY) ?? ""; }
  catch { return ""; }
}
function persistRememberedIdentifier(identifier: string | null): void {
  try {
    if (identifier === null) window.localStorage.removeItem(REMEMBER_STORAGE_KEY);
    else window.localStorage.setItem(REMEMBER_STORAGE_KEY, identifier.trim());
  } catch { /* Never block authentication on optional identifier storage. */ }
}
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
function isOnline() { return typeof navigator === "undefined" || navigator.onLine !== false; }
function failureOf(error: unknown): LoginFeedback {
  return classifyLoginFailure(error, {
    offline: !isOnline() || (isAxiosError(error) && error.code === OFFLINE_MUTATION_CODE),
  });
}

const MFA_OTP_LENGTH = 6;
/** Keep the existing MFA input, paste, recovery-code and keyboard behaviours. */
function MfaOtpInput({ digits, onChange, disabled, label }: {
  digits: string[]; onChange: (next: string[]) => void; disabled: boolean; label: string;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const writeDigits = (startIndex: number, rawValue: string) => {
    const numeric = rawValue.replace(/\D/g, "");
    const next = [...digits];
    if (numeric === "") { next[startIndex] = ""; onChange(next); return; }
    const chunk = numeric.slice(0, MFA_OTP_LENGTH - startIndex);
    chunk.split("").forEach((digit, offset) => { next[startIndex + offset] = digit; });
    onChange(next);
    inputRefs.current[Math.min(startIndex + chunk.length, MFA_OTP_LENGTH - 1)]?.focus();
  };
  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    writeDigits(index, event.target.value);
  };
  const handlePaste = (index: number, event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!/\d/.test(pasted)) return;
    event.preventDefault();
    writeDigits(index, pasted);
  };
  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Backspace" && digits[index] === "" && index > 0) {
      event.preventDefault();
      const next = [...digits]; next[index - 1] = ""; onChange(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); inputRefs.current[index - 1]?.focus(); }
    if (event.key === "ArrowRight" && index < MFA_OTP_LENGTH - 1) { event.preventDefault(); inputRefs.current[index + 1]?.focus(); }
  };
  return (
    <Box component="fieldset" sx={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}>
      <Box component="legend" sx={{ marginBottom: "8px", padding: 0, color: AUTH_BASELINE.ink,
        fontSize: { xs: 14, sm: 15 }, fontWeight: 700 }}>{label}</Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: "6px", sm: "8px" } }}>
        {digits.map((digit, index) => (
          <UiTextField key={index} value={digit} inputRef={(node) => { inputRefs.current[index] = node; }}
            onChange={(event) => handleChange(index, event)} onPaste={(event) => handlePaste(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)} autoFocus={index === 0}
            inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 1, pattern: "[0-9]*", "aria-label": `${label} ${index + 1}` } }}
            sx={{ width: { xs: 40, sm: 48 }, flex: "0 0 auto",
              "& .MuiOutlinedInput-root": { minHeight: { xs: 44, sm: 48 }, borderRadius: "8px" },
              "& .MuiInputBase-input": { boxSizing: "border-box", height: { xs: 44, sm: 48 }, padding: "0 !important",
                textAlign: "center", fontSize: { xs: 18, sm: 20 }, fontWeight: 800, fontVariantNumeric: "tabular-nums" } }} />
        ))}
      </Box>
    </Box>
  );
}

export function LoginPage() {
  const t = useT();
  const copy = useAuthUatCopy();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);
  useEffect(() => {
    if (runtimeConfig.temporaryAutoLogin && isAuthenticated) navigate(DASHBOARD_CANONICAL, { replace: true });
  }, [isAuthenticated, navigate]);

  const login = useLogin();
  const mfaVerify = useMfaVerify();
  const [mfaDigits, setMfaDigits] = useState<string[]>(() => Array.from({ length: MFA_OTP_LENGTH }, () => ""));
  const [mfaRecoveryCode, setMfaRecoveryCode] = useState("");
  const [throttle, setThrottle] = useState<LoginThrottle | null>(() => readLoginThrottle());
  const [clock, setClock] = useState(() => Date.now());
  const attemptInFlight = useRef(false);
  const mfaInFlight = useRef(false);
  const rememberedIdentifier = readRememberedIdentifier();
  const loginSchema = useMemo(() => buildLoginSchema(t, copy), [t, copy]);
  const { control, handleSubmit, reset, setValue } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: rememberedIdentifier, password: "", remember: rememberedIdentifier !== "" },
  });

  useEffect(() => {
    if (throttle?.until == null) return;
    const timer = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [throttle]);
  const throttled = throttle !== null && (throttle.until === null || throttle.until > clock);
  const challenge = login.data?.kind === "mfa_required" ? login.data : null;
  const activeMutation = challenge ? mfaVerify : login;
  const rawFeedback = activeMutation.isError ? failureOf(activeMutation.error) : null;
  // A completed Retry-After unlocks the CTA without submitting anything automatically.
  const feedback: LoginFeedback | null = throttled
    ? { kind: "rate-limited", retryAt: throttle?.until }
    : rawFeedback?.kind === "rate-limited" ? null
    : rawFeedback?.kind === "unknown" || rawFeedback?.kind === "account-unavailable" ? rawFeedback
    : !online ? { kind: "offline" } : rawFeedback;
  const unknown = feedback?.kind === "unknown";
  const unavailableAccount = feedback?.kind === "account-unavailable";
  const isSubmitting = login.isPending || (login.isSuccess && challenge === null);
  const fieldsDisabled = isSubmitting || unknown || unavailableAccount;

  const recordFailure = (error: unknown) => {
    const failure = failureOf(error);
    if (failure.kind === "rate-limited") {
      const next = { until: failure.retryAt ?? null };
      rememberLoginThrottle(next); setThrottle(next); setClock(Date.now());
    }
    if (failure.kind === "account-unavailable") setValue("password", "");
  };
  const canAttempt = () => {
    const lock = readLoginThrottle();
    return isOnline() && !(lock && (lock.until === null || lock.until > Date.now())) && !unknown && !unavailableAccount;
  };
  const submitLogin = (values: LoginFormValues) => {
    if (attemptInFlight.current || isSubmitting || !canAttempt()) return;
    attemptInFlight.current = true;
    persistRememberedIdentifier(values.remember ? values.identifier : null);
    login.mutate(toLoginRequest(values), {
      onError: recordFailure,
      onSettled: () => { attemptInFlight.current = false; },
    });
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
    if (challenge === null || !isMfaCodeReady || mfaInFlight.current || mfaVerify.isPending || mfaVerify.isSuccess || !canAttempt()) return;
    mfaInFlight.current = true;
    mfaVerify.mutate({ mfaToken: challenge.mfa_token, code: isOtpCodeReady ? otpCode : trimmedRecoveryCode }, {
      onError: recordFailure, onSettled: () => { mfaInFlight.current = false; },
    });
  };
  const returnToLogin = () => {
    if (attemptInFlight.current || mfaInFlight.current) return;
    login.reset(); mfaVerify.reset();
    setMfaDigits(Array.from({ length: MFA_OTP_LENGTH }, () => "")); setMfaRecoveryCode("");
    reset({ identifier: "", password: "", remember: false });
  };

  if (challenge !== null) {
    return (
      <AuthShell baselineScreen="login" titleId="login-mfa-title" title={t("auth.mfa.challengeTitle")}
        subtitle={t("auth.mfa.challengeSubtitle")} showBaselineHeading>
        <form onSubmit={onSubmitMfa} noValidate aria-busy={mfaVerify.isPending}>
          <Box sx={AUTH_UAT_FORM_SX} data-busy={mfaVerify.isPending ? "true" : "false"}>
            {feedback && <AuthLoginFeedback feedback={feedback} mfa />}
            <MfaOtpInput digits={mfaDigits} onChange={setMfaDigits}
              disabled={mfaVerify.isPending || unknown || unavailableAccount} label={t("auth.mfa.codeLabel")} />
            <Box component="details" sx={{ color: AUTH_BASELINE.muted, fontSize: { xs: 12, sm: 13 },
              "& summary": { cursor: "pointer", color: AUTH_BASELINE.link, fontWeight: 600 } }}>
              <Box component="summary">{t("auth.mfa.codeHelp")}</Box>
              <Box sx={{ marginTop: "10px" }}>
                <UiTextField fullWidth label={t("auth.mfa.recoveryTitle")} value={mfaRecoveryCode}
                  onChange={(event) => setMfaRecoveryCode(event.target.value)} autoComplete="off"
                  disabled={mfaVerify.isPending || unknown || unavailableAccount} />
              </Box>
            </Box>
            {unknown ? <Box sx={{ color: AUTH_BASELINE.muted, fontSize: 13 }}>{copy.unknownHelp}</Box>
              : unavailableAccount ? <UiButton type="button" fullWidth onClick={returnToLogin}>{copy.backToLogin}</UiButton>
              : <UiButton type="submit" fullWidth loading={mfaVerify.isPending}
                  disabled={mfaVerify.isPending || mfaVerify.isSuccess || !isMfaCodeReady || throttled || !online}>
                  {mfaVerify.isPending ? copy.submitting : t("auth.mfa.verifySubmit")}
                </UiButton>}
          </Box>
        </form>
      </AuthShell>
    );
  }

  const belowPassword = feedback?.kind === "invalid-credentials" || feedback?.kind === "invalid-input";
  const retry = feedback?.kind === "offline" || feedback?.kind === "service-unavailable";
  return (
    <AuthShell baselineScreen="login" titleId="login-title" title={t("auth.login.title")} subtitle={t("auth.login.subtitle")}>
      <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
        <Box sx={AUTH_UAT_FORM_SX} data-busy={isSubmitting ? "true" : "false"}>
          {feedback && !belowPassword && <AuthLoginFeedback feedback={feedback} />}
          <AuthField control={control} name="identifier" label={copy.identifierLabel} placeholder={copy.identifierPlaceholder}
            startIcon="user" autoFocus disabled={fieldsDisabled} />
          <AuthField control={control} name="password" label={t("auth.fields.password")} placeholder={t("auth.fields.passwordPlaceholder")}
            type="password" startIcon="lock" disabled={fieldsDisabled} />
          {feedback && belowPassword && <AuthLoginFeedback feedback={feedback} />}
          {!throttled && !unavailableAccount && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", fontSize: { xs: 14, sm: 15 } }}>
              {isSubmitting || unknown
                ? <Box component="span" aria-disabled="true" sx={{ color: AUTH_BASELINE.muted }}>{t("auth.login.forgotPassword")}</Box>
                : <Link to={ROUTES.FORGOT_PASSWORD}>{t("auth.login.forgotPassword")}</Link>}
            </Box>
          )}
          {unknown ? <Box sx={{ color: AUTH_BASELINE.muted, fontSize: 13, lineHeight: 1.45 }}>{copy.unknownHelp}</Box>
            : unavailableAccount ? <UiButton type="button" fullWidth onClick={returnToLogin}>{copy.backToLogin}</UiButton>
            : <UiButton type="submit" fullWidth loading={login.isPending} disabled={isSubmitting || throttled}
                sx={{ position: "relative", "& .hn-login-submit-arrow": { position: "absolute", right: { xs: 18, sm: 22 },
                  fontSize: { xs: 19, sm: 22 }, lineHeight: 1 }, "&.Mui-disabled .hn-login-submit-arrow": { opacity: 0.6 } }}>
                {isSubmitting ? copy.submitting : retry ? t("common.retry") : t("auth.login.submit")}
                {!isSubmitting && <i className={`${flatIconClass("arrow-right")} hn-login-submit-arrow`} aria-hidden />}
              </UiButton>}
          <AuthAccessNotice />
        </Box>
      </form>
    </AuthShell>
  );
}
