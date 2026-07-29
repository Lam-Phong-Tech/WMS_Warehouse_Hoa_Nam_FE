import { Descriptions, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { NoPermissionState } from "@/shared/components/feedback/NoPermissionState";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Trang 403 - Không có quyền truy cập.
 * Route: /errors/403
 */
export function NoPermissionPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const permissionCodes = useAuthStore((s) => s.permissionCodes);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f5f5f5",
      }}
    >
      <div style={{ maxWidth: 600, width: "100%" }}>
        <NoPermissionState
          title="Không có quyền truy cập"
          description={
            <>
              Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị
              viên để được cấp quyền phù hợp.
              {user && (
                <div style={{ marginTop: 12, textAlign: "left" }}>
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Tài khoản">
                      {user.name || user.email}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {user.email}
                    </Descriptions.Item>
                    <Descriptions.Item label="Quyền hiện tại">
                      {permissionCodes.length > 0 ? (
                        <span>
                          {permissionCodes.slice(0, 5).map((code) => (
                            <Tag
                              key={code}
                              color="blue"
                              style={{ marginBottom: 4 }}
                            >
                              {code}
                            </Tag>
                          ))}
                          {permissionCodes.length > 5 && (
                            <Tag color="default">
                              +{permissionCodes.length - 5} khác
                            </Tag>
                          )}
                        </span>
                      ) : (
                        <Tag color="red">Chưa có quyền nào</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              )}
            </>
          }
          actionText="Quay lại"
          onAction={() => navigate(-1)}
          showHomeButton={true}
        />
      </div>
    </div>
  );
}
