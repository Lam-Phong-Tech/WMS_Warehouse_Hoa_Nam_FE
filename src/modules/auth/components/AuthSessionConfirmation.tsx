import { useEffect, useMemo, useState } from "react";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import type { AuthenticatedLogin } from "@/modules/auth/types/auth.types";
import { Box, UiAlert, UiButton } from "@/shared/ui";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";

export interface AuthSessionConfirmationProps {
  login: AuthenticatedLogin;
  authenticatedAt: number;
  starting: boolean;
  onConfirm: () => void;
  onExpired: () => void;
}

/**
 * AUTH-02 của SystemHNWeb.
 *
 * Không tạo API "bắt đầu ca": CTA chỉ tiếp tục callback afterLogin hiện hành.
 * Hết hạn dựa trực tiếp vào expires_in do BE trả về.
 */
export function AuthSessionConfirmation({
  login,
  authenticatedAt,
  starting,
  onConfirm,
  onExpired,
}: AuthSessionConfirmationProps) {
  const t = useT();
  const expiresAt = useMemo(
    () => authenticatedAt + Math.max(0, login.expires_in) * 1000,
    [authenticatedAt, login.expires_in],
  );
  const [expired, setExpired] = useState(() => Date.now() >= expiresAt);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setExpired(true),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [expiresAt]);

  const context = login.available_contexts[0] ?? null;
  const scope =
    context?.warehouse_name ??
    context?.org_unit_name ??
    context?.department_name ??
    t("auth.session.systemScope");

  return (
    <AuthShell
      baselineScreen="session"
      titleId="auth-session-title"
      title={t("auth.session.title")}
      subtitle={
        expired ? t("auth.session.expiredSubtitle") : t("auth.session.subtitle")
      }
    >
      {expired ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <UiAlert tone="warning" title={t("auth.session.expiredTitle")}>
            {t("auth.session.expiredDescription")}
          </UiAlert>
          <UiButton fullWidth onClick={onExpired}>
            {t("auth.session.signInAgain")}
          </UiButton>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <Box
            sx={{
              overflow: "hidden",
              border: `1px solid ${AUTH_BASELINE.line}`,
              borderRadius: "12px",
              backgroundColor: AUTH_BASELINE.surface,
            }}
          >
            {[
              [t("auth.session.account"), login.user.name || login.user.email],
              [t("auth.session.role"), context?.role_name || "—"],
              [t("auth.session.scope"), scope],
            ].map(([label, value], index) => (
              <Box
                key={label}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" },
                  gap: { xs: "4px", sm: "18px" },
                  padding: "14px 16px",
                  borderTop:
                    index === 0 ? "none" : `1px solid ${AUTH_BASELINE.line}`,
                }}
              >
                <Box sx={{ color: AUTH_BASELINE.muted, fontSize: 13, fontWeight: 600 }}>
                  {label}
                </Box>
                <Box
                  sx={{
                    minWidth: 0,
                    color: AUTH_BASELINE.ink,
                    fontSize: 14,
                    fontWeight: 700,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </Box>
              </Box>
            ))}
          </Box>

          <UiButton
            type="button"
            fullWidth
            loading={starting}
            disabled={starting}
            onClick={onConfirm}
          >
            {starting ? t("auth.session.starting") : t("auth.session.confirm")}
          </UiButton>
        </Box>
      )}
    </AuthShell>
  );
}
