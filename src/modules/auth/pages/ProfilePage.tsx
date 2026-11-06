import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  UiConfirmDialog,
  UiIcon,
  UiPagination,
  UiStatusBadge,
  UiTabs,
} from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useAuthStore } from "@/shared/store/auth.store";
import { useT } from "@/shared/i18n/useT";
import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { formatDateTime } from "@/shared/utils/format-date";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { profileService } from "../services/profile.service";
import { authService } from "../services/auth.service";
import {
  profileKeys,
  type ProfilePreferenceChanges,
} from "../types/profile.types";
import type { MeResponse } from "../types/me.types";
import { MFA_STATUS_QUERY_KEY } from "../types/mfa.types";
import { useProfileAvatarUrl } from "../hooks/use-profile-avatar-url";
import { captureAuthOwner } from "@/shared/store/auth-owner";
import { ProfileEditorDrawer } from "../components/profile/ProfileEditorDrawer";
import { ProfilePasswordDrawer } from "../components/profile/ProfilePasswordDrawer";
import { ProfilePreferencesPanel } from "../components/profile/ProfilePreferencesPanel";
import { ProfileSessionsPanel } from "../components/profile/ProfileSessionsPanel";
import { MfaSettingsDrawer } from "../components/MfaSettingsDrawer";
import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import { auditActionLabel } from "@/modules/audit-logs/constants/audit-log-labels";
import "@/shared/ui/sku-aligned-settings.css";
import "./profile-page.css";

type Section =
  "profile" | "security" | "notifications" | "appearance" | "other";
const sections: Section[] = [
  "profile",
  "security",
  "notifications",
  "appearance",
  "other",
];

export function ProfilePage() {
  const t = useT();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const authEpoch = useAuthStore((state) => state.authEpoch);
  const stored = useAuthStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);
  const setProfile = useAuthStore((state) => state.setProfile);
  const permissions = useAuthStore((state) => state.permissionCodes);
  const superAdmin = useAuthStore((state) => state.isSuperAdmin);
  const section: Section = sections.includes(params.get("section") as Section)
    ? (params.get("section") as Section)
    : "profile";
  const accountMode =
    params.get("view") === "preferences" ? "preferences" : "overview";
  const [editor, setEditor] = useState(false);
  const [password, setPassword] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    section: Section;
    view?: string;
  } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [preferencesReload, setPreferencesReload] = useState(0);
  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: profileService.getMe,
    enabled: Boolean(token),
  });
  const userId = String(
    user?.user_id ?? user?.id ?? stored?.user_id ?? stored?.id ?? "",
  );
  const canonicalMe =
    meQuery.data && String(meQuery.data.user_id ?? meQuery.data.id) === userId
      ? meQuery.data
      : null;
  const me =
    canonicalMe ??
    (stored && String(stored.user_id ?? stored.id) === userId ? stored : null);
  const [overlayOwner, setOverlayOwner] = useState<(() => boolean) | null>(
    null,
  );
  const isCurrentOwner = useMemo(
    () =>
      token && userId && authEpoch >= 0 ? captureAuthOwner() : () => false,
    [token, userId, authEpoch],
  );
  const ownOverlay = Boolean(overlayOwner?.());
  const preferences = useQuery({
    queryKey: profileKeys.preferences(userId),
    queryFn: profileService.getPreferences,
    enabled: Boolean(userId),
  });
  const preferenceMutation = useMutation({
    mutationFn: ({
      changes,
      version,
      userId: mutationUserId,
    }: {
      changes: ProfilePreferenceChanges;
      version: number;
      userId: string;
    }) => {
      if (
        String(
          useAuthStore.getState().user?.user_id ??
            useAuthStore.getState().user?.id ??
            "",
        ) !== mutationUserId
      )
        return Promise.reject(new Error("PROFILE_OWNER_CHANGED"));
      return profileService.updatePreferences(changes, version);
    },
    onMutate: async (variables) => {
      const stillCurrent = captureAuthOwner();
      await client.cancelQueries({
        queryKey: profileKeys.preferences(variables.userId),
      });
      if (!stillCurrent()) throw new Error("PROFILE_OWNER_CHANGED");
      return stillCurrent;
    },
    onSuccess: async (saved, variables, stillCurrent) => {
      if (!stillCurrent?.()) return;
      await client.cancelQueries({
        queryKey: profileKeys.preferences(variables.userId),
      });
      if (!stillCurrent()) return;
      client.setQueryData(profileKeys.preferences(variables.userId), saved);
      toast.success(t("auth.personal.saved"));
    },
  });
  const mfaStatus = useQuery({
    queryKey: [...MFA_STATUS_QUERY_KEY, userId, authEpoch],
    queryFn: authService.mfaStatus,
    enabled: section === "security",
  });
  const warehouses = useWarehouseDirectory({ enabled: Boolean(userId) });
  const history = useQuery({
    queryKey: ["audit-logs", "me", historyPage],
    queryFn: () =>
      auditLogService.getMyPermissionHistory({
        page: historyPage,
        per_page: 10,
      }),
    enabled: section === "security" && Boolean(userId),
  });
  const historyPagination = resolveApiPagination(history.data?.meta, {
    page: historyPage,
    pageSize: 10,
    rowCount: history.data?.data.length ?? 0,
  });
  const avatarUrl = useProfileAvatarUrl(userId, me?.avatar);
  useEffect(() => {
    if (
      meQuery.data &&
      String(meQuery.data.user_id ?? meQuery.data.id) === userId &&
      isCurrentOwner()
    )
      setProfile(meQuery.data);
  }, [meQuery.data, setProfile, token, userId, isCurrentOwner]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const applyNavigation = (next: { section: Section; view?: string }) => {
    setDirty(false);
    setParams(
      next.view
        ? { section: next.section, view: next.view }
        : { section: next.section },
    );
    setPendingNavigation(null);
  };
  const navigate = (next: { section: Section; view?: string }) => {
    if (dirty) setPendingNavigation(next);
    else applyNavigation(next);
  };
  const savedProfile = async (updated: MeResponse) => {
    if (!isCurrentOwner() || String(updated.user_id ?? updated.id) !== userId)
      return;
    await client.cancelQueries({ queryKey: ["auth", "me"] });
    if (!isCurrentOwner()) return;
    const currentToken = useAuthStore.getState().token;
    setProfile(updated);
    client.setQueryData(["auth", "me", currentToken], updated);
    void client.invalidateQueries({ queryKey: ["auth", "avatar", userId] });
    void client.invalidateQueries({ queryKey: ["iam", "users"] });
    void client.invalidateQueries({ queryKey: ["audit-logs", "me"] });
    toast.success(t("auth.personal.saved"));
  };
  const tabItems = [
    {
      key: "profile",
      label: (
        <>
          <UiIcon name="user" size="sm" />
          {t("auth.personal.tabsProfile")}
        </>
      ),
    },
    {
      key: "preferences",
      label: (
        <>
          <UiIcon name="settings-sliders" size="sm" />
          {t("auth.personal.preferencesTitle")}
        </>
      ),
    },
    {
      key: "security",
      label: (
        <>
          <UiIcon name="shield" size="sm" />
          {t("auth.personal.tabsSecurity")}
        </>
      ),
    },
    {
      key: "notifications",
      label: (
        <>
          <UiIcon name="bell" size="sm" />
          {t("auth.personal.tabsNotifications")}
        </>
      ),
    },
    {
      key: "appearance",
      label: (
        <>
          <UiIcon name="browser" size="sm" />
          {t("auth.personal.tabsAppearance")}
        </>
      ),
    },
    {
      key: "other",
      label: (
        <>
          <UiIcon name="settings" size="sm" />
          {t("auth.personal.tabsOther")}
        </>
      ),
    },
  ];
  const title =
    section === "profile"
      ? accountMode === "preferences"
        ? t("auth.personal.preferencesTitle")
        : t("auth.personal.profileTitle")
      : section === "security"
        ? t("auth.personal.securityTitle")
        : section === "notifications"
          ? t("auth.personal.tabsNotifications")
          : section === "appearance"
            ? t("auth.personal.appearanceTitle")
            : t("auth.personal.otherTitle");
  const subtitle =
    section === "profile" && accountMode === "overview"
      ? t("auth.personal.profileSubtitle")
      : null;
  const warehouseNames = useMemo(
    () =>
      new Map(
        (warehouses.data ?? []).map((row) => [
          String(row.id),
          String(row.name ?? row.code ?? ""),
        ]),
      ),
    [warehouses.data],
  );
  const scopeName = (scope?: string | null) =>
    scope
      ? warehouseNames.get(scope) || t("auth.personal.unknown")
      : t("auth.personal.scopeAll");
  const homeOptions = [
    {
      value: "dashboard",
      label: t("auth.personal.homeDashboard"),
      permission: P.DASHBOARD_VIEW,
    },
    {
      value: "inbound",
      label: t("auth.personal.homeInbound"),
      permission: P.INBOUND_VIEW,
    },
    {
      value: "outbound",
      label: t("auth.personal.homeOutbound"),
      permission: P.OUTBOUND_VIEW,
    },
    {
      value: "inventory",
      label: t("auth.personal.homeInventory"),
      permission: P.INVENTORY_VIEW,
    },
  ].filter((option) => superAdmin || permissions.includes(option.permission));
  const settingsMode =
    section === "profile"
      ? "account"
      : section === "notifications"
        ? "notifications"
        : section === "appearance"
          ? "appearance"
          : "other";
  const showSettings =
    (section === "profile" && accountMode === "preferences") ||
    ["notifications", "appearance", "other"].includes(section);
  return (
    <div className="hn-profile-page hn-personal-profile hn-settings-screen">
      <header className="hn-personal-page-heading">
        <div className="hn-personal-heading-text">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <nav
          id="hn-profile-section-nav"
          className="hn-personal-section-nav"
          aria-label={t("auth.personal.sectionPicker")}
          hidden={!navigationOpen}
        >
          <UiTabs
            value={
              section === "profile" && accountMode === "preferences"
                ? "preferences"
                : section
            }
            items={tabItems}
            onChange={(value) =>
              value === "preferences"
                ? navigate({ section: "profile", view: "preferences" })
                : navigate({ section: value as Section })
            }
          />
        </nav>
        <button
          type="button"
          className="hn-personal-nav-toggle"
          aria-label={t(
            navigationOpen
              ? "auth.personal.collapseNavigation"
              : "auth.personal.expandNavigation",
          )}
          title={t(
            navigationOpen
              ? "auth.personal.collapseNavigation"
              : "auth.personal.expandNavigation",
          )}
          aria-expanded={navigationOpen}
          aria-controls="hn-profile-section-nav"
          onClick={() => setNavigationOpen((open) => !open)}
        >
          {!navigationOpen ? (
            <span className="hn-personal-nav-current">
              {
                tabItems.find(
                  (item) =>
                    item.key ===
                    (section === "profile" && accountMode === "preferences"
                      ? "preferences"
                      : section),
                )?.label
              }
            </span>
          ) : null}
          <UiIcon
            name={navigationOpen ? "angle-small-up" : "angle-small-down"}
            size="sm"
          />
        </button>
      </header>
      {meQuery.isError ? (
        <ApiErrorAlert
          error={meQuery.error}
          title={t("auth.personal.loadError")}
          onRetry={() => void meQuery.refetch()}
        />
      ) : null}
      {!me ? (
        <p role="status">{t("shared.table.loading")}</p>
      ) : (
        <>
          {section === "profile" && accountMode === "overview" ? (
            <>
              <div className="hn-personal-overview-grid">
                <section className="hn-personal-card">
                  <div className="hn-personal-section-heading hn-personal-info-heading">
                    <h2>{t("auth.personal.personalInfo")}</h2>
                    <ActionButton
                      kind="edit"
                      onClick={() => {
                        setOverlayOwner(() => captureAuthOwner());
                        setEditor(true);
                      }}
                      disabled={!canonicalMe}
                    >
                      {t("auth.personal.editProfile")}
                    </ActionButton>
                  </div>
                  <dl className="hn-personal-detail-list">
                    <div>
                      <dt>{t("auth.personal.name")}</dt>
                      <dd>{me.display_name || me.name}</dd>
                    </div>
                    <div>
                      <dt>{t("auth.personal.email")}</dt>
                      <dd>{me.email}</dd>
                    </div>
                    <div>
                      <dt>{t("auth.personal.phone")}</dt>
                      <dd>{me.phone || t("auth.personal.unknown")}</dd>
                    </div>
                    <div>
                      <dt>{t("auth.personal.department")}</dt>
                      <dd>
                        {me.department?.department_name ||
                          me.department?.name ||
                          t("auth.personal.unknown")}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section className="hn-personal-card">
                  <div className="hn-personal-section-heading">
                    <h2>{t("auth.personal.access")}</h2>
                    <span className="hn-personal-readonly">
                      <UiIcon name="lock" size="sm" />
                      {t("auth.personal.managedAccess")}
                    </span>
                  </div>
                  <div className="hn-personal-role-list">
                    {me.roles.length ? (
                      me.roles.map((role) => (
                        <article
                          key={`${role.role_id}:${role.scope_ref || ""}`}
                        >
                          <strong>{role.role_name}</strong>
                          <span>{scopeName(role.scope_ref)}</span>
                        </article>
                      ))
                    ) : (
                      <p className="hn-personal-muted">
                        {t("auth.personal.unknown")}
                      </p>
                    )}
                  </div>
                  <p className="hn-personal-note">
                    {t("auth.profile.grantedPermissions")}: {permissions.length}
                  </p>
                </section>
              </div>
              <ProfileSessionsPanel key={userId} userId={userId} />
            </>
          ) : null}
          {section === "security" ? (
            <div className="hn-personal-security-stack">
              <section className="hn-personal-card hn-personal-inline-card">
                <div>
                  <h2>{t("auth.personal.password")}</h2>
                  <p aria-label={t("auth.personal.password")}>••••••••••••</p>
                </div>
                <ActionButton
                  kind="edit"
                  onClick={() => {
                    setOverlayOwner(() => captureAuthOwner());
                    setPassword(true);
                  }}
                >
                  {t("auth.personal.changePassword")}
                </ActionButton>
              </section>
              <section className="hn-personal-card hn-personal-inline-card">
                <div>
                  <h2>{t("auth.mfa.setupTitle")}</h2>
                  <p className="hn-personal-muted">
                    {mfaStatus.isPending
                      ? t("auth.mfa.statusLoading")
                      : mfaStatus.isError
                        ? t("auth.mfa.statusLoadError")
                        : mfaStatus.data?.enabled
                          ? t("auth.mfa.profileEnabledDescription")
                          : t("auth.mfa.setupSubtitle")}
                  </p>
                  {mfaStatus.data ? (
                    <UiStatusBadge
                      tone={mfaStatus.data.enabled ? "success" : "neutral"}
                      label={t(
                        mfaStatus.data.enabled
                          ? "auth.mfa.statusEnabled"
                          : mfaStatus.data.pending
                            ? "auth.mfa.statusPending"
                            : "auth.mfa.statusDisabled",
                      )}
                    />
                  ) : null}
                </div>
                {mfaStatus.isError ? (
                  <ActionButton
                    kind="refresh"
                    onClick={() => void mfaStatus.refetch()}
                  >
                    {t("auth.personal.retry")}
                  </ActionButton>
                ) : (
                  <ActionButton
                    kind="settings"
                    disabled={!mfaStatus.data}
                    onClick={() => {
                      setOverlayOwner(() => captureAuthOwner());
                      setMfa(true);
                    }}
                  >
                    {t(
                      mfaStatus.data?.enabled
                        ? "auth.mfa.viewDetails"
                        : "auth.mfa.startEnroll",
                    )}
                  </ActionButton>
                )}
              </section>
              <details className="hn-personal-card hn-personal-history">
                <summary>{t("auth.profile.historyTitle")}</summary>
                {history.isError ? (
                  <ApiErrorAlert
                    error={history.error}
                    onRetry={() => void history.refetch()}
                  />
                ) : null}
                <div className="hn-personal-history-table">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col" className="hn-personal-history-index">
                          {t("shared.table.rowNumber")}
                        </th>
                        <th>{t("auth.profile.colTime")}</th>
                        <th>{t("auth.profile.colAction")}</th>
                        <th>{t("auth.profile.colReason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.data?.data ?? []).map((entry, index) => (
                        <tr key={entry.id}>
                          <td className="hn-personal-history-index">
                            {(historyPagination.current - 1) *
                              historyPagination.pageSize +
                              index +
                              1}
                          </td>
                          <td>{formatDateTime(entry.created_at)}</td>
                          <td>{auditActionLabel(entry.action)}</td>
                          <td>{entry.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!history.isPending && history.data?.data.length === 0 ? (
                    <p>{t("auth.profile.historyEmpty")}</p>
                  ) : null}
                </div>
                <UiPagination
                  page={historyPagination.current}
                  pageSize={10}
                  total={historyPagination.total}
                  onPageChange={setHistoryPage}
                />
              </details>
            </div>
          ) : null}
          {showSettings ? (
            preferences.isError ? (
              <ApiErrorAlert
                error={preferences.error}
                onRetry={() => void preferences.refetch()}
              />
            ) : preferences.data ? (
              <ProfilePreferencesPanel
                key={`${userId}:${settingsMode}:${preferencesReload}`}
                mode={settingsMode}
                preferences={preferences.data}
                onDirtyChange={setDirty}
                onReload={() => {
                  void preferences.refetch().then((result) => {
                    if (result.isSuccess && isCurrentOwner()) {
                      setDirty(false);
                      setPreferencesReload((count) => count + 1);
                    }
                  });
                }}
                onSave={(changes, version) =>
                  preferenceMutation.mutateAsync({ changes, version, userId })
                }
                homeOptions={homeOptions}
              />
            ) : (
              <p role="status">{t("shared.table.loading")}</p>
            )
          ) : null}
        </>
      )}
      {editor && ownOverlay && canonicalMe ? (
        <ProfileEditorDrawer
          profile={canonicalMe}
          avatarUrl={avatarUrl}
          onClose={() => {
            if (isCurrentOwner()) setEditor(false);
          }}
          onSaved={savedProfile}
          onReload={() => {
            if (isCurrentOwner()) {
              setEditor(false);
              void meQuery.refetch();
            }
          }}
        />
      ) : null}
      {password && ownOverlay ? (
        <ProfilePasswordDrawer
          onClose={() => {
            if (isCurrentOwner()) setPassword(false);
          }}
        />
      ) : null}
      <MfaSettingsDrawer
        open={mfa && ownOverlay}
        onClose={() => setMfa(false)}
      />
      <UiConfirmDialog
        open={Boolean(pendingNavigation)}
        title={t("auth.personal.unsavedTitle")}
        tone="danger"
        confirmText={t("auth.personal.discard")}
        cancelText={t("auth.personal.keepEditing")}
        onConfirm={() => {
          if (pendingNavigation) applyNavigation(pendingNavigation);
        }}
        onClose={() => setPendingNavigation(null)}
      >
        {t("auth.personal.unsavedBody")}
      </UiConfirmDialog>
    </div>
  );
}
