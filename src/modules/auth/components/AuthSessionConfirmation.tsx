import { useRef, useState } from "react";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthSessionAccessNotice, AuthSessionProfile } from "./AuthSessionVisuals";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { User } from "@/shared/types/user";
import { Box, UiButton } from "@/shared/ui";
import { useAuthSessionCopy } from "@/modules/auth/utils/auth-session-copy";

export interface AuthSessionConfirmationProps {
  user: User;
  contexts: AuthContext[];
  onConfirm: () => void;
}

/** The profile and scope were verified for the current JWT before this card opens. */
export function AuthSessionConfirmation({ user, contexts, onConfirm }: AuthSessionConfirmationProps) {
  const copy = useAuthSessionCopy();
  const logout = useLogout();
  const starting = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const [confirmationFailed, setConfirmationFailed] = useState(false);
  const handleConfirm = () => {
    if (starting.current || logout.isPending) return;
    starting.current = true;
    setIsStarting(true);
    setConfirmationFailed(false);
    try {
      onConfirm();
    } catch {
      starting.current = false;
      setIsStarting(false);
      setConfirmationFailed(true);
    }
  };

  return (
    <AuthShell baselineScreen="session" titleId="auth-session-title" title={copy.title}
      subtitle={copy.readySubtitle} showBaselineHeading>
      <Box sx={{ display: "flex", flexDirection: "column",
        gap: { xs: "22px", sm: "48px", xl: "28px" } }}>
        <AuthSessionProfile user={user} context={contexts[0]} />
        {confirmationFailed && (
          <Box role="alert" sx={{ borderRadius: "10px", p: "16px 20px",
            color: "var(--auth-error-ink)", backgroundColor: "var(--auth-error-bg)" }}>
            <Box sx={{ fontSize: 19, fontWeight: 700 }}>{copy.confirmFailedTitle}</Box>
            <Box sx={{ mt: 0.5, color: "var(--auth-muted)" }}>{copy.confirmFailedBody}</Box>
          </Box>
        )}
        <UiButton type="button" fullWidth className={isStarting ? undefined : "hn-auth-primary-cta"}
          loading={isStarting} disabled={isStarting || logout.isPending} onClick={handleConfirm}>
          {isStarting ? copy.starting : confirmationFailed ? copy.retry : copy.start}
        </UiButton>
        <UiButton type="button" appearance="text" fullWidth loading={logout.isPending}
          disabled={isStarting || logout.isPending} onClick={() => logout.mutate()}
          sx={{ color: "var(--auth-link)", fontSize: { xs: 17, sm: 20 }, fontWeight: 600,
            textTransform: "none", minHeight: 34 }}>
          {copy.logout}
        </UiButton>
        <AuthSessionAccessNotice />
      </Box>
    </AuthShell>
  );
}
