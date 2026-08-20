import { Avatar, Card, Descriptions, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { PageHeader } from "@/shared/components";
import { BRAND } from "@/app/theme";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Hồ sơ tài khoản hiện tại — chỉ đọc, dữ liệu lấy từ GET /auth/me (đã nạp
 * sẵn vào store). BE chưa có API cập nhật hồ sơ nên trang này không có form
 * sửa.
 */
export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const currentContext = useAuthStore((s) => s.currentContext);

  const displayName =
    profile?.name ?? user?.name ?? user?.code ?? user?.email ?? "Người dùng";
  const email = profile?.email ?? user?.email;

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
            {email && <div style={{ color: "rgba(0,0,0,0.45)" }}>{email}</div>}
          </div>
        </div>

        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="Mã nhân viên">
            {profile?.code ?? user?.code ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">
            {profile?.phone ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Chức vụ">
            {profile?.position?.name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Phòng ban">
            {profile?.department?.name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Chi nhánh">
            {profile?.branch?.name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Công ty">
            {profile?.company?.name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Vai trò">
            {isSuperAdmin ? (
              <Tag color="gold">Super Admin</Tag>
            ) : (
              (profile?.role?.name ?? currentContext?.role_name ?? "—")
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
