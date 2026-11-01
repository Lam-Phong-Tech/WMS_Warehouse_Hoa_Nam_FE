import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Box, UiAvatar, UiCard, UiStatusBadge, UiText } from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components";
import { useAuthStore } from "@/shared/store/auth.store";
import { authService } from "@/modules/auth/services/auth.service";
import { MFA_STATUS_QUERY_KEY } from "@/modules/auth/types/mfa.types";
import {
  auditLogService,
  type MyPermissionHistoryEntry,
} from "@/modules/audit-logs/services/audit-logs.service";
import { formatDateTime } from "@/shared/utils/format-date";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { ROUTES } from "@/shared/constants/routes";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import "@/shared/ui/sku-aligned-settings.css";
import "./profile-page.css";

function permissionHistoryActionLabel(t: TranslateFn, action: string): string {
  const labels: Record<string, string> = {
    CREATE: t("auth.profile.actionCreate"),
    UPDATE: t("auth.profile.actionUpdate"),
    ASSIGN_ROLES: t("auth.profile.actionAssignRoles"),
    GRANT_USER_PERMISSION: t("auth.profile.actionGrantPermission"),
    REVOKE_USER_PERMISSION: t("auth.profile.actionRevokePermission"),
  };
  return labels[action] ?? action;
}

function statusLabel(t: TranslateFn, status?: string) {
  if (status === "ACTIVE") return t("auth.profile.statusActive");
  if (status === "INACTIVE") return t("auth.profile.statusInactive");
  if (status === "LOCKED") return t("auth.profile.statusLocked");
  return status || EMPTY_TEXT;
}

function empty(value?: string | number | null) {
  return value === undefined || value === null || value === ""
    ? EMPTY_TEXT
    : value;
}

function buildHistoryColumns(
  t: TranslateFn,
): ResponsiveTableColumn<MyPermissionHistoryEntry>[] {
  return [
    {
      key: "created_at",
      header: t("auth.profile.colTime"),
      width: 170,
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "action",
      header: t("auth.profile.colAction"),
      width: 180,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          data-settings-tone="neutral"
          label={permissionHistoryActionLabel(t, row.action)}
        />
      ),
    },
    {
      key: "reason",
      header: t("auth.profile.colReason"),
      render: (row) => row.reason || EMPTY_TEXT,
    },
  ];
}

export function ProfilePage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const currentContext = useAuthStore((s) => s.currentContext);
  const permissionCodes = useAuthStore((s) => s.permissionCodes);

  const roles = profile?.roles ?? user?.roles ?? [];
  const warehouseScopes =
    profile?.warehouse_scope_ids ?? user?.warehouse_scope_ids ?? [];
  const displayName =
    profile?.display_name ??
    profile?.name ??
    user?.display_name ??
    user?.name ??
    user?.code ??
    user?.email ??
    t("auth.profile.defaultUserName");
  const email = profile?.email ?? user?.email;
  const username = profile?.username ?? user?.username;
  const code = profile?.code ?? user?.code;
  const phone = profile?.phone ?? user?.phone;
  const status = profile?.status ?? user?.status;
  const roleNames = isSuperAdmin
    ? "Super Admin"
    : roles.length > 0
      ? roles
          .map((role) =>
            role.role_code
              ? `${role.role_name} (${role.role_code})`
              : role.role_name,
          )
          .join(", ")
      : empty(profile?.role?.name ?? currentContext?.role_name);
  const warehouseScope =
    warehouseScopes.length > 0
      ? warehouseScopes.join(", ")
      : empty(currentContext?.scope_ref ?? currentContext?.warehouse_name);

  /** Yêu cầu #6: lịch sử thay đổi quyền/vai trò/thông tin TRÊN chính tài khoản mình. */
  const historyQuery = useQuery({
    queryKey: ["audit-logs", "me"],
    queryFn: () => auditLogService.getMyPermissionHistory({ per_page: 20 }),
  });
  const mfaStatus = useQuery({
    queryKey: MFA_STATUS_QUERY_KEY,
    queryFn: () => authService.mfaStatus(),
  });
  const historyRows = historyQuery.data?.data ?? [];

  const historyColumns = useMemo(() => buildHistoryColumns(t), [t]);

  return (
    // Tiêu đề màn do header chung của shell dựng (AppPageHeader).
    <Box className="hn-settings-screen hn-profile-settings">
      <UiCard className="hn-settings-card hn-profile-overview">
        <Box className="hn-profile-identity">
          <Box className="hn-profile-person">
            <UiAvatar
              className="hn-profile-avatar"
              name={displayName}
              size="lg"
            />
            <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <UiText variant="cardTitle" className="hn-profile-name">
                {displayName}
              </UiText>
              {email ? (
                <UiText variant="secondary" className="hn-profile-email">
                  {email}
                </UiText>
              ) : null}
            </Box>
          </Box>
          {status ? (
            <span
              className="hn-profile-state"
              data-state={status.toLowerCase()}
            >
              <span className="hn-profile-state-dot" aria-hidden="true" />
              {statusLabel(t, status)}
            </span>
          ) : null}
        </Box>

        <div className="hn-profile-details">
          <section
            className="hn-profile-detail-group"
            aria-labelledby="hn-profile-account-heading"
          >
            <h2 id="hn-profile-account-heading">
              {t("auth.profile.accountDetails")}
            </h2>
            <dl>
              <div>
                <dt>{t("auth.profile.username")}</dt>
                <dd>{empty(username)}</dd>
              </div>
              <div>
                <dt>{t("auth.profile.employeeCode")}</dt>
                <dd>{empty(code)}</dd>
              </div>
              <div>
                <dt>{t("auth.profile.phone")}</dt>
                <dd>{empty(phone)}</dd>
              </div>
            </dl>
          </section>
          <section
            className="hn-profile-detail-group"
            aria-labelledby="hn-profile-access-heading"
          >
            <h2 id="hn-profile-access-heading">
              {t("auth.profile.accessDetails")}
            </h2>
            <dl>
              <div>
                <dt>{t("auth.profile.roles")}</dt>
                <dd>{roleNames}</dd>
              </div>
              <div>
                <dt>{t("auth.profile.currentContext")}</dt>
                <dd>{empty(currentContext?.role_name)}</dd>
              </div>
              <div>
                <dt>{t("auth.profile.warehouseScope")}</dt>
                <dd>{warehouseScope}</dd>
              </div>
              <div>
                <dt>{t("auth.profile.grantedPermissions")}</dt>
                <dd>{permissionCodes.length}</dd>
              </div>
            </dl>
          </section>
        </div>
      </UiCard>

      {/* Trạng thái lấy từ tài khoản hiện tại, kể cả sau khi xác nhận ở /profile/mfa. */}
      <UiCard
        className="hn-settings-card hn-profile-security"
        title={t("auth.mfa.setupTitle")}
        action={
          mfaStatus.data ? (
            <span
              className="hn-profile-security-state"
              data-state={
                mfaStatus.data.enabled
                  ? "enabled"
                  : mfaStatus.data.pending
                    ? "pending"
                    : "disabled"
              }
            >
              <span className="hn-profile-state-dot" aria-hidden="true" />
              {mfaStatus.data.enabled
                ? t("auth.mfa.statusEnabled")
                : mfaStatus.data.pending
                  ? t("auth.mfa.statusPending")
                  : t("auth.mfa.statusDisabled")}
            </span>
          ) : null
        }
      >
        <div className="hn-profile-security-content">
          <p>
            {mfaStatus.isPending
              ? t("auth.mfa.statusLoading")
              : mfaStatus.isError
                ? t("auth.mfa.statusLoadError")
                : mfaStatus.data?.enabled
                  ? t("auth.mfa.profileEnabledDescription")
                  : t("auth.mfa.setupSubtitle")}
          </p>
          {mfaStatus.data ? (
            <Link className="hn-profile-mfa-link" to={ROUTES.MFA_SETUP}>
              {mfaStatus.data.enabled
                ? t("auth.mfa.viewDetails")
                : t("auth.mfa.startEnroll")}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </UiCard>

      <UiCard
        className="hn-settings-card hn-profile-history"
        title={t("auth.profile.historyTitle")}
      >
        {historyQuery.isSuccess && historyRows.length === 0 ? (
          <p className="hn-profile-history-empty">
            {t("auth.profile.historyEmpty")}
          </p>
        ) : (
          <ResponsiveDataTable<MyPermissionHistoryEntry>
            columns={historyColumns}
            headerCellStyle={{
              background: "var(--settings-pale)",
              color: "var(--settings-ink)",
            }}
            rows={historyRows}
            rowKey={(row) => row.id}
            loading={historyQuery.isLoading}
            emptyText={t("auth.profile.historyEmpty")}
          />
        )}
      </UiCard>
    </Box>
  );
}
