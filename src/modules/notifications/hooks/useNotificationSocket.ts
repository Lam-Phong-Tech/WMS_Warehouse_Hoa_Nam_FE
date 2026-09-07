import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { connectEcho, disconnectEcho } from "@/shared/lib/echo";
import { useAuthStore } from "@/shared/store/auth.store";
import { useNotificationStore } from "@/shared/store/notification.store";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";

/**
 * Subscribe channel private `user.{id}` sau khi có phiên đăng nhập. Không có
 * VITE_REVERB_APP_KEY (hoặc Reverb down) thì `connectEcho()` trả null — bảng
 * chuông chỉ mất realtime, GET /notifications khi mở dropdown vẫn hoạt động.
 *
 * `connectEcho()` là BẤT ĐỒNG BỘ vì laravel-echo + pusher-js nay nạp lười (~110 KB
 * không còn nằm trên đường tới hạn của mỗi lần F5 — xem shared/lib/echo.ts).
 * Effect vì thế phải chống hai tình huống: unmount trước khi thư viện về, và
 * người dùng đăng xuất giữa chừng.
 */
export function useNotificationSocket(): void {
  const userId = useAuthStore((s) => s.user?.user_id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const increment = useNotificationStore((s) => s.increment);
  const setConnected = useNotificationStore((s) => s.setConnected);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let cancelled = false;
    let leave: (() => void) | null = null;

    void connectEcho().then((echo) => {
      if (cancelled || !echo) return;

      const channel = echo.private(`user.${userId}`);
      channel.subscribed(() => setConnected(true));
      channel.listen(".notification.created", (payload: NotificationItem) => {
        increment();
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        if (payload.severity === "warning" || payload.severity === "critical") {
          toast.warning(payload.title, { description: payload.body });
        }
      });

      leave = () => {
        echo.leave(`user.${userId}`);
        setConnected(false);
      };
    });

    return () => {
      cancelled = true;
      leave?.();
    };
  }, [isAuthenticated, userId, increment, setConnected, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectEcho();
    }
  }, [isAuthenticated]);
}
