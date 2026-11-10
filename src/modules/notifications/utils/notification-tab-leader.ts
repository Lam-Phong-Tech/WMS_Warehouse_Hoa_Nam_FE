import type { NotificationItem } from "../types/notification.types";

const LOCK_NAME = "hoanam-notification-leader";
const CHANNEL_NAME = "hoanam-notification-bus";

export interface NotificationTabLeader {
  start: () => void;
  publish: (items: NotificationItem[]) => void;
  stop: () => void;
  isLeader: () => boolean;
}

interface NotificationTabLeaderOptions {
  scope: string;
  onBecomeLeader: () => void;
  onItems: (items: NotificationItem[]) => void;
}

interface LeaderMessage {
  type: "notification.created";
  scope: string;
  items: NotificationItem[];
}

function supportsLeaderElection(): boolean {
  return (
    typeof BroadcastChannel !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.locks?.request === "function"
  );
}

/**
 * One tab owns the Echo connection; other tabs receive the same notification
 * batch over BroadcastChannel. When the leader closes, the browser releases the
 * lock and the next tab connects without duplicating WebSocket connections.
 */
export function createNotificationTabLeader({
  scope,
  onBecomeLeader,
  onItems,
}: NotificationTabLeaderOptions): NotificationTabLeader {
  let started = false;
  let stopped = false;
  let leader = false;
  let channel: BroadcastChannel | null = null;
  let abort: AbortController | null = null;
  let releaseLock: (() => void) | null = null;

  const start = () => {
    if (started) return;
    started = true;

    if (!supportsLeaderElection()) {
      // Older browsers keep the previous per-tab behaviour.
      leader = true;
      onBecomeLeader();
      return;
    }

    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<LeaderMessage>) => {
      const data = event.data;
      if (
        data?.type === "notification.created" &&
        data.scope === scope &&
        Array.isArray(data.items)
      ) {
        onItems(data.items);
      }
    };

    abort = new AbortController();
    const locks = navigator.locks;
    void locks
      .request(LOCK_NAME, { signal: abort.signal }, async () => {
        if (stopped) return;
        leader = true;
        onBecomeLeader();
        await new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        leader = false;
      })
      .catch(() => {
        // An aborted wait means this tab is closing; no recovery is needed.
      });
  };

  const publish = (items: NotificationItem[]) => {
    if (!leader || !channel || items.length === 0) return;
    channel.postMessage({
      type: "notification.created",
      scope,
      items,
    } satisfies LeaderMessage);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    leader = false;
    releaseLock?.();
    releaseLock = null;
    abort?.abort();
    abort = null;
    channel?.close();
    channel = null;
  };

  return {
    start,
    publish,
    stop,
    isLeader: () => leader,
  };
}
