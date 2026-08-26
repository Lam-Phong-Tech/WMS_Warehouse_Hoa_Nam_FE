import { Badge, Button, Dropdown, Empty, List, Spin, Typography } from "antd";
import { BellOutlined, CheckOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { layoutStyles } from "@/app/layouts/layout.styles";
import { useNotificationStore } from "@/shared/store/notification.store";
import { ROUTES } from "@/shared/constants/routes";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "@/modules/notifications/hooks/useNotifications";
import { useAuthStore } from "@/shared/store/auth.store";
import { NOTIFICATION_SEVERITY_COLOR } from "@/modules/notifications/constants/notification.constants";
import { NOTIFICATION_SEVERITY_LABELS } from "@/shared/constants/business-labels";
import { StatusTag } from "@/shared/components/data-display/StatusTag";
import { formatDateTime } from "@/shared/utils/format-date";

/** Bảng chuông thông báo — thay chỗ nút disabled cũ trong AppHeader. */
export function NotificationBell() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDropdownOpen = useNotificationStore((s) => s.isDropdownOpen);
  const setDropdownOpen = useNotificationStore((s) => s.setDropdownOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useUnreadCountQuery(isAuthenticated);
  const { data, isLoading } = useNotificationsQuery({ per_page: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.data ?? [];

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      open={isDropdownOpen}
      onOpenChange={setDropdownOpen}
      popupRender={() => (
        <div
          style={{
            width: 360,
            maxHeight: 420,
            overflowY: "auto",
            background: "#fff",
            borderRadius: 4,
            boxShadow: "0 4px 16px rgba(0,0,0,.14)",
            border: "1px solid #e5e1d8",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderBottom: "1px solid #eee",
            }}
          >
            <Typography.Text strong>Thông báo</Typography.Text>
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Đánh dấu đã đọc hết
            </Button>
          </div>

          {isLoading ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <Spin size="small" />
            </div>
          ) : items.length === 0 ? (
            <Empty
              description="Chưa có thông báo"
              style={{ padding: 24 }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              dataSource={items}
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    background: item.read_at ? "transparent" : "#f4f8ff",
                  }}
                  onClick={() => {
                    if (!item.read_at) markRead.mutate(item.id);
                  }}
                >
                  <div style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {item.title}
                      </Typography.Text>
                      <StatusTag
                        status={item.severity}
                        colorMap={NOTIFICATION_SEVERITY_COLOR}
                        labelMap={NOTIFICATION_SEVERITY_LABELS}
                        style={{ marginInlineEnd: 0 }}
                      />
                    </div>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12, display: "block" }}
                    >
                      {item.body}
                    </Typography.Text>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 11, display: "block", marginTop: 2 }}
                    >
                      {formatDateTime(item.created_at)}
                    </Typography.Text>
                  </div>
                </List.Item>
              )}
            />
          )}

          <div style={{ textAlign: "center", padding: 8, borderTop: "1px solid #eee" }}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setDropdownOpen(false);
                navigate(ROUTES.NOTIFICATIONS);
              }}
            >
              Xem tất cả
            </Button>
          </div>
        </div>
      )}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 4]}>
        <Button
          type="text"
          aria-label={
            unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"
          }
          icon={<BellOutlined />}
          style={layoutStyles.headerToggleButton}
        />
      </Badge>
    </Dropdown>
  );
}
