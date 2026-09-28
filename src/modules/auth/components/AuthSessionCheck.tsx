import { AuthShell } from "./AuthShell";
import { AuthLoginFeedback } from "./AuthLoginFeedback";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { Box, UiButton } from "@/shared/ui";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";

/** Only the initial authenticated profile read uses this card. A retry reads
 * /me; it never replays a password/MFA request or exposes protected page content. */
export function AuthSessionCheck({ failed = false, denied = false, onRetry }: { failed?: boolean; denied?: boolean; onRetry: () => void }) {
  const copy = useAuthUatCopy();
  const t = useT();
  const logout = useLogout();
  return (
    <AuthShell baselineScreen="session" titleId="session-check-title" title={copy.sessionTitle}
      subtitle="" showBaselineHeading>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {failed ? denied ? <Box role="alert" aria-live="polite" sx={{ borderRadius: "8px", padding: "14px",
          color: "#A33348", backgroundColor: "#FFF1F3" }}>{copy.sessionDenied}</Box>
          : <AuthLoginFeedback feedback={{ kind: "unknown" }} /> : <>
          <Box aria-hidden sx={{ height: 20, borderRadius: "5px", backgroundColor: AUTH_BASELINE.line }} />
          <Box aria-hidden sx={{ height: 20, borderRadius: "5px", backgroundColor: AUTH_BASELINE.line }} />
          <Box role="status" aria-live="polite" sx={{ borderRadius: "8px", padding: "14px",
            backgroundColor: AUTH_BASELINE.pale, color: AUTH_BASELINE.ink, fontSize: 14 }}>{copy.sessionChecking}</Box>
        </>}
        <UiButton type="button" fullWidth loading={!failed || logout.isPending} disabled={!failed || logout.isPending}
          onClick={denied ? () => logout.mutate() : onRetry}>
          {failed ? denied ? copy.otherAccount : copy.checkAgain : copy.sessionChecking}
        </UiButton>
        {failed && !denied && <UiButton type="button" fullWidth appearance="text" loading={logout.isPending}
          disabled={logout.isPending} onClick={() => logout.mutate()}>{t("topbar.accountLogout")}</UiButton>}
      </Box>
    </AuthShell>
  );
}
