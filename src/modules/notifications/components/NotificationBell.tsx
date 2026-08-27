import { useState } from "react";
import { Badge, Button, Empty, List, Spin, Typography } from "antd";
import { Box, Popover, ThemeProvider } from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import { BellOutlined } from "@/shared/components/icons";
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
import { NotificationDetailModal } from "@/modules/notifications/components/NotificationDetailModal";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";
import { ActionButton } from "@/shared/components/actions";

/**
 * Bảng chuông thông báo — thay chỗ nút disabled cũ trong AppHeader.
 * Dùng MUI Popover (thay vì Menu) vì nội dung phức tạp hơn 1 danh sách đơn giản:
 * có header với nút hành động, danh sách cuộn dài, nhiều trạng thái tải/lỗi/rỗng,
 * và từng dòng có hành động click riêng (đánh dấu đã đọc + mở chi tiết).
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDropdownOpen = useNotificationStore((s) => s.isDropdownOpen);
  const setDropdownOpen = useNotificationStore((s) => s.setDropdownOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useUnreadCountQuery(isAuthenticated);
  const { data, isLoading, isError, error, refetch } = useNotificationsQuery({
    per_page: 8,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.data ?? [];

  const handleClose = () => {
    setAnchorEl(null);
    setDropdownOpen(false);
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <>
        <Badge count={unreadCount} size="small" offset={[-2, 4]}>
          <Button
            type="text"
            aria-label={
              unreadCount > 0
                ? `Thông báo, ${unreadCount} chưa đọc`
                : "Thông báo"
            }
            icon={<BellOutlined />}
            style={layoutStyles.headerToggleButton}
            onClick={(e) => {
              setAnchorEl(e.currentTarget);
              setDropdownOpen(true);
            }}
          />
        </Badge>
        <Popover
          open={isDropdownOpen && Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box
            sx={{
              width: 360,
              maxHeight: 420,
              overflowY: "auto",
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
              <ActionButton
                kind="confirm"
                disabled={unreadCount === 0 || markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                Đánh dấu đã đọc hết
              </ActionButton>
            </div>

            {isError ? (
              <ApiErrorAlert
                error={error}
                title="Không tải được thông báo"
                onRetry={() => void refetch()}
                style={{ margin: 12 }}
              />
            ) : isLoading ? (
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
                      setSelected(item);
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

            <div
              style={{
                textAlign: "center",
                padding: 8,
                borderTop: "1px solid #eee",
              }}
            >
              <ActionButton
                kind="view"
                onClick={() => {
                  handleClose();
                  navigate(ROUTES.NOTIFICATIONS);
                }}
              >
                Xem tất cả
              </ActionButton>
            </div>
          </Box>
        </Popover>
        <NotificationDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onNavigate={() => handleClose()}
        />
      </>
    </ThemeProvider>
  );
}
