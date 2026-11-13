import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationItem } from "../types/notification.types";

const { calls, dismiss } = vi.hoisted(() => ({
  calls: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { info: calls, warning: calls, error: calls, dismiss },
}));
import { createNotificationToastQueue } from "./notification-toast-queue";

const items = (count: number) =>
  Array.from(
    { length: count },
    (_, i) =>
      ({
        id: `id-${i}`,
        event_key: "custom.notice",
        source_module: "notification",
        title: "Notice",
        body: "Details",
        severity: "info",
        created_at: "2026-11-13T00:00:00Z",
      }) as NotificationItem,
  );

describe("bounded notification presentation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it("updates the same summary at most once per second and prunes each rolling count", () => {
    const emissions: number[] = [];
    calls.mockImplementation((_title, options) => {
      if (options.id === "notification-burst-summary")
        emissions.push(Date.now());
    });
    const queue = createNotificationToastQueue({ isVisible: () => true });
    queue.push(items(10));
    vi.advanceTimersByTime(100);
    queue.push(items(2));
    expect(emissions).toEqual([0]);
    vi.advanceTimersByTime(900);
    expect(emissions).toEqual([0, 1000]);
    expect(calls).toHaveBeenLastCalledWith(
      "9 thông báo mới",
      expect.objectContaining({ id: "notification-burst-summary" }),
    );
    vi.advanceTimersByTime(9000);
    expect(calls).toHaveBeenLastCalledWith(
      "2 thông báo mới",
      expect.objectContaining({ id: "notification-burst-summary" }),
    );
    vi.advanceTimersByTime(100);
    expect(dismiss).toHaveBeenCalledWith("notification-burst-summary");
    queue.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels every delayed presentation when visibility changes or the queue is disposed", () => {
    let visible = true;
    const queue = createNotificationToastQueue({ isVisible: () => visible });
    queue.push(items(10));
    vi.advanceTimersByTime(100);
    queue.push(items(10));
    const before = calls.mock.calls.length;
    visible = false;
    vi.advanceTimersByTime(11000);
    expect(calls).toHaveBeenCalledTimes(before);
    expect(dismiss).toHaveBeenCalled();
    visible = true;
    queue.push(items(1));
    expect(calls).toHaveBeenCalledTimes(before + 1);
    queue.dispose();
    queue.push(items(10));
    vi.advanceTimersByTime(11000);
    expect(calls).toHaveBeenCalledTimes(before + 1);
  });
  it("dismisses its individual toasts when the account presentation is disposed", () => {
    const queue = createNotificationToastQueue({ isVisible: () => true });
    queue.push(items(3));
    queue.dispose();
    for (let i = 0; i < 3; i++)
      expect(dismiss).toHaveBeenCalledWith(`notification-id-${i}`);
  });
  it("keeps the same rolling admission budget when presentation is reset", () => {
    const queue = createNotificationToastQueue({ isVisible: () => true });
    queue.push(items(3));
    vi.advanceTimersByTime(100);
    queue.reset();
    queue.push(items(3));
    const personal = calls.mock.calls.filter(
      ([, options]) => options.id !== "notification-burst-summary",
    );
    expect(personal).toHaveLength(3);
    expect(calls).toHaveBeenLastCalledWith(
      "3 thông báo mới",
      expect.objectContaining({ id: "notification-burst-summary" }),
    );
    queue.dispose();
  });

  it("dismisses retired tracked IDs so hover-paused toasts cannot survive account cleanup", () => {
    const queue = createNotificationToastQueue({ isVisible: () => true });
    queue.push(items(3));
    vi.advanceTimersByTime(10001);
    queue.push(items(3).map((item) => ({ ...item, id: `next-${item.id}` })));
    for (let i = 0; i < 3; i++)
      expect(dismiss).toHaveBeenCalledWith(`notification-id-${i}`);
    queue.dispose();
    for (let i = 0; i < 3; i++)
      expect(dismiss).toHaveBeenCalledWith(`notification-next-id-${i}`);
  });

  it("owns the summary lifetime and honors manual dismissal without replaying old counts", () => {
    const queue = createNotificationToastQueue({ isVisible: () => true });
    queue.push(items(10));
    const options = calls.mock.calls.at(-1)![1];
    expect(options.duration).toBe(Infinity);
    expect(options.onDismiss).toBeTypeOf("function");
    options.onDismiss();
    const before = calls.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveBeenCalledTimes(before);
    queue.push(items(1));
    expect(calls).toHaveBeenLastCalledWith(
      "1 thông báo mới",
      expect.objectContaining({ id: "notification-burst-summary" }),
    );
    queue.dispose();
  });
});
