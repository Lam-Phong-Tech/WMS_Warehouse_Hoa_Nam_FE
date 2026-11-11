import { useCallback } from "react";
import { useT, tStatic, type TranslateFn } from "@/shared/i18n/useT";
import { useLanguageStore, type Language } from "@/shared/i18n/language.store";
import type { NotificationContentKey } from "@/shared/i18n/messages.notification-content";
import type { NotificationItem } from "../types/notification.types";

const events: Readonly<Record<string, NotificationContentKey>> = {
  "inbound.created": "inboundCreated",
  "inbound.scan_started": "inboundScanning",
  "inbound.completed": "inboundCompleted",
  "inbound.cancelled": "inboundCancelled",
  "outbound.created": "outboundCreated",
  "outbound.scan_started": "outboundScanning",
  "outbound.posted": "outboundPosted",
  "outbound.cancelled": "outboundCancelled",
  "inbound.sku_info_pending": "inboundSkuPending",
  "reversal.created": "reversalCreated",
  "reversal.posted": "reversalPosted",
  "reversal.cancelled": "reversalCancelled",
  "stock.shortage_detected": "stockShortage",
  "role.permissions_changed": "rolePermissions",
  "warranty.case_created": "warrantyCreated",
  "warranty.status_changed": "warrantyStatus",
};
const states = {
  RECEIVED: "received",
  CHECKING: "checking",
  REPAIRING: "repairing",
  READY: "ready",
  READY_FOR_RETURN: "ready",
  RETURNED: "returned",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ACTIVE: "active",
  INACTIVE: "inactive",
  LOCKED: "locked",
} as const;

/** Localize system templates at display time; never rewrite cached API data or custom messages. */
export function localizeNotification(
  item: NotificationItem,
  language: Language,
  t: TranslateFn,
) {
  if (item.content_access === "DENIED") {
    return {
      title: t("notifications.accessDenied.title"),
      body: t("notifications.accessDenied.body"),
    };
  }
  const original = { title: item.title, body: item.body };
  const systemEvent =
    Object.hasOwn(events, item.event_key) ||
    item.event_key === "user.account_changed" ||
    item.event_key === "security.alert_raised";
  /**
   * Bản BE cũ đã lưu sẵn câu tiếng Việt dùng từ vay "case". Chuông thông báo
   * đọc đúng dòng đã lưu đó (language = vi trả nguyên bản), nên đổi tại đây để
   * các thông báo đã có — kể cả trước khi backfill DB — hiện "ca" ngay. Chỉ áp
   * cho hai event bảo hành; nội dung tự soạn khác không bị chạm.
   */
  if (language === "vi") {
    // Thông báo hệ thống do BE sinh từng lưu lẫn thuật ngữ "Post Issue" /
    // "Post Receipt". Người dùng Việt đọc chuông phải thấy hành động nghiệp vụ,
    // không phải tên endpoint. Chỉ đổi event hệ thống, không chạm tin tự soạn.
    const operationalTerms = (value: string) =>
      systemEvent
        ? value
            .replace(/\bPost Issue\b/g, "ghi nhận xuất kho")
            .replace(/\bPost Receipt\b/g, "ghi nhận nhập kho")
        : value;
    const title = operationalTerms(item.title);
    const body = operationalTerms(item.body);
    if (
      item.event_key === "warranty.case_created" ||
      item.event_key === "warranty.status_changed"
    ) {
      const toCa = (value: string) =>
        value
          .replace(/Case bảo hành/g, "Ca bảo hành")
          .replace(/case bảo hành/g, "ca bảo hành");
      return { title: toCa(title), body: toCa(body) };
    }
    return { title, body };
  }
  const payload = item.payload ?? {};
  const text = (...values: unknown[]): string => {
    for (const value of values) {
      if (
        (typeof value === "string" || typeof value === "number") &&
        String(value).trim()
      )
        return String(value).trim();
    }
    return "—";
  };
  const status = (value: unknown) => {
    const raw = text(value);
    const key = Object.hasOwn(states, raw)
      ? states[raw as keyof typeof states]
      : undefined;
    return key ? t(`notifications.content.states.${key}`) : raw;
  };
  let key: NotificationContentKey | undefined = Object.hasOwn(
    events,
    item.event_key,
  )
    ? events[item.event_key]
    : undefined;
  if (item.event_key === "user.account_changed")
    key =
      payload.action === "CREATE"
        ? "userCreated"
        : payload.action === "UPDATE"
          ? "userUpdated"
          : payload.action === "AUTO_LOCK"
            ? "userLocked"
            : undefined;
  if (item.event_key === "security.alert_raised") {
    key =
      payload.reason_code === "LOGIN_THROTTLED"
        ? "securityThrottled"
        : payload.reason_code === "LOGIN_DENIED"
          ? "securityDenied"
          : undefined;
  }
  if (!key) return original;
  const legacyDocument = item.body.match(
    /(?:Phiếu (?:nhập|xuất|điều chỉnh)|Reversal)\s+([A-Za-z0-9][A-Za-z0-9._/-]*)/u,
  )?.[1];
  const legacyStatus = item.body.match(/chuyển từ (\w+) sang (\w+)/u);
  const legacyAccount = item.body.match(
    /^Tài khoản (.+) bị từ chối đăng nhập vì đang ở trạng thái (\w+)\.?$/u,
  );
  const skus = Array.isArray(payload.sku_codes)
    ? payload.sku_codes
        .filter((code): code is string => typeof code === "string")
        .join(", ")
    : undefined;
  const vars = {
    document: text(
      payload.doc_no,
      payload.document_no,
      payload.reversal_no,
      legacyDocument,
      payload.document_id,
    ),
    product: text(payload.product_code),
    skus: text(skus, item.body.match(/\(([^)]+)\)/u)?.[1]),
    role: text(payload.role_code, item.body.match(/vai trò (\S+)/u)?.[1]),
    case: text(
      payload.case_code,
      item.body.match(
        /(?:Ca|Case|Hồ sơ) bảo hành ([A-Za-z0-9][A-Za-z0-9._/-]*)/u,
      )?.[1],
    ),
    from: status(payload.from_status ?? legacyStatus?.[1]),
    to: status(payload.to_status ?? payload.status ?? legacyStatus?.[2]),
    account: text(payload.username, legacyAccount?.[1], payload.user_id),
    status: status(payload.status ?? legacyAccount?.[2]),
  };
  return {
    title: t(`notifications.content.${key}.title`, vars),
    body: t(`notifications.content.${key}.body`, vars),
  };
}

export function useNotificationText() {
  const language = useLanguageStore((state) => state.language);
  const t = useT();
  return useCallback(
    (item: NotificationItem) => localizeNotification(item, language, t),
    [language, t],
  );
}

/** Read the current locale for a newly received toast or browser notification. */
export function getNotificationText(item: NotificationItem) {
  return localizeNotification(
    item,
    useLanguageStore.getState().language,
    tStatic,
  );
}
