import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEcho, disconnectEcho } from "@/shared/lib/echo";
import { useAuthStore } from "@/shared/store/auth.store";
import { useNotificationStore } from "@/shared/store/notification.store";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";

/**
 * Subscribe channel private `user.{id}` sau khi có phiên đăng nhập. Không có
 * VITE_REVERB_APP_KEY (hoặc Reverb down) thì getEcho() trả null — bảng chuông
 * chỉ mất realtime, GET /notifications định kỳ/khi mở dropdown vẫn hoạt động.
 */
export function useNotificationSocket(): void {
  const userId = useAuthStore((s) => s.user?.user_id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const increment = useNotificationStore((s) => s.increment);
  const setConnected = useNotificationStore((s) => s.setConnected);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const echo = getEcho();
    if (!echo) return;

    const channel = echo.private(`user.${userId}`);
    channel.subscribed(() => setConnected(true));
    channel.listen(".notification.created", (payload: NotificationItem) => {
      increment();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (payload.severity === "warning" || payload.severity === "critical") {
        toast.warning(payload.title, { description: payload.body });
      }
    });

    return () => {
      echo.leave(`user.${userId}`);
      setConnected(false);
    };
  }, [isAuthenticated, userId, increment, setConnected, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectEcho();
    }
  }, [isAuthenticated]);
}
