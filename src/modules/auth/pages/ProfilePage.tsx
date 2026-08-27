import { useQuery } from "@tanstack/react-query";
import { Avatar, Card, Descriptions, Empty, Space, Table, Tag } from "antd";
import { UserOutlined } from "@/shared/components/icons";
import { PageHeader } from "@/shared/components";
import { BRAND } from "@/app/theme";
import { useAuthStore } from "@/shared/store/auth.store";
import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import { formatDateTime } from "@/shared/utils/format-date";

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
  return status || "—";
}

function statusColor(status?: string) {
  if (status === "ACTIVE") return "green";
  if (status === "LOCKED") return "red";
  if (status === "INACTIVE") return "orange";
  return "default";
}

function empty(value?: string | number | null) {
  return value === undefined || value === null || value === "" ? "—" : value;
}

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
    <div>
      <PageHeader title="Thông tin tài khoản" />

      <Card>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <Avatar
            size={64}
            icon={<UserOutlined />}
            style={{ background: BRAND.primary, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{displayName}</div>
            {email ? (
              <div style={{ color: "rgba(0,0,0,0.45)" }}>{email}</div>
            ) : null}
          </div>
        </div>

        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="Họ và tên">{displayName}</Descriptions.Item>
          <Descriptions.Item label="Tên đăng nhập">
            {empty(username)}
          </Descriptions.Item>
          <Descriptions.Item label="Mã nhân viên">
            {empty(code)}
          </Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">
            {empty(phone)}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{empty(email)}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Vai trò">
            {isSuperAdmin ? (
              <Tag color="gold">Super Admin</Tag>
            ) : roles.length > 0 ? (
              <Space size={[8, 8]} wrap>
                {roles.map((role) => (
                  <Tag key={role.role_id}>
                    {role.role_name}
                    {role.role_code ? ` (${role.role_code})` : ""}
                  </Tag>
                ))}
              </Space>
            ) : (
              empty(profile?.role?.name ?? currentContext?.role_name)
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Phạm vi kho">
            {warehouseScopes.length > 0 ? (
              <Space size={[8, 8]} wrap>
                {warehouseScopes.map((scope) => (
                  <Tag key={scope}>{scope}</Tag>
                ))}
              </Space>
            ) : (
              empty(currentContext?.scope_ref ?? currentContext?.warehouse_name)
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Ngữ cảnh hiện tại">
            {empty(currentContext?.role_name)}
          </Descriptions.Item>
          <Descriptions.Item label="Quyền được cấp">
            {permissionCodes.length}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="Lịch sử thay đổi quyền/vai trò trên tài khoản của tôi"
        style={{ marginTop: 16 }}
      >
        <Table
          rowKey="id"
          size="small"
          loading={historyQuery.isLoading}
          dataSource={historyRows}
          pagination={false}
          locale={{
            emptyText: (
              <Empty description="Chưa có thay đổi nào được ghi nhận." />
            ),
          }}
          columns={[
            {
              title: "Thời gian",
              dataIndex: "created_at",
              key: "created_at",
              width: 170,
              render: (value: string) => formatDateTime(value),
            },
            {
              title: "Hành động",
              dataIndex: "action",
              key: "action",
              width: 180,
              render: (value: string) => (
                <Tag>{permissionHistoryActionLabel(value)}</Tag>
              ),
            },
            {
              title: "Lý do",
              dataIndex: "reason",
              key: "reason",
              render: (value: string | null) => value || "—",
            },
          ]}
        />
      </Card>
    </div>
  );
}
