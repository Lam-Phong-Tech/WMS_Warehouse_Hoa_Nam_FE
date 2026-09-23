import { useState } from "react";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { User } from "@/shared/types/user";
import { Box, UiButton } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";
import { tStatic as tUi } from "@/shared/i18n/useT";

export interface AuthSessionConfirmationProps {
  user: User;
  contexts: AuthContext[];
  onConfirm: () => void;
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "HN"
  );
}

/** AUTH-02: the idle gate resumes the existing session; it does not create a
 * second work-session API. Logout always uses the established cache-clearing flow. */
export function AuthSessionConfirmation({
  user,
  contexts,
  onConfirm,
}: AuthSessionConfirmationProps) {
  const t = useT();
  const logout = useLogout();
  const [isStarting, setIsStarting] = useState(false);
  const context = contexts[0] ?? null;
  const displayName = user.name || user.email;
  const scope =
    context?.warehouse_name ??
    context?.org_unit_name ??
    context?.department_name ??
    t("auth.session.systemScope");

  const handleConfirm = () => {
    if (isStarting) return;
    setIsStarting(true);
    window.setTimeout(onConfirm, 160);
  };

  return (
    <AuthShell
      baselineScreen="session"
      titleId="auth-session-title"
      title={t("auth.session.title")}
      subtitle={t("auth.session.subtitle")}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: "18px", sm: "20px" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: "14px", sm: "20px" },
            paddingBottom: { xs: "18px", sm: "20px" },
            borderBottom: `1px solid ${AUTH_BASELINE.line}`,
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: { xs: 58, sm: 72 },
              height: { xs: 58, sm: 72 },
              flex: "0 0 auto",
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0E9AB5, #006792)",
              color: AUTH_BASELINE.white,
              fontSize: { xs: 22, sm: 28 },
              fontWeight: 800,
            }}
          >
            {initialsOf(displayName)}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: AUTH_BASELINE.ink,
                fontSize: { xs: 23, sm: 29 },
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              {displayName}
            </Box>
            <Box
              sx={{
                marginTop: "4px",
                color: AUTH_BASELINE.muted,
                fontSize: { xs: 14, sm: 17 },
              }}
            >
              {context?.role_name || t("auth.session.role")}
            </Box>
          </Box>
          <i
            className={flatIconClass("angle-small-right")}
            aria-hidden
            style={{ color: AUTH_BASELINE.ink, fontSize: 22 }}
          />
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: "12px", sm: "16px" },
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: { xs: 46, sm: 56 },
              height: { xs: 46, sm: 56 },
              display: "grid",
              placeItems: "center",
              borderRadius: "10px",
              backgroundColor: AUTH_BASELINE.pale,
              color: AUTH_BASELINE.link,
              fontSize: { xs: 23, sm: 28 },
            }}
          >
            <i className={flatIconClass("warehouse-alt")} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: AUTH_BASELINE.ink,
                fontSize: { xs: 16, sm: 19 },
                fontWeight: 800,
              }}
            >
              {scope}
            </Box>
            <Box
              sx={{
                marginTop: "2px",
                color: AUTH_BASELINE.muted,
                fontSize: { xs: 13, sm: 16 },
              }}
            >
              {tUi("updatedUi.text_48274e1d4946")}
            </Box>
          </Box>
          <Box
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              alignItems: "center",
              gap: "7px",
              padding: "7px 12px",
              borderRadius: 99,
              backgroundColor: "#DDF7E8",
              color: AUTH_BASELINE.success,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              "&::before": {
                content: '""',
                width: 9,
                height: 9,
                borderRadius: "50%",
                backgroundColor: "#1FBB68",
              },
            }}
          >
            {tUi("dashboard.snapshot.warehouseActive")}
          </Box>
        </Box>

        <Box
          role="note"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: "10px", sm: "14px" },
            padding: { xs: "14px", sm: "18px" },
            borderRadius: "12px",
            backgroundColor: AUTH_BASELINE.pale,
            color: AUTH_BASELINE.muted,
            fontSize: { xs: 14, sm: 16 },
            lineHeight: 1.45,
          }}
        >
          <i
            className={flatIconClass("info")}
            aria-hidden
            style={{ color: "#008CFF", fontSize: 27, flex: "0 0 auto" }}
          />
          {tUi("updatedUi.text_7482cf731e9d")}
        </Box>

        <UiButton
          type="button"
          fullWidth
          loading={isStarting}
          disabled={isStarting || logout.isPending}
          onClick={handleConfirm}
          sx={{
            position: "relative",
            "& .hn-session-arrow": {
              position: "absolute",
              right: { xs: 18, sm: 26 },
              fontSize: { xs: 20, sm: 24 },
            },
          }}
        >
          {isStarting
            ? t("auth.session.starting")
            : tUi("updatedUi.text_16504c2c989f")}
          <i
            className={`${flatIconClass("angle-small-right")} hn-session-arrow`}
            aria-hidden
          />
        </UiButton>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            color: AUTH_BASELINE.muted,
            fontSize: { xs: 13, sm: 15 },
            "&::before, &::after": {
              content: '""',
              flex: 1,
              height: "1px",
              backgroundColor: AUTH_BASELINE.line,
            },
          }}
        >
          {tUi("updatedUi.text_30432b996137")}
        </Box>

        <UiButton
          type="button"
          appearance="outlined"
          fullWidth
          loading={logout.isPending}
          disabled={isStarting || logout.isPending}
          onClick={() => logout.mutate()}
          sx={{
            minHeight: { xs: 56, sm: 66 },
            borderColor: AUTH_BASELINE.line,
            borderRadius: "10px",
            color: AUTH_BASELINE.ink,
            fontSize: { xs: 17, sm: 20 },
            fontWeight: 700,
            "&:hover": {
              borderColor: AUTH_BASELINE.link,
              backgroundColor: AUTH_BASELINE.pale,
            },
          }}
          startIcon={
            <i className={flatIconClass("sign-out-alt")} aria-hidden />
          }
        >
          {tUi("topbar.accountLogout")}
        </UiButton>
      </Box>
    </AuthShell>
  );
}
