import { createNotificationBurst } from "../utils/notification-burst";
import {
  createNotificationTabLeader,
  type NotificationTabLeader,
} from "../utils/notification-tab-leader";
import {
  createNotificationClaims,
  isNotificationEnabled,
} from "../utils/notification-toast";
import {
  profileKeys,
  type ProfilePreferences,
} from "@/modules/auth/types/profile.types";
import { NOTIFICATION_KEYS } from "@/modules/notifications/constants/notification.constants";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { createNotificationToastQueue } from "../utils/notification-toast-queue";
import { useQueryClient } from "@tanstack/react-query";
import { connectEcho, disconnectEcho } from "@/shared/lib/echo";
import { api } from "@/shared/api/axios";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
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
  const isConnected = useNotificationStore((s) => s.isConnected);
  const incrementBy = useNotificationStore((s) => s.incrementBy);
  const setConnected = useNotificationStore((s) => s.setConnected);
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  const resetPresentation = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    pathRef.current = pathname;
    if (pathname.startsWith("/notifications")) resetPresentation.current?.();
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let cancelled = false;
    let leave: (() => void) | null = null;
    let reconcileOnVisible = false;
    let leader: NotificationTabLeader | null = null;
    const claims = createNotificationClaims();
    const pendingIds = new Set<string>();
    const blockedToastIds = new Set<string>();
    const visible = () =>
      !cancelled &&
      useAuthStore.getState().isAuthenticated &&
      useAuthStore.getState().user?.user_id === userId &&
      !document.hidden &&
      !pathRef.current.startsWith("/notifications");
    const toasts = createNotificationToastQueue({ isVisible: visible });
    resetPresentation.current = () => {
      toasts.reset();
      for (const id of pendingIds) blockedToastIds.add(id);
    };

    const handleIncoming = (items: NotificationItem[]): boolean => {
      if (
        cancelled ||
        !useAuthStore.getState().isAuthenticated ||
        useAuthStore.getState().user?.user_id !== userId
      )
        return false;
      const { fresh, needsReconcile } = claims.claim(items);
      if (fresh.length === 0) {
        for (const item of items) {
          pendingIds.delete(item.id);
          blockedToastIds.delete(item.id);
        }
        return false;
      }

      incrementBy(fresh.length);
      const hidden = document.hidden;
      void queryClient.invalidateQueries({
        queryKey: needsReconcile
          ? NOTIFICATION_KEYS.root
          : NOTIFICATION_KEYS.list,
        refetchType: hidden ? "none" : "active",
      });
      if (hidden) reconcileOnVisible = true;

      const preferences = queryClient.getQueryData<ProfilePreferences>(
        profileKeys.preferences(userId),
      );
      const toastable = fresh.filter(
        (item) =>
          !blockedToastIds.has(item.id) &&
          isNotificationEnabled(item, preferences?.notifications),
      );
      if (visible()) toasts.push(toastable);
      for (const item of items) {
        pendingIds.delete(item.id);
        blockedToastIds.delete(item.id);
      }
      return true;
    };

    const burst = createNotificationBurst((items) => {
      if (handleIncoming(items)) leader?.publish(items);
    });

    const connect = () => {
      void connectEcho().then((echo) => {
        if (cancelled || !echo) return;

        const channel = echo.private(`user.${userId}`);
        channel.subscribed(() => {
          setConnected(true);
          // Reconnect may have missed events while offline; reconcile the badge
          // and list with the persisted notification state.
          void queryClient.invalidateQueries({
            queryKey: NOTIFICATION_KEYS.root,
          });
        });
        channel.listen(".notification.created", (payload: NotificationItem) => {
          if (cancelled || useAuthStore.getState().user?.user_id !== userId)
            return;
          if (!payload?.id) return;
          pendingIds.add(payload.id);
          if (!visible()) blockedToastIds.add(payload.id);
          burst.push(payload);
        });
        channel.listen(".auth.session-replaced", () => {
          // The event is sent to every open tab of this account. Ask the server
          // which JWT was displaced; the existing 401 handler shows the notice.
          void api.get(API_ENDPOINTS.ME).catch(() => {});
        });

        leave = () => {
          echo.leave(`user.${userId}`);
          setConnected(false);
        };
      });
    };

    leader = createNotificationTabLeader({
      scope: String(userId),
      onBecomeLeader: connect,
      onItems: handleIncoming,
    });
    leader.start();

    const reconcileWhenVisible = () => {
      if (document.hidden) {
        resetPresentation.current?.();
        return;
      }
      if (!reconcileOnVisible) return;
      reconcileOnVisible = false;
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.root });
    };
    document.addEventListener("visibilitychange", reconcileWhenVisible);

    return () => {
      cancelled = true;
      burst.dispose();
      toasts.dispose();
      resetPresentation.current = null;
      leader?.stop();
      document.removeEventListener("visibilitychange", reconcileWhenVisible);
      leave?.();
    };
  }, [isAuthenticated, userId, incrementBy, setConnected, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectEcho();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    // DEV currently has no Reverb key. Check automatically while the tab is
    // visible so a replaced session is noticed without waiting for a click.
    // Keep a slower backstop even with a socket in case an event was missed.
    let checking = false;
    const checkSession = () => {
      if (document.hidden || checking) return;
      checking = true;
      void api
        .get(API_ENDPOINTS.ME)
        .catch(() => {})
        .finally(() => {
          checking = false;
        });
    };
    const interval = window.setInterval(
      checkSession,
      isConnected ? 15_000 : 3_000,
    );
    document.addEventListener("visibilitychange", checkSession);
    window.addEventListener("focus", checkSession);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkSession);
      window.removeEventListener("focus", checkSession);
    };
  }, [isAuthenticated, userId, isConnected]);
}
