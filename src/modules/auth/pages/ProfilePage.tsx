import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  UiAvatar,
  UiCard,
  UiDescriptions,
  UiPageContainer,
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

const PERMISSION_HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATE: "Tạo tài khoản",
  UPDATE: "Cập nhật thông tin",
  ASSIGN_ROLES: "Gán vai trò",
  GRANT_USER_PERMISSION: "Cấp quyền riêng",
  REVOKE_USER_PERMISSION: "Thu hồi quyền riêng",
};

function permissionHistoryActionLabel(action: string): string {
  return PERMISSION_HISTORY_ACTION_LABELS[action] ?? action;
}

function statusLabel(status?: string) {
  if (status === "ACTIVE") return "Đang hoạt động";
  if (status === "INACTIVE") return "Tạm ngưng";
  if (status === "LOCKED") return "Đã khóa";
  return status || EMPTY_TEXT;
}

function statusTone(status?: string): UiStatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "LOCKED") return "error";
  if (status === "INACTIVE") return "warning";
  return "neutral";
}

function empty(value?: string | number | null) {
  return value === undefined || value === null || value === "" ? EMPTY_TEXT : value;
}

const HISTORY_COLUMNS: ResponsiveTableColumn<MyPermissionHistoryEntry>[] = [
  {
    key: "created_at",
    header: "Thời gian",
    width: 170,
    render: (row) => formatDateTime(row.created_at),
  },
  {
    key: "action",
    header: "Hành động",
    width: 180,
    render: (row) => (
      <UiStatusBadge
        tone="neutral"
        label={permissionHistoryActionLabel(row.action)}
      />
    ),
  },
  {
    key: "reason",
    header: "Lý do",
    render: (row) => row.reason || EMPTY_TEXT,
  },
];

export function ProfilePage() {
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
    "Người dùng";
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

  return (
    <UiPageContainer title="Thông tin tài khoản">
      <UiCard>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <UiAvatar name={displayName} size="lg" />
          <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <UiText variant="cardTitle">{displayName}</UiText>
            {email ? <UiText variant="secondary">{email}</UiText> : null}
          </Box>
        </Box>

        <UiDescriptions
          columns={2}
          items={[
            { label: "Họ và tên", value: displayName },
            { label: "Tên đăng nhập", value: empty(username) },
            { label: "Mã nhân viên", value: empty(code) },
            { label: "Số điện thoại", value: empty(phone) },
            { label: "Email", value: empty(email) },
            {
              label: "Trạng thái",
              value: (
                <UiStatusBadge
                  tone={statusTone(status)}
                  label={statusLabel(status)}
                />
              ),
            },
            {
              label: "Vai trò",
              value: isSuperAdmin ? (
                <UiStatusBadge tone="warning" label="Super Admin" />
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
              label: "Phạm vi kho",
              value:
                warehouseScopes.length > 0 ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", rowGap: 1 }}
                  >
                    {warehouseScopes.map((scope) => (
                      <UiStatusBadge key={scope} tone="neutral" label={scope} />
                    ))}
                  </Stack>
                ) : (
                  empty(
                    currentContext?.scope_ref ?? currentContext?.warehouse_name,
                  )
                ),
            },
            {
              label: "Ngữ cảnh hiện tại",
              value: empty(currentContext?.role_name),
            },
            { label: "Quyền được cấp", value: permissionCodes.length },
          ]}
        />
      </UiCard>

      <UiCard title="Lịch sử thay đổi quyền/vai trò trên tài khoản của tôi">
        <ResponsiveDataTable<MyPermissionHistoryEntry>
          columns={HISTORY_COLUMNS}
          rows={historyRows}
          rowKey={(row) => row.id}
          loading={historyQuery.isLoading}
          emptyText="Chưa có thay đổi nào được ghi nhận."
        />
      </UiCard>
    </UiPageContainer>
  );
}
