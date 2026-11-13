import type { NotificationItem } from "@/modules/notifications/types/notification.types";

const receivers = new Set<(item: NotificationItem) => void>();
export const emitNotification = (item: NotificationItem) =>
  receivers.forEach((receive) => receive(item));
export const hasNotificationConnection = () => receivers.size > 0;
export async function connectEcho() {
  return {
    private() {
      return {
        subscribed(callback: () => void) {
          callback();
        },
        listen(name: string, callback: (item: NotificationItem) => void) {
          if (name === ".notification.created") receivers.add(callback);
        },
      };
    },
    leave() {
      receivers.clear();
    },
  };
}
export function disconnectEcho() {
  receivers.clear();
}
