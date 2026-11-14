import { getDisplayTimezone } from "@/shared/utils/date-time";
import { Box } from "@/shared/ui";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import type { LoginFeedback } from "@/modules/auth/utils/login-feedback";
import type { SessionReplacementNotice } from "@/modules/auth/utils/session-replacement-notice";
import { localizeReplacementDeviceLabel } from "@/modules/auth/utils/session-replacement-notice";
import { useLanguageStore } from "@/shared/i18n/language.store";

export function AuthSessionReplacementNotice({ notice, onDismiss }: {
  notice: SessionReplacementNotice;
  onDismiss: () => void;
}) {
  const language = useLanguageStore((state) => state.language);
  const copy = {
    vi: { title: "Tài khoản vừa được đăng nhập trên thiết bị khác", prefix: "Phiên làm việc trên thiết bị này đã bị đăng xuất.", device: "Thiết bị đăng nhập mới", time: "Lúc", advice: "Nếu không phải bạn thực hiện, vui lòng đổi mật khẩu ngay.", close: "Đóng" },
    en: { title: "Your account was signed in on another device", prefix: "This device has been signed out.", device: "New sign-in device", time: "At", advice: "If this was not you, change your password immediately.", close: "Close" },
    zh: { title: "您的账户已在另一台设备上登录", prefix: "此设备已退出登录。", device: "新登录设备", time: "时间", advice: "如果不是您本人操作，请立即更改密码。", close: "关闭" },
  }[language];
  const signedInAt = notice.signed_in_at
    ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : language === "zh" ? "zh-CN" : "en-US", {
      dateStyle: "short", timeStyle: "short", timeZone: getDisplayTimezone(),
    }).format(new Date(notice.signed_in_at))
    : null;

  return (
    <Box role="alert" aria-live="assertive" aria-atomic="true" sx={{
      display: "flex", alignItems: "flex-start", gap: "12px", border: "1px solid",
      borderColor: "var(--auth-alert-warning-border, #ffe0a9)", borderRadius: "9px",
      backgroundColor: "var(--auth-alert-warning-bg, #fff0d9)", color: "var(--auth-alert-warning-ink, #a55000)",
      padding: "17px 20px", fontSize: { xs: 13, sm: 14 }, lineHeight: 1.45,
    }}>
      <Box aria-hidden="true" sx={{ fontWeight: 800 }}>!</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontWeight: 700 }}>{copy.title}</Box>
        <Box sx={{ marginTop: "3px" }}>{copy.prefix}</Box>
        {notice.device_label && <Box>{copy.device}: {localizeReplacementDeviceLabel(notice.device_label, language)}{notice.ip_hint ? ` (IP ${notice.ip_hint})` : ""}</Box>}
        {signedInAt && <Box>{copy.time}: {signedInAt}</Box>}
        <Box sx={{ marginTop: "3px" }}>{copy.advice}</Box>
      </Box>
      <Box component="button" type="button" onClick={onDismiss} aria-label={copy.close} sx={{
        border: 0, background: "transparent", color: "inherit", cursor: "pointer", fontSize: 20, lineHeight: 1,
      }}>×</Box>
    </Box>
  );
}

export function AuthLoginFeedback({ feedback, mfa = false }: { feedback: LoginFeedback; mfa?: boolean }) {
  const t = useT();
  const copy = useAuthUatCopy();
  const kind = feedback.kind;
  let title: string;
  let body = "";
  let tone: "error" | "warning" | "info" = "error";
  switch (kind) {
    case "invalid-credentials": title = mfa ? copy.mfaInvalid : copy.invalidTitle; body = mfa ? "" : copy.invalidCredentials; break;
    case "invalid-input": title = mfa ? copy.mfaInvalid : copy.invalidInput; break;
    case "offline": title = copy.offlineTitle; body = copy.offlineBody; tone = "warning"; break;
    case "unknown": title = copy.unknownTitle; body = copy.unknownBody; tone = "info"; break;
    case "rate-limited":
      title = copy.rateTitle;
      body = feedback.retryAt == null ? copy.rateWithoutDeadline : copy.rateBody;
      tone = "warning";
      break;
    case "account-unavailable": title = copy.accountTitle; body = copy.accountBody; break;
    case "step-up-required":
      title = t("auth.login.stepUpTitle");
      body = t("auth.login.stepUpEmailSubtitle", { email: "" }).trim();
      tone = "info";
      break;
    case "device-verification-required":
      title = t("auth.login.deviceTitle");
      body = t("auth.login.deviceSubtitle", { email: "" }).trim();
      tone = "info";
      break;
    case "pow-required":
      title = t("auth.login.powSolving");
      tone = "info";
      break;
    default: title = copy.unavailableTitle; body = copy.unavailableBody;
  }
  const palette = {
    error: { color: "var(--auth-alert-error-ink, #b0121f)", backgroundColor: "var(--auth-alert-error-bg, #fff0f1)", borderColor: "var(--auth-alert-error-border, #ffc0c5)" },
    warning: { color: "var(--auth-alert-warning-ink, #a55000)", backgroundColor: "var(--auth-alert-warning-bg, #fff0d9)", borderColor: "var(--auth-alert-warning-border, #ffe0a9)" },
    info: { color: `var(--auth-ink, ${AUTH_BASELINE.ink})`, backgroundColor: "var(--auth-note, #ECF7FD)", borderColor: "var(--auth-border, #c9dfff)" },
  }[tone];
  return (
    <Box role="alert" aria-live="polite" aria-atomic="true" data-login-feedback={kind}
      sx={{ display: "flex", alignItems: "flex-start", gap: "14px", border: "1px solid", borderRadius: "9px", padding: "17px 20px", ...palette }}>
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
    <Box role="note" sx={{ display: "flex", alignItems: "center", gap: "16px", padding: { xs: "20px 22px", sm: "26px 28px", xl: "20px 22px" },
      borderRadius: "9px", backgroundColor: "var(--auth-note, #ebf6ff)", color: "var(--auth-ink, #071c57)" }}>
      <svg data-testid="auth-access-shield" aria-hidden="true" focusable="false" width="27" height="30"
        viewBox="0 0 28 32" style={{ flex: "0 0 27px" }}>
        <path d="M14 3C10 6 6.5 7 4.5 7.5V17c0 5.5 4 9 9.5 12 5.5-3 9.5-6.5 9.5-12V7.5C21.5 7 18 6 14 3Z"
          fill="#9DDDF2" stroke="#078CCA" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m9.5 15.8 3.2 3.1 6-6.5" fill="none" stroke="#078CCA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Box sx={{ fontSize: { xs: 14, sm: 20, xl: 16 }, lineHeight: 1.4 }}>
        <Box sx={{ fontWeight: 700 }}>{t("auth.login.accessNoticeTitle")}</Box>
        <Box sx={{ color: `var(--auth-muted, ${AUTH_BASELINE.muted})` }}>{t("auth.login.accessNoticeBody")}</Box>
      </Box>
    </Box>
  );
}
