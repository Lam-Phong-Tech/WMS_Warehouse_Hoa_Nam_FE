import { Avatar, Card, Descriptions, Space, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { PageHeader } from "@/shared/components";
import { BRAND } from "@/app/theme";
import { useAuthStore } from "@/shared/store/auth.store";

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
    </div>
  );
}
