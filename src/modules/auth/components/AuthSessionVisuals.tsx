import { Box } from "@/shared/ui";
import type { User } from "@/shared/types/user";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { useT } from "@/shared/i18n/useT";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import { useAuthSessionCopy } from "@/modules/auth/utils/auth-session-copy";

export type SessionBadge = "granted" | "unchecked" | "unconfirmed" | "paused" | "retry";

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]).join("").toUpperCase() || "HN";
}

function WarehouseIcon({ skeleton = false }: { skeleton?: boolean }) {
  return (
    <svg aria-hidden="true" width="52" height="52" viewBox="0 0 52 52" fill="none"
      style={{ flex: "0 0 52px", color: skeleton ? "#a2b4d2" : "#6580b2" }}>
      <path d="M4 23 26 6l22 17M9 20v26h34V20M18 46V29h16v17M21 34h10M21 40h10"
        stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AuthSessionProfile({ user, context, badge = "granted", skeleton = false }: {
  user?: User | null;
  context?: AuthContext | null;
  badge?: SessionBadge;
  skeleton?: boolean;
}) {
  const t = useT();
  const copy = useAuthSessionCopy();
  const dark = useThemeStore((state) => state.mode === "dark");
  const name = user?.name || user?.email || "";
  const scope = context?.warehouse_name ?? context?.org_unit_name ??
    context?.department_name ?? t("auth.session.systemScope");
  const badgeLabel = {
    granted: copy.granted,
    unchecked: copy.unchecked,
    unconfirmed: copy.unconfirmed,
    paused: copy.pausedBadge,
    retry: copy.needsRetry,
  }[badge];
  const badgeColor = badge === "granted"
    ? { bg: dark ? "#164536" : "#def8e9", ink: dark ? "#a5f1c4" : "#078f4c" }
    : badge === "paused"
      ? { bg: dark ? "#51402d" : "#fff0d4", ink: dark ? "#ffd6a0" : "#d86a00" }
      : { bg: dark ? "#293d5d" : "#edf2f8", ink: dark ? "#b8c9e6" : "#536a98" };

  return (
    <Box data-auth-session-profile sx={{ marginTop: { xs: "8px", sm: "2px", xl: 0 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: "16px", sm: "24px" }, minHeight: 80 }}>
        <Box aria-hidden sx={{ width: 80, height: 80, flex: "0 0 80px", borderRadius: "50%",
          display: "grid", placeItems: "center", backgroundColor: dark ? "#25446d" : "#e2efff",
          color: dark ? "#b9d5ff" : "#0069f5", fontSize: 28, fontWeight: 700 }}>
          {!skeleton && initialsOf(name)}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {skeleton ? <>
            <Box aria-hidden sx={{ width: "68%", maxWidth: 268, height: 28, borderRadius: 1,
              backgroundColor: dark ? "#385575" : "#d9e3f1" }} />
            <Box aria-hidden sx={{ width: "50%", maxWidth: 202, height: 22, borderRadius: 1,
              mt: 1.5, backgroundColor: dark ? "#385575" : "#d9e3f1" }} />
          </> : <>
            <Box sx={{ color: "var(--auth-ink)", fontSize: { xs: 20, sm: 23 }, fontWeight: 700,
              overflowWrap: "anywhere" }}>{name}</Box>
            <Box sx={{ color: "var(--auth-muted)", fontSize: { xs: 16, sm: 19 }, mt: 0.5 }}>
              {context?.role_name || t("auth.session.role")}
            </Box>
          </>}
        </Box>
      </Box>
      <Box sx={{ height: "1px", backgroundColor: "var(--auth-line)",
        my: { xs: "24px", sm: "40px", xl: "26px" } }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: "16px", sm: "24px" }, minHeight: 66 }}>
        <WarehouseIcon skeleton={skeleton} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {skeleton ? <>
            <Box aria-hidden sx={{ width: 205, maxWidth: "85%", height: 24, borderRadius: 1,
              backgroundColor: dark ? "#385575" : "#d9e3f1" }} />
            <Box aria-hidden sx={{ width: 160, maxWidth: "70%", height: 22, borderRadius: 1,
              mt: 1, backgroundColor: dark ? "#385575" : "#d9e3f1" }} />
          </> : <>
            <Box sx={{ color: "var(--auth-muted)", fontSize: { xs: 16, sm: 19 } }}>{copy.warehouse}</Box>
            <Box sx={{ color: "var(--auth-ink)", fontSize: { xs: 19, sm: 22 }, fontWeight: 700,
              overflowWrap: "anywhere" }}>{scope}</Box>
          </>}
        </Box>
        {skeleton ? <Box aria-hidden sx={{ display: { xl: "none" }, width: 140, height: 40, borderRadius: 20,
          backgroundColor: dark ? "#385575" : "#d9e3f1" }} /> : (
          <Box sx={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "10px",
            px: 2, py: 1, borderRadius: 10, backgroundColor: badgeColor.bg,
            color: badgeColor.ink, fontSize: { xs: 13, sm: 15 }, fontWeight: 600 }}>
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "currentColor" }} />
            {badgeLabel}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function AuthSessionAccessNotice() {
  const t = useT();
  return (
    <Box role="note" sx={{ display: "flex", alignItems: "center", gap: "18px", p: "18px 20px",
      borderRadius: "10px", backgroundColor: "var(--auth-note)", color: "var(--auth-ink)" }}>
      <svg aria-hidden="true" width="34" height="36" viewBox="0 0 34 36" fill="none"
        style={{ flex: "0 0 34px", color: "#0069f5" }}>
        <path d="M17 2 30 8v10c0 8-5 13-13 16C9 31 4 26 4 18V8L17 2Z"
          stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="m11 18 4 4 8-9" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Box sx={{ minWidth: 0, fontSize: { xs: 15, sm: 17 }, lineHeight: 1.45 }}>
        <Box sx={{ fontWeight: 700 }}>{t("auth.login.accessNoticeTitle")}</Box>
        <Box sx={{ color: "var(--auth-muted)", display: { xs: "none", xl: "block" } }}>
          {t("auth.login.accessNoticeBody")}
        </Box>
      </Box>
    </Box>
  );
}
