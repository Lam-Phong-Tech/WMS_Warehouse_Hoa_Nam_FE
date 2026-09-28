import { useRef, useState } from "react";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { User } from "@/shared/types/user";
import { Box, UiButton } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";
import { useAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";

export interface AuthSessionConfirmationProps {
  user: User;
  contexts: AuthContext[];
  onConfirm: () => void;
}
function initialsOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]).join("").toUpperCase() || "HN";
}

/** AUTH-02 uses the verified profile. It neither grants permissions nor issues a
 * second login. No fabricated warehouse ACTIVE badge or artificial loading delay. */
export function AuthSessionConfirmation({ user, contexts, onConfirm }: AuthSessionConfirmationProps) {
  const t = useT();
  const copy = useAuthUatCopy();
  const logout = useLogout();
  const starting = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const context = contexts[0] ?? null;
  const displayName = user.name || user.email;
  const scope = context?.warehouse_name ?? context?.org_unit_name ??
    context?.department_name ?? t("auth.session.systemScope");
  const handleConfirm = () => {
    if (starting.current || logout.isPending) return;
    starting.current = true;
    setIsStarting(true);
    onConfirm();
  };
  return (
    <AuthShell baselineScreen="session" titleId="auth-session-title" title={copy.sessionTitle}
      subtitle="" showBaselineHeading>
      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: "16px", sm: "18px" } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Box aria-hidden sx={{ width: 44, height: 44, flex: "0 0 auto", display: "grid",
            placeItems: "center", borderRadius: "50%", backgroundColor: AUTH_BASELINE.pale,
            color: AUTH_BASELINE.ink, fontSize: 16, fontWeight: 800 }}>{initialsOf(displayName)}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ color: AUTH_BASELINE.ink, fontSize: { xs: 15, sm: 17 }, fontWeight: 700,
              overflowWrap: "anywhere" }}>{displayName}</Box>
            <Box sx={{ color: AUTH_BASELINE.muted, fontSize: 13, marginTop: "3px" }}>
              {context?.role_name || t("auth.session.role")}
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "12px", border: `1px solid ${AUTH_BASELINE.line}`,
          borderRadius: "8px", padding: "13px 14px", color: AUTH_BASELINE.ink }}>
          <i className={flatIconClass("warehouse-alt")} aria-hidden style={{ fontSize: 22 }} />
          <Box sx={{ minWidth: 0, fontSize: { xs: 14, sm: 16 }, fontWeight: 700, overflowWrap: "anywhere" }}>{scope}</Box>
        </Box>
        <Box role="note" sx={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 14px",
          borderRadius: "8px", backgroundColor: AUTH_BASELINE.pale, color: AUTH_BASELINE.ink,
          fontSize: { xs: 13, sm: 14 }, lineHeight: 1.45 }}>
          <i className={flatIconClass("info")} aria-hidden />
          {copy.sessionHelp}
        </Box>
        <UiButton type="button" fullWidth loading={isStarting} disabled={isStarting || logout.isPending}
          onClick={handleConfirm}>
          {isStarting ? t("auth.session.starting") : copy.startWork}
        </UiButton>
        <UiButton type="button" appearance="text" fullWidth loading={logout.isPending}
          disabled={isStarting || logout.isPending} onClick={() => logout.mutate()}
          sx={{ color: AUTH_BASELINE.link, fontWeight: 700 }}
          startIcon={<i className={flatIconClass("sign-out-alt")} aria-hidden />}>
          {t("topbar.accountLogout")}
        </UiButton>
      </Box>
    </AuthShell>
  );
}
