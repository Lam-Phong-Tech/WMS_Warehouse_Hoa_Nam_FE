import type { NotificationItem } from "@/modules/notifications/types/notification.types";

/**
 * Map màu Tag theo severity — dùng chung giữa NotificationBell (dropdown header)
 * và NotificationsPage (trang "Xem tất cả") để tránh định nghĩa trùng lặp.
 * Nhãn hiển thị tiếng Việt tương ứng nằm ở NOTIFICATION_SEVERITY_LABELS
 * (src/shared/constants/business-labels.ts).
 */
export const NOTIFICATION_SEVERITY_COLOR: Record<NotificationItem["severity"], string> = {
  info: "blue",
  warning: "gold",
  critical: "red",
};
