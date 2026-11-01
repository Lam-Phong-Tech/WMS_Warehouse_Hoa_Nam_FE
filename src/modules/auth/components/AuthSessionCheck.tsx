import { AuthShell } from "./AuthShell";
import { AuthSessionAccessNotice, AuthSessionProfile, type SessionBadge } from "./AuthSessionVisuals";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import { useAuthSessionCopy } from "@/modules/auth/utils/auth-session-copy";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { User } from "@/shared/types/user";
import { Box, UiButton } from "@/shared/ui";

export type SessionCheckMode = "checking" | "load-error" | "offline" | "unknown" |
  "denied" | "paused" | "unavailable" | "expired" | "confirm-failed";

interface AuthSessionCheckProps {
  mode?: SessionCheckMode;
  onRetry: () => void;
  user?: User | null;
  contexts?: AuthContext[];
}

function StateIcon({ type }: { type: "clock" | "shield" | "lock" }) {
  const paths = {
    clock: <><circle cx="40" cy="40" r="32" /><path d="M40 19v23l15 13" /></>,
    shield: <><path d="M40 5 67 18v21c0 19-10 30-27 38C23 69 13 58 13 39V18L40 5Z" />
      <rect x="31" y="36" width="18" height="17" rx="2" /><path d="M34 36v-7a6 6 0 0 1 12 0v7" /></>,
    lock: <><rect x="18" y="34" width="44" height="36" rx="5" /><path d="M25 34V24a15 15 0 0 1 30 0v10" />
      <circle cx="40" cy="49" r="2" /><path d="M40 51v7" /></>,
  };
  return <svg aria-hidden="true" width="112" height="112" viewBox="0 0 80 80" fill="none"
    style={{ color: type === "shield" ? "#0069f5" : "#6881b4" }}>
    <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</g>
  </svg>;
}

function SessionAlert({ title, body, tone = "warning" }: {
  title: string;
  body: string;
  tone?: "warning" | "error";
}) {
  return (
    <Box role="alert" sx={{ display: "flex", alignItems: "center", gap: "18px", p: "20px 24px",
      borderRadius: "10px", backgroundColor: tone === "error"
        ? "var(--auth-alert-error-bg)" : "var(--auth-alert-warning-bg)",
      color: tone === "error" ? "var(--auth-alert-error-ink)" : "var(--auth-alert-warning-ink)" }}>
      <Box aria-hidden sx={{ width: 42, height: 42, flex: "0 0 42px", display: "grid", placeItems: "center",
        border: "3px solid currentColor", borderRadius: "50%", fontSize: 28, fontWeight: 700,
        lineHeight: 1 }}>!</Box>
      <Box sx={{ minWidth: 0, lineHeight: 1.4 }}>
        <Box sx={{ fontWeight: 700, fontSize: { xs: 17, sm: 22 } }}>{title}</Box>
        <Box sx={{ mt: 0.5, fontSize: { xs: 15, sm: 18 } }}>{body}</Box>
      </Box>
    </Box>
  );
}

/** Session status uses only verified profile data or actual request failures. */
export function AuthSessionCheck({ mode = "checking", onRetry, user, contexts = [] }: AuthSessionCheckProps) {
  const copy = useAuthSessionCopy();
  const logout = useLogout();
  const isCentered = mode === "denied" || mode === "unavailable" || mode === "expired";
  const subtitle = mode === "checking" ? copy.checkingSubtitle : isCentered ? "" : copy.readySubtitle;
  const hasProfile = Boolean(user) && mode !== "load-error" && !isCentered;
  const context = contexts[0] ?? null;
  const badge: SessionBadge = mode === "offline" ? "unchecked"
    : mode === "paused" ? "paused"
      : mode === "confirm-failed" ? "retry" : "unconfirmed";

  let alert: { title: string; body: string; tone?: "warning" | "error" } | null = null;
  let primary = copy.retry;
  let primaryAction = onRetry;
  let secondary: string | null = copy.logout;

  switch (mode) {
    case "offline":
      alert = { title: copy.offlineTitle, body: copy.offlineBody };
      primary = copy.checkConnection;
      secondary = copy.backToLogin;
      break;
    case "unknown":
      alert = { title: copy.unknownTitle, body: copy.unknownBody };
      primary = copy.checkStatus;
      break;
    case "paused":
      alert = { title: copy.pausedTitle, body: copy.pausedBody };
      primary = copy.recheck;
      break;
    case "confirm-failed":
      alert = { title: copy.confirmFailedTitle, body: copy.confirmFailedBody, tone: "error" };
      break;
    case "denied":
      primary = copy.otherAccount;
      primaryAction = () => logout.mutate();
      secondary = null;
      break;
    case "unavailable":
      primary = copy.backToLogin;
      primaryAction = () => logout.mutate();
      secondary = null;
      break;
    case "expired":
      primary = copy.signInAgain;
      primaryAction = () => logout.mutate();
      secondary = null;
      break;
    case "load-error":
      alert = { title: copy.loadErrorTitle, body: copy.loadErrorBody };
      break;
    default:
      break;
  }

  const centeredTitle = mode === "denied" ? copy.deniedTitle
    : mode === "unavailable" ? copy.unavailableTitle : copy.expiredTitle;
  const centeredBody = mode === "denied" ? copy.deniedBody
    : mode === "unavailable" ? copy.unavailableBody : copy.expiredBody;

  return (
    <AuthShell baselineScreen="session" titleId="session-check-title" title={copy.title}
      subtitle={subtitle} showBaselineHeading>
      <Box sx={{ display: "flex", flexDirection: "column",
        gap: { xs: "22px", sm: "46px", xl: "26px" } }}>
        {isCentered ? (
          <Box sx={{ display: "grid", justifyItems: "center", textAlign: "center", gap: "20px", py: 2 }}>
            <StateIcon type={mode === "expired" ? "clock" : mode === "denied" ? "shield" : "lock"} />
            <Box sx={{ color: "var(--auth-ink)", fontSize: { xs: 24, sm: 31 }, lineHeight: 1.25,
              fontWeight: 800 }}>{centeredTitle}</Box>
            <Box sx={{ color: "var(--auth-muted)", fontSize: { xs: 16, sm: 20 }, lineHeight: 1.45 }}>
              {centeredBody}
            </Box>
          </Box>
        ) : mode === "checking" ? <>
          <AuthSessionProfile skeleton />
          <Box role="status" aria-live="polite" sx={{ display: "flex", alignItems: "center",
            justifyContent: { sm: "center", xl: "flex-start" },
            flexDirection: { sm: "column", xl: "row" }, gap: "20px",
            color: "var(--auth-ink)", fontSize: { xs: 17, sm: 20 }, fontWeight: 600 }}>
            <Box role="progressbar" aria-label={copy.checking} sx={{ width: 48, height: 48,
              flex: "0 0 48px", border: "4px solid #b6d7ff", borderTopColor: "#0069f5",
              borderRadius: "50%", animation: "hn-spin 900ms linear infinite" }} />
            {copy.checking}
          </Box>
        </> : <>
          {mode === "unknown" && alert && <SessionAlert {...alert} />}
          {hasProfile && <AuthSessionProfile user={user} context={context} badge={badge} />}
          {alert && mode !== "unknown" && <SessionAlert {...alert} />}
        </>}

        <UiButton type="button" fullWidth className={mode === "checking" ? undefined : "hn-auth-primary-cta"}
          disabled={mode === "checking" || logout.isPending} onClick={primaryAction}>
          {mode === "checking" ? copy.start : primary}
        </UiButton>
        {secondary && mode !== "checking" && (
          <UiButton type="button" fullWidth appearance="text" loading={logout.isPending}
            disabled={logout.isPending} onClick={() => logout.mutate()}
            sx={{ color: "var(--auth-link)", fontSize: { xs: 17, sm: 20 }, fontWeight: 600,
              textTransform: "none", minHeight: mode === "offline" ? 62 : 34,
              backgroundColor: mode === "offline" ? "var(--auth-note)" : "transparent",
              borderRadius: mode === "offline" ? "9px" : 0 }}>
            {secondary}
          </UiButton>
        )}
        {mode === "checking" && <AuthSessionAccessNotice />}
      </Box>
    </AuthShell>
  );
}
