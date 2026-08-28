import { useState } from "react";
import { Box, UiCard, UiPagination, SEMANTIC_LIGHT as S } from "@/shared/ui";
import { PageHeader, EmptyState, LoadingState } from "@/shared/components";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
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
import { NotificationDetailModal } from "@/modules/notifications/components/NotificationDetailModal";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";
import { ActionButton } from "@/shared/components/actions";

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const perPage = 15;
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [selected, setSelected] = useState<NotificationItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useNotificationsQuery({
    page,
    per_page: perPage,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Phòng thủ render như NotificationBell: payload không phải mảng → coi là rỗng.
  const items = Array.isArray(data?.data) ? data.data : [];
  const total = data?.meta?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Thông báo"
        subtitle="Toàn bộ thông báo hệ thống liên quan tới bạn — nhập/xuất kho, bảo hành, tài khoản, bảo mật."
        extra={
          <ActionButton
            kind="confirm"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Đánh dấu tất cả đã đọc
          </ActionButton>
        }
      />

      <UiCard>
        {isError ? (
          <ApiErrorAlert
            error={error}
            title="Không tải được thông báo"
            onRetry={() => void refetch()}
          />
        ) : isLoading && items.length === 0 ? (
          <LoadingState tip="Đang tải thông báo..." minHeight={320} />
        ) : !isLoading && items.length === 0 ? (
          <EmptyState
            title="Chưa có thông báo"
            description="Bạn chưa nhận được thông báo nào."
          />
        ) : (
          <>
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {items.map((item) => (
                <Box
                  component="li"
                  key={item.id}
                  onClick={() => {
                    if (!item.read_at) markRead.mutate(item.id);
                    setSelected(item);
                  }}
                  sx={{
                    bgcolor: item.read_at ? "transparent" : S.primarySoft,
                    px: 2,
                    py: 1.5,
                    cursor: "pointer",
                    borderBottom: `1px solid ${S.border}`,
                    "&:last-child": { borderBottom: 0 },
                  }}
                >
                  <Box sx={{ width: "100%" }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 1,
                      }}
                    >
                      <Box component="strong" sx={{ color: S.textHigh }}>
                        {item.title}
                      </Box>
                      <StatusTag
                        status={item.severity}
                        colorMap={NOTIFICATION_SEVERITY_COLOR}
                        labelMap={NOTIFICATION_SEVERITY_LABELS}
                      />
                    </Box>
                    <Box component="span" sx={{ color: S.textMedium }}>
                      {item.body}
                    </Box>
                    <Box sx={{ fontSize: 12, color: S.textMedium }}>
                      {formatDateTime(item.created_at)}
                      {item.read_at ? " · Đã đọc" : ""}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
              <UiPagination
                page={page}
                pageSize={perPage}
                total={total}
                onPageChange={setPage}
                showTotal={false}
              />
            </Box>
          </>
        )}
      </UiCard>

      <NotificationDetailModal
        item={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
