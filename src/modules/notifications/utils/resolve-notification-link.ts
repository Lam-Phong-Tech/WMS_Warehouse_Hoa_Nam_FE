import { ROUTES } from "@/shared/constants/routes";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";

export interface NotificationLink {
  path: string;
  label: string;
}

/**
 * Map 1 thông báo sang route mở đúng màn/modal chi tiết nghiệp vụ liên quan.
 * Dùng tiền tố `event_key` (không dùng `subject_type` một mình) vì
 * `subject_type = "stock_document"` dùng chung cho cả phiếu nhập lẫn phiếu
 * xuất — chỉ `event_key` (vd "inbound.completed" vs "outbound.posted") mới
 * phân biệt được. Trả về null khi không có target rõ ràng (thông báo về
 * role/user/security, hoặc "stock.shortage_detected" không tự phân biệt
 * được là phiếu nhập hay phiếu xuất từ payload).
 */
export function resolveNotificationLink(
  item: NotificationItem,
): NotificationLink | null {
  if (!item.subject_id) return null;

  if (item.event_key.startsWith("inbound.")) {
    return {
      path: `${ROUTES.INBOUND}?screen=IN-03&id=${item.subject_id}`,
      label: "Xem phiếu nhập",
    };
  }
  if (item.event_key.startsWith("outbound.")) {
    return {
      path: `${ROUTES.OUTBOUND}?screen=OUT-02&id=${item.subject_id}`,
      label: "Xem phiếu xuất",
    };
  }
  if (item.event_key.startsWith("reversal.")) {
    return {
      path: `${ROUTES.REVERSE}?screen=REV-02&id=${item.subject_id}`,
      label: "Xem phiếu điều chỉnh",
    };
  }
  if (item.event_key.startsWith("warranty.")) {
    return {
      path: `${ROUTES.WARRANTY}?screen=WAR-03&id=${item.subject_id}`,
      label: "Xem case bảo hành",
    };
  }

  return null;
}
