import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import {
  Box,
  Stack,
  UiAlert,
  UiAvatar,
  UiButton,
  UiCard,
  UiStatusBadge,
  UiText,
  UiTextField,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components";
import { useAuthStore } from "@/shared/store/auth.store";
import { resolveFormErrors } from "@/shared/api/api-error";
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
    UPDATE_PROFILE: t("auth.profile.actionUpdate"),
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
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
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

  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const saveProfile = useMutation({
    mutationFn: (changes: { display_name: string; phone: string | null }) =>
      authService.updateMe(changes, profile?.version),
    onSuccess: (updated) => {
      queryClient.setQueryData(["auth", "me", token], updated);
      setProfile(updated);
      void queryClient.invalidateQueries({ queryKey: ["audit-logs", "me"] });
      setIsEditing(false);
      setSaveSuccess(true);
    },
  });

  const startEditing = () => {
    setNameDraft(profile?.display_name ?? user?.display_name ?? "");
    setPhoneDraft(phone ?? "");
    setNameError("");
    setPhoneError("");
    setSaveError("");
    setSaveSuccess(false);
    setIsEditing(true);
  };

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const display_name = nameDraft.trim();
    const phone = phoneDraft.trim();
    const nextNameError = !display_name
      ? t("auth.profile.nameRequired")
      : display_name.length > 255
        ? t("auth.profile.nameTooLong")
        : "";
    const nextPhoneError =
      phone && !/^0\d{9}$/.test(phone) ? t("auth.profile.phoneInvalid") : "";
    setNameError(nextNameError);
    setPhoneError(nextPhoneError);
    setSaveError("");
    if (nextNameError || nextPhoneError) return;

    try {
      await saveProfile.mutateAsync({ display_name, phone: phone || null });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 412) {
        setSaveError(t("auth.profile.staleVersion"));
        void queryClient.invalidateQueries({ queryKey: ["auth", "me", token] });
        return;
      }
      const { fieldErrors, message } = resolveFormErrors(error, [
        "displayName",
        "phone",
      ]);
      setNameError(fieldErrors.displayName ?? "");
      setPhoneError(fieldErrors.phone ?? "");
      setSaveError(message ?? t("auth.profile.updateFailed"));
    }
  };

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
          {!isEditing ? (
            <UiButton
              type="button"
              className="hn-profile-edit-trigger"
              onClick={startEditing}
            >
              {t("auth.profile.editDetails")}
            </UiButton>
          ) : null}
        </Box>

        {saveSuccess ? (
          <UiAlert tone="success">{t("auth.profile.updateSuccess")}</UiAlert>
        ) : null}
        {isEditing ? (
          <Box
            component="form"
            className="hn-profile-edit-form"
            onSubmit={saveDetails}
            noValidate
          >
            <Box className="hn-profile-edit-fields">
              <UiTextField
                label={t("auth.profile.fullName")}
                value={nameDraft}
                onChange={(event) => {
                  setNameDraft(event.target.value);
                  setNameError("");
                }}
                required
                fullWidth
                autoFocus
                disabled={saveProfile.isPending}
                error={Boolean(nameError)}
                helperText={nameError}
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
              <UiTextField
                label={t("auth.profile.phone")}
                value={phoneDraft}
                onChange={(event) => {
                  setPhoneDraft(event.target.value);
                  setPhoneError("");
                }}
                fullWidth
                disabled={saveProfile.isPending}
                error={Boolean(phoneError)}
                helperText={phoneError}
                slotProps={{
                  htmlInput: { inputMode: "numeric", maxLength: 30 },
                }}
              />
            </Box>
            {saveError ? <UiAlert tone="error">{saveError}</UiAlert> : null}
            <Stack
              direction="row"
              spacing={1.5}
              className="hn-profile-edit-actions"
            >
              <UiButton
                type="submit"
                loading={saveProfile.isPending}
                disabled={saveProfile.isPending}
              >
                {t("auth.profile.saveDetails")}
              </UiButton>
              <UiButton
                type="button"
                disabled={saveProfile.isPending}
                onClick={() => setIsEditing(false)}
              >
                {t("auth.profile.cancelEdit")}
              </UiButton>
            </Stack>
          </Box>
        ) : null}

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
                <dt>{t("auth.profile.fullName")}</dt>
                <dd>{displayName}</dd>
              </div>
              <div>
                <dt>{t("auth.fields.email")}</dt>
                <dd>{empty(email)}</dd>
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
