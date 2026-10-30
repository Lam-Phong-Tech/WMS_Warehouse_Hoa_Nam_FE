import { Box } from "@/shared/ui";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import type { LoginFeedback } from "@/modules/auth/utils/login-feedback";

export function AuthLoginFeedback({ feedback, mfa = false }: { feedback: LoginFeedback; mfa?: boolean }) {
  const copy = useAuthUatCopy();
  const kind = feedback.kind;
  let title: string;
  let body = "";
  let tone: "error" | "warning" | "info" = "error";
  switch (kind) {
    case "invalid-credentials": title = mfa ? copy.mfaInvalid : copy.invalidCredentials; break;
    case "invalid-input": title = mfa ? copy.mfaInvalid : copy.invalidInput; break;
    case "offline": title = copy.offlineTitle; body = copy.offlineBody; tone = "warning"; break;
    case "unknown": title = copy.unknownTitle; body = copy.unknownBody; tone = "info"; break;
    case "rate-limited":
      title = copy.rateTitle;
      body = feedback.retryAt == null ? copy.rateWithoutDeadline : copy.rateBody;
      tone = "warning";
      break;
    case "account-unavailable": title = copy.accountTitle; body = copy.accountBody; break;
    default: title = copy.unavailableTitle; body = copy.unavailableBody;
  }
  const palette = {
    error: { color: "#A33348", backgroundColor: "#FFF1F3" },
    warning: { color: "#886112", backgroundColor: "#FFF8E8" },
    info: { color: AUTH_BASELINE.ink, backgroundColor: "#ECF7FD" },
  }[tone];
  return (
    <Box role="alert" aria-live="polite" aria-atomic="true" data-login-feedback={kind}
      sx={{ display: "flex", alignItems: "flex-start", gap: "10px", borderRadius: "9px", padding: "13px 15px", ...palette }}>
      <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 20 20"
        fill="none" style={{ flex: "0 0 18px", marginTop: 1 }}>
        <circle cx="10" cy="10" r="7.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 9v5M10 6v.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <Box sx={{ minWidth: 0, fontSize: { xs: 13, sm: 14 }, lineHeight: 1.45 }}>
        <Box sx={{ fontWeight: 700 }}>{title}</Box>
        {body && <Box sx={{ marginTop: "3px", fontSize: { xs: 12, sm: 13 } }}>{body}</Box>}
      </Box>
    </Box>
  );
}

export function AuthAccessNotice() {
  const t = useT();
  return (
    <Box role="note" sx={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px",
      borderRadius: "12px", backgroundColor: "#ECF7FD", color: AUTH_BASELINE.ink }}>
      <svg data-testid="auth-access-shield" aria-hidden="true" focusable="false" width="27" height="30"
        viewBox="0 0 28 32" style={{ flex: "0 0 27px" }}>
        <path d="M14 3C10 6 6.5 7 4.5 7.5V17c0 5.5 4 9 9.5 12 5.5-3 9.5-6.5 9.5-12V7.5C21.5 7 18 6 14 3Z"
          fill="#9DDDF2" stroke="#078CCA" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m9.5 15.8 3.2 3.1 6-6.5" fill="none" stroke="#078CCA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Box sx={{ fontSize: { xs: 13, sm: 14 }, lineHeight: 1.4 }}>
        <Box sx={{ fontWeight: 700 }}>{t("auth.login.accessNoticeTitle")}</Box>
        <Box sx={{ color: AUTH_BASELINE.muted }}>{t("auth.login.accessNoticeBody")}</Box>
      </Box>
    </Box>
  );
}
