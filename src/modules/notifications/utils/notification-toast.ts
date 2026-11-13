import { toast } from "sonner";
import { tStatic } from "@/shared/i18n/useT";
import type { NotificationItem } from "../types/notification.types";
import { getNotificationText } from "./notification-text";

export const MAX_INDIVIDUAL_TOASTS = 3;
const SUMMARY_ID = "notification-burst-summary";

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

/** Claims belong to one account/socket lifetime. Overflow falls back to canonical DB counts. */
export function createNotificationClaims() {
  const delivered = new Set<string>();
  let needsReconcile = false;
  return {
    claim(items: NotificationItem[]) {
      const fresh: NotificationItem[] = [];
      for (const item of items) {
        if (!item?.id || delivered.has(item.id)) continue;
        delivered.add(item.id);
        fresh.push(item);
        if (delivered.size > 10_000) {
          const oldest = delivered.values().next().value;
          if (oldest !== undefined) delivered.delete(oldest);
          needsReconcile = true;
        }
      }
      return { fresh, needsReconcile };
    },
  };
}

const defaultClaims = createNotificationClaims();
export function claimUndeliveredNotifications(
  items: NotificationItem[],
): NotificationItem[] {
  return defaultClaims.claim(items).fresh;
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
export function showIndividualNotificationToasts(
  items: NotificationItem[],
  limit = MAX_INDIVIDUAL_TOASTS,
): string[] {
  if (items.length === 0) return [];
  const ordered = [...items].sort(
    (left, right) =>
      severityRank(right) - severityRank(left) ||
      createdAt(right) - createdAt(left),
  );
  const individual = ordered.slice(
    0,
    Math.max(0, Math.min(MAX_INDIVIDUAL_TOASTS, Math.floor(limit))),
  );

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

  return individual.map((item) => `notification-${item.id}`);
}

export function showNotificationSummary(
  count: number,
  options: { duration?: number; onDismiss?: () => void } = {},
): void {
  toast.info(tStatic("notifications.burst.title", { count }), {
    description: tStatic("notifications.burst.description"),
    id: SUMMARY_ID,
    ...options,
  });
}

export function dismissNotificationToast(id: string): void {
  toast.dismiss(id);
}

export function dismissNotificationSummary(): void {
  toast.dismiss(SUMMARY_ID);
}

export function showNotificationToasts(
  items: NotificationItem[],
  individualLimit = MAX_INDIVIDUAL_TOASTS,
): void {
  const displayed = showIndividualNotificationToasts(items, individualLimit);
  if (items.length > displayed.length)
    showNotificationSummary(items.length - displayed.length);
}
