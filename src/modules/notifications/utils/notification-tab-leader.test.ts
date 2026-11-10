import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotificationTabLeader } from "./notification-tab-leader";
import type { NotificationItem } from "../types/notification.types";

const item = (id: string) => ({ id }) as NotificationItem;

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  posted: unknown[] = [];
  closed = false;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  close() {
    this.closed = true;
  }
}

const installLocks = () => {
  let callback: (() => Promise<void>) | null = null;
  const request = vi.fn(
    (
      _name: string,
      _options: { signal: AbortSignal },
      next: () => Promise<void>,
    ) => {
      callback = next;
      return new Promise<void>(() => {});
    },
  );
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request },
  });
  return {
    request,
    invoke: async () => {
      await callback?.();
    },
  };
};

afterEach(() => {
  FakeBroadcastChannel.instances = [];
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "locks");
});

describe("notification tab leader", () => {
  it("becomes leader only when the cross-tab lock is acquired", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const locks = installLocks();
    const onBecomeLeader = vi.fn();
    const leader = createNotificationTabLeader({
      scope: "user-1",
      onBecomeLeader,
      onItems: vi.fn(),
    });

    leader.start();
    expect(locks.request).toHaveBeenCalledWith(
      "hoanam-notification-leader",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      expect.any(Function),
    );
    expect(onBecomeLeader).not.toHaveBeenCalled();
    expect(leader.isLeader()).toBe(false);

    const running = locks.invoke();
    await Promise.resolve();
    expect(onBecomeLeader).toHaveBeenCalledTimes(1);
    expect(leader.isLeader()).toBe(true);
    leader.stop();
    await running;
  });

  it("relays same-scope notification items and ignores another account", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const locks = installLocks();
    const onItems = vi.fn();
    const leader = createNotificationTabLeader({
      scope: "user-1",
      onBecomeLeader: vi.fn(),
      onItems,
    });

    leader.start();
    const running = locks.invoke();
    await Promise.resolve();
    const channel = FakeBroadcastChannel.instances[0];
    leader.publish([item("n-1")]);
    expect(channel.posted).toEqual([
      {
        type: "notification.created",
        scope: "user-1",
        items: [item("n-1")],
      },
    ]);

    channel.onmessage?.({
      data: {
        type: "notification.created",
        scope: "user-1",
        items: [item("n-2")],
      },
    } as MessageEvent);
    expect(onItems).toHaveBeenCalledWith([item("n-2")]);

    channel.onmessage?.({
      data: {
        type: "notification.created",
        scope: "user-2",
        items: [item("n-3")],
      },
    } as MessageEvent);
    expect(onItems).toHaveBeenCalledTimes(1);
    leader.stop();
    expect(channel.closed).toBe(true);
    await running;
  });

  it("falls back to one connection per tab when locks are unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const onBecomeLeader = vi.fn();
    const leader = createNotificationTabLeader({
      scope: "user-1",
      onBecomeLeader,
      onItems: vi.fn(),
    });

    leader.start();
    expect(onBecomeLeader).toHaveBeenCalledTimes(1);
    expect(leader.isLeader()).toBe(true);
    leader.publish([item("fallback")]);
    leader.stop();
  });
});
