import { useState } from "react";
import { Button, Card, List, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { PageHeader, EmptyState, LoadingState } from "@/shared/components";
import { StatusTag } from "@/shared/components/data-display/StatusTag";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
} from "@/modules/notifications/hooks/useNotifications";
import { useNotificationStore } from "@/shared/store/notification.store";
import { NOTIFICATION_SEVERITY_COLOR } from "@/modules/notifications/constants/notification.constants";
import { NOTIFICATION_SEVERITY_LABELS } from "@/shared/constants/business-labels";
import { formatDateTime } from "@/shared/utils/format-date";

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const perPage = 15;
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const { data, isLoading } = useNotificationsQuery({
    page,
    per_page: perPage,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Thông báo"
        subtitle="Toàn bộ thông báo hệ thống liên quan tới bạn — nhập/xuất kho, bảo hành, tài khoản, bảo mật."
        extra={
          <Button
            icon={<CheckOutlined />}
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />

      <Card variant="borderless">
        {isLoading && items.length === 0 ? (
          <LoadingState tip="Đang tải thông báo..." minHeight={320} />
        ) : !isLoading && items.length === 0 ? (
          <EmptyState
            title="Chưa có thông báo"
            description="Bạn chưa nhận được thông báo nào."
          />
        ) : (
          <List
            dataSource={items}
            loading={isLoading}
            pagination={{
              current: page,
              pageSize: perPage,
              total,
              onChange: setPage,
            }}
            renderItem={(item) => (
              <List.Item
                style={{
                  background: item.read_at ? "transparent" : "#f4f8ff",
                  padding: "12px 16px",
                  cursor: item.read_at ? "default" : "pointer",
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
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <StatusTag
                      status={item.severity}
                      colorMap={NOTIFICATION_SEVERITY_COLOR}
                      labelMap={NOTIFICATION_SEVERITY_LABELS}
                    />
                  </div>
                  <Typography.Text type="secondary">
                    {item.body}
                  </Typography.Text>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(item.created_at)}
                      {item.read_at ? " · Đã đọc" : ""}
                    </Typography.Text>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
