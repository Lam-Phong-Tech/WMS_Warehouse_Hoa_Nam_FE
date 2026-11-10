import type { NotificationItem } from "../types/notification.types";

export const NOTIFICATION_BURST_WINDOW_MS = 400;
const MAX_PENDING = 1_000;

export interface NotificationBurst {
  push: (item: NotificationItem) => void;
  flush: () => void;
  dispose: () => void;
}

/**
 * Coalesces a burst of realtime notifications so subscribers update state and
 * render once per window instead of once per socket event.
 */
export function createNotificationBurst(
  onFlush: (items: NotificationItem[]) => void,
  windowMs = NOTIFICATION_BURST_WINDOW_MS,
): NotificationBurst {
  let pending = new Map<string, NotificationItem>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const items = Array.from(pending.values());
    pending = new Map();
    onFlush(items);
  };

  return {
    push(item) {
      if (!item?.id) return;
      pending.set(item.id, item);
      if (pending.size > MAX_PENDING) {
        const oldest = pending.keys().next().value;
        if (oldest !== undefined) pending.delete(oldest);
      }
      if (timer === null) timer = setTimeout(flush, windowMs);
    },
    flush,
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}
