import { useState } from "react";
import {
  Badge,
  Box,
  UiSpinner,
  Popover,
  UiIconButton,
  UiStateSurface,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui";
import { BellOutlined } from "@/shared/components/icons";
import { useNavigate } from "react-router-dom";
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
 * Dùng Popover (thay vì Menu) vì nội dung phức tạp hơn 1 danh sách đơn giản:
 * có header với nút hành động, danh sách cuộn dài, nhiều trạng thái tải/lỗi/rỗng,
 * và từng dòng có hành động click riêng (đánh dấu đã đọc + mở chi tiết).
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDropdownOpen = useNotificationStore((s) => s.isDropdownOpen);
  const setDropdownOpen = useNotificationStore((s) => s.setDropdownOpen);
  // ?? 0 phòng thủ nhẹ: nếu BE/parse trả thiếu unread_count thì badge và
  // aria-label không hiển thị NaN/undefined.
  // `?? 0` không chặn được NaN (NaN không phải null/undefined) — store có thể
  // nhận Number(undefined) từ payload lỗi; badge sẽ hiện chữ "NaN" nếu lọt.
  const rawUnreadCount = useNotificationStore((s) => s.unreadCount);
  const unreadCount = Number.isFinite(rawUnreadCount) ? rawUnreadCount : 0;
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useUnreadCountQuery(isAuthenticated);
  const { data, isLoading, isError, error, refetch } = useNotificationsQuery({
    per_page: 8,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Phòng thủ render: mock/payload lỗi có thể trả object thay mảng — antd List
  // cũ nuốt lặng, ul/li tự dựng thì .map sẽ throw và sập cả shell.
  const items = Array.isArray(data?.data) ? data.data : [];

  const handleClose = () => {
    setAnchorEl(null);
    setDropdownOpen(false);
  };

  return (
    <>
      <Badge badgeContent={unreadCount} color="error" overlap="circular">
        <UiIconButton
          aria-label={
            unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"
          }
          onClick={(e) => {
            setAnchorEl(e.currentTarget);
            setDropdownOpen(true);
          }}
        >
          <BellOutlined />
        </UiIconButton>
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
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: "14px",
              py: "10px",
              borderBottom: `1px solid ${S.border}`,
            }}
          >
            <Box component="strong" sx={{ color: S.textHigh }}>
              Thông báo
            </Box>
            <ActionButton
              kind="confirm"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Đánh dấu đã đọc hết
            </ActionButton>
          </Box>

          {isError ? (
            <ApiErrorAlert
              error={error}
              title="Không tải được thông báo"
              onRetry={() => void refetch()}
              style={{ margin: 12 }}
            />
          ) : isLoading ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <UiSpinner size={18} />
            </Box>
          ) : items.length === 0 ? (
            <UiStateSurface kind="empty" title="Chưa có thông báo" />
          ) : (
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
                    px: "14px",
                    py: "10px",
                    cursor: "pointer",
                    bgcolor: item.read_at ? "transparent" : S.primarySoft,
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
                      <Box
                        component="strong"
                        sx={{ fontSize: 13, color: S.textHigh }}
                      >
                        {item.title}
                      </Box>
                      <StatusTag
                        status={item.severity}
                        colorMap={NOTIFICATION_SEVERITY_COLOR}
                        labelMap={NOTIFICATION_SEVERITY_LABELS}
                        sx={{ marginInlineEnd: 0 }}
                      />
                    </Box>
                    <Box sx={{ fontSize: 12, color: S.textMedium }}>
                      {item.body}
                    </Box>
                    <Box sx={{ mt: "2px", fontSize: 11, color: S.textMedium }}>
                      {formatDateTime(item.created_at)}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Box
            sx={{
              textAlign: "center",
              p: 1,
              borderTop: `1px solid ${S.border}`,
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
          </Box>
        </Box>
      </Popover>
      <NotificationDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onNavigate={() => handleClose()}
      />
    </>
  );
}
