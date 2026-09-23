import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Box,
  Stack,
  UiAvatar,
  UiCard,
  UiDescriptions,
  UiStatusBadge,
  UiText,
  type UiStatusTone,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components";
import { useAuthStore } from "@/shared/store/auth.store";
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

function statusTone(status?: string): UiStatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "LOCKED") return "error";
  if (status === "INACTIVE") return "warning";
  return "neutral";
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

  /** Yêu cầu #6: lịch sử thay đổi quyền/vai trò/thông tin TRÊN chính tài khoản mình. */
  const historyQuery = useQuery({
    queryKey: ["audit-logs", "me"],
    queryFn: () => auditLogService.getMyPermissionHistory({ per_page: 20 }),
  });
  const historyRows = historyQuery.data?.data ?? [];

  const historyColumns = useMemo(() => buildHistoryColumns(t), [t]);

  return (
    // Tiêu đề màn do header chung của shell dựng (AppPageHeader).
    <Box className="hn-settings-screen hn-profile-settings">
      <UiCard className="hn-settings-card">
        <Box className="hn-profile-identity">
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
              <UiText variant="secondary" className="hn-settings-muted">
                {email}
              </UiText>
            ) : null}
          </Box>
        </Box>

        <Box className="hn-settings-descriptions">
          <UiDescriptions
            columns={2}
            items={[
              { label: t("auth.profile.fullName"), value: displayName },
              { label: t("auth.profile.username"), value: empty(username) },
              { label: t("auth.profile.employeeCode"), value: empty(code) },
              { label: t("auth.profile.phone"), value: empty(phone) },
              { label: t("auth.fields.email"), value: empty(email) },
              {
                label: t("auth.profile.status"),
                value: (
                  <UiStatusBadge
                    tone={statusTone(status)}
                    data-settings-tone={statusTone(status)}
                    label={statusLabel(t, status)}
                  />
                ),
              },
              {
                label: t("auth.profile.roles"),
                value: isSuperAdmin ? (
                  <UiStatusBadge
                    tone="warning"
                    data-settings-tone="warning"
                    label="Super Admin"
                  />
                ) : roles.length > 0 ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", rowGap: 1 }}
                  >
                    {roles.map((role) => (
                      <UiStatusBadge
                        key={role.role_id}
                        tone="neutral"
                        data-settings-tone="neutral"
                        label={`${role.role_name}${
                          role.role_code ? ` (${role.role_code})` : ""
                        }`}
                      />
                    ))}
                  </Stack>
                ) : (
                  empty(profile?.role?.name ?? currentContext?.role_name)
                ),
              },
              {
                label: t("auth.profile.warehouseScope"),
                value:
                  warehouseScopes.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flexWrap: "wrap", rowGap: 1 }}
                    >
                      {warehouseScopes.map((scope) => (
                        <UiStatusBadge
                          key={scope}
                          tone="neutral"
                          data-settings-tone="neutral"
                          label={scope}
                        />
                      ))}
                    </Stack>
                  ) : (
                    empty(
                      currentContext?.scope_ref ??
                        currentContext?.warehouse_name,
                    )
                  ),
              },
              {
                label: t("auth.profile.currentContext"),
                value: empty(currentContext?.role_name),
              },
              {
                label: t("auth.profile.grantedPermissions"),
                value: permissionCodes.length,
              },
            ]}
          />
        </Box>
      </UiCard>

      {/* WWHN-SEC-08 — lối vào duy nhất tới màn đăng ký MFA.
          Không có thẻ này thì /profile/mfa tồn tại nhưng không ai tìm thấy, và
          "tính năng đã có" trên giấy tờ lại bằng "không ai bật" trên thực tế. */}
      <UiCard className="hn-settings-card" title={t("auth.mfa.setupTitle")}>
        <Stack spacing="12px">
          <UiText className="hn-settings-muted">
            {t("auth.mfa.setupSubtitle")}
          </UiText>
          <Box>
            <Link className="hn-profile-mfa-link" to={ROUTES.MFA_SETUP}>
              {t("auth.mfa.startEnroll")}
            </Link>
          </Box>
        </Stack>
      </UiCard>

      <UiCard
        className="hn-settings-card"
        title={t("auth.profile.historyTitle")}
      >
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
      </UiCard>
    </Box>
  );
}
