import { toast } from "sonner";
import { tStatic } from "@/shared/i18n/useT";
import type { NotificationItem } from "../types/notification.types";
import { getNotificationText } from "./notification-text";

export const MAX_INDIVIDUAL_TOASTS = 3;
const delivered = new Set<string>();

export type NotificationPreferences = Record<
  string,
  { in_app: boolean; email: boolean }
>;

export function notificationCategory(
  event: string,
  module: string,
): string | null {
  const key = event.toLowerCase();
  const domain = module.toLowerCase();
  if (/^(user|role|security)\./.test(key) || domain === "auth")
    return "account";
  if (/^(inbound|outbound)\./.test(key)) return "stock_documents";
  if (/^(stock|reversal)\./.test(key) || domain === "inventory")
    return "inventory";
  if (key.startsWith("warranty.") || ["warranty", "component"].includes(domain))
    return "warranty";
  return null;
}

export function isNotificationEnabled(
  item: NotificationItem,
  preferences?: NotificationPreferences,
): boolean {
  const category = notificationCategory(item.event_key, item.source_module);
  return (
    category === null ||
    category === "account" ||
    preferences?.[category]?.in_app !== false
  );
}

export function notificationToastType(
  item: NotificationItem,
): "info" | "warning" | "error" {
  if (item.severity === "critical") return "error";
  if (item.severity === "warning") return "warning";
  return "info";
}

/** Mark ids as delivered so duplicate socket events cannot inflate the badge or repeat a toast. */
export function claimUndeliveredNotifications(
  items: NotificationItem[],
): NotificationItem[] {
  const fresh: NotificationItem[] = [];
  for (const item of items) {
    if (!item?.id || delivered.has(item.id)) continue;
    delivered.add(item.id);
    fresh.push(item);
  }
  while (delivered.size > 200) {
    const oldest = delivered.values().next().value;
    if (oldest === undefined) break;
    delivered.delete(oldest);
  }
  return fresh;
}

function severityRank(item: NotificationItem): number {
  if (item.severity === "critical") return 3;
  if (item.severity === "warning") return 2;
  return 1;
}

function createdAt(item: NotificationItem): number {
  const value = Date.parse(item.created_at);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Render a batch inside the single global Sonner Toaster. A burst shows at
 * most three individual messages, then one summary; it never creates a storm
 * of dozens of toasts.
 */
export function showNotificationToasts(items: NotificationItem[]): void {
  if (items.length === 0) return;
  const ordered = [...items].sort(
    (left, right) =>
      severityRank(right) - severityRank(left) ||
      createdAt(right) - createdAt(left),
  );
  const individual = ordered.slice(0, MAX_INDIVIDUAL_TOASTS);

  for (const item of individual) {
    const copy = getNotificationText(item);
    const options = {
      description: copy.body,
      id: `notification-${item.id}`,
    };
    const type = notificationToastType(item);
    if (type === "error") toast.error(copy.title, options);
    else if (type === "warning") toast.warning(copy.title, options);
    else toast.info(copy.title, options);
  }

  const remaining = items.length - individual.length;
  if (remaining > 0) {
    toast.info(tStatic("notifications.burst.title", { count: remaining }), {
      description: tStatic("notifications.burst.description"),
      id: "notification-burst-summary",
    });
  }
}
