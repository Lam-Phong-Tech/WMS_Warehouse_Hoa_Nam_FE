import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type { ApiMeta } from "@/shared/types/api-response";
import type {
  NotificationItem,
  NotificationListParams,
} from "@/modules/notifications/types/notification.types";

export const notificationService = {
  list(
    params: NotificationListParams = {},
  ): Promise<{ data: NotificationItem[]; meta: ApiMeta }> {
    return http.getPage<NotificationItem[]>(API_ENDPOINTS.NOTIFICATIONS, {
      params,
    });
  },

  unreadCount(): Promise<{ unread_count: number }> {
    return http.get<{ unread_count: number }>(
      API_ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT,
    );
  },

  markRead(id: string): Promise<NotificationItem> {
    return http.patch<NotificationItem>(
      API_ENDPOINTS.NOTIFICATION_MARK_READ.replace(":id", id),
    );
  },

  markAllRead(): Promise<{ updated_count: number }> {
    return http.post<{ updated_count: number }>(
      API_ENDPOINTS.NOTIFICATIONS_READ_ALL,
    );
  },
};
