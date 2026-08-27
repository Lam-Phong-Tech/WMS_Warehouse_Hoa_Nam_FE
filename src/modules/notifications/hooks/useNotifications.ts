import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationService } from "@/modules/notifications/services/notificationService";
import { useNotificationStore } from "@/shared/store/notification.store";
import { getMutationErrorMessage } from "@/shared/api/api-error";
import type { NotificationListParams } from "@/modules/notifications/types/notification.types";

const NOTIFICATIONS_KEY = ["notifications"];
const UNREAD_COUNT_KEY = ["notifications", "unread-count"];

export function useNotificationsQuery(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, params],
    queryFn: () => notificationService.list(params),
    staleTime: 15 * 1000,
  });
}

/** Bootstrap badge từ BE — gọi 1 lần khi có phiên đăng nhập, sau đó Echo tự cộng dồn realtime. */
export function useUnreadCountQuery(enabled: boolean) {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async () => {
      const result = await notificationService.unreadCount();
      setUnreadCount(result.unread_count);
      return result;
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const decrement = useNotificationStore((s) => s.setUnreadCount);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      decrement(Math.max(0, unreadCount - 1));
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}
