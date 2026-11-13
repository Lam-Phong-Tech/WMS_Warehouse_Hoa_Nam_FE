import type { NotificationItem } from "../types/notification.types";
import { createNotificationToastBudget } from "./notification-toast-budget";
import {
  dismissNotificationSummary,
  dismissNotificationToast,
  showIndividualNotificationToasts,
  showNotificationSummary,
} from "./notification-toast";

export interface NotificationToastQueue {
  push(items: NotificationItem[]): void;
  reset(): void;
  dispose(): void;
}

/** Pending presentation is an expiring count, never a queue of old individual toasts. */
export function createNotificationToastQueue({
  isVisible,
  now = Date.now,
}: {
  isVisible: () => boolean;
  now?: () => number;
}): NotificationToastQueue {
  const budget = createNotificationToastBudget({ now });
  let groups: { at: number; count: number }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastEmission = -Infinity;
  let shownCount = 0;
  let individualIds: string[] = [];
  let dirty = false;
  let disposed = false;

  let summaryGeneration = 0;

  const clearSummary = (dismiss = true) => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    groups = [];
    lastEmission = -Infinity;
    const wasShown = shownCount > 0;
    shownCount = 0;
    dirty = false;
    summaryGeneration += 1;
    if (dismiss && wasShown) dismissNotificationSummary();
  };

  const reset = () => {
    clearSummary();
    individualIds.forEach(dismissNotificationToast);
    individualIds = [];
    // Visibility changes clear presentation, not this account's rolling admission.
  };

  const tick = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (disposed || !isVisible()) {
      reset();
      return;
    }
    const time = now();
    groups = groups.filter((group) => group.at > time - 10_000);
    const count = groups.reduce((sum, group) => sum + group.count, 0);
    if (count === 0) {
      clearSummary();
      return;
    }
    if ((dirty || count !== shownCount) && time - lastEmission >= 1000) {
      const generation = summaryGeneration;
      showNotificationSummary(count, {
        duration: Infinity,
        onDismiss: () => {
          if (generation === summaryGeneration) clearSummary(false);
        },
      });
      shownCount = count;
      lastEmission = time;
      dirty = false;
    }
    timer = setTimeout(
      tick,
      Math.max(
        1,
        Math.min(
          1000,
          groups[0].at + 10_000 - time,
          dirty || count !== shownCount ? lastEmission + 1000 - time : 1000,
        ),
      ),
    );
  };

  return {
    push(items) {
      if (disposed || !isVisible()) {
        reset();
        return;
      }
      if (items.length === 0) return;
      const individual = budget.take(items.length);
      const nextIds = [
        ...individualIds,
        ...showIndividualNotificationToasts(items, individual),
      ];
      nextIds
        .slice(0, Math.max(0, nextIds.length - 3))
        .forEach(dismissNotificationToast);
      individualIds = nextIds.slice(-3);
      const remaining = items.length - individual;
      if (remaining > 0) {
        const time = now();
        const previous = groups.at(-1);
        if (previous?.at === time) previous.count += remaining;
        else groups.push({ at: time, count: remaining });
        dirty = true;
        tick();
      }
    },
    reset,
    dispose() {
      reset();
      budget.reset();
      disposed = true;
    },
  };
}
