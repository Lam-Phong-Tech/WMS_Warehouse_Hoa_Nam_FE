import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationBurst } from "./notification-burst";
import type { NotificationItem } from "../types/notification.types";

const item = (id: string) => ({ id }) as NotificationItem;

describe("notification burst buffer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("coalesces 50 events into one flush", () => {
    const flush = vi.fn();
    const burst = createNotificationBurst(flush, 400);

    for (let index = 0; index < 50; index += 1) {
      burst.push(item(`burst-${index}`));
    }

    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(399);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0]).toHaveLength(50);
    burst.dispose();
  });

  it("deduplicates ids inside one window and starts a fresh window afterwards", () => {
    const flush = vi.fn();
    const burst = createNotificationBurst(flush, 400);

    burst.push(item("same"));
    burst.push(item("same"));
    burst.push(item("other"));
    vi.advanceTimersByTime(400);
    expect(flush.mock.calls[0][0].map((entry: { id: string }) => entry.id)).toEqual([
      "same",
      "other",
    ]);

    burst.push(item("later"));
    vi.advanceTimersByTime(400);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(
      flush.mock.calls[1][0].map((entry: { id: string }) => entry.id),
    ).toEqual(["later"]);
    burst.dispose();
  });

  it("drops pending events when disposed", () => {
    const flush = vi.fn();
    const burst = createNotificationBurst(flush, 400);

    burst.push(item("cancelled"));
    burst.dispose();
    vi.advanceTimersByTime(400);

    expect(flush).not.toHaveBeenCalled();
  });
});
