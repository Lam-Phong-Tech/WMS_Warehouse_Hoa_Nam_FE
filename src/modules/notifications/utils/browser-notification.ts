import type { NotificationItem } from "../types/notification.types";
const delivered = new Set<string>();
export function browserNotificationCategory(
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
/** Delivery while the authenticated app is open. This does not promise closed-browser Web Push. */
export function deliverBrowserNotification(
  item: NotificationItem,
  preferences?: Record<string, { in_app: boolean; email: boolean }>,
): boolean {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    delivered.has(item.id)
  )
    return false;
  const category = browserNotificationCategory(
    item.event_key,
    item.source_module,
  );
  if (
    category &&
    category !== "account" &&
    preferences?.[category]?.in_app === false
  )
    return false;
  try {
    const notification = new Notification(item.title, {
      body: item.body,
      tag: `hoa-nam-${item.id}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    delivered.add(item.id);
    if (delivered.size > 200)
      delivered.delete(delivered.values().next().value!);
    return true;
  } catch {
    return false;
  }
}
