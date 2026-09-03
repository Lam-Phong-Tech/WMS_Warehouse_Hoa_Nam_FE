import type { NotificationItem } from "@/modules/notifications/types/notification.types";
import type { MessageKey } from "@/shared/i18n/messages";

/**
 * Map màu Tag theo severity — dùng chung giữa NotificationBell (dropdown header)
 * và NotificationsPage (trang "Xem tất cả") để tránh định nghĩa trùng lặp.
 * Nhãn hiển thị tiếng Việt tương ứng nằm ở NOTIFICATION_SEVERITY_LABELS
 * (src/shared/constants/business-labels.ts).
 */
export const NOTIFICATION_SEVERITY_COLOR: Record<
  NotificationItem["severity"],
  string
> = {
  info: "blue",
  warning: "gold",
  critical: "red",
};

/**
 * Khoá i18n cho `event_key` — dùng ở modal chi tiết (mục "Loại thông báo") để
 * phân biệt loại sự kiện, tách khỏi `title` (vốn là câu văn cụ thể đã gắn số
 * phiếu). Khớp đúng eventKey của từng Listener ở
 * Modules/Notification/app/Listeners/*.php. Call site tra khoá rồi tự gọi
 * `t()`; thiếu khoá thì hiện thẳng event_key kỹ thuật.
 */
export const NOTIFICATION_EVENT_LABELS: Record<string, MessageKey> = {
  "inbound.created": "notifications.event.inboundCreated",
  "inbound.scan_started": "notifications.event.inboundScanStarted",
  "inbound.completed": "notifications.event.inboundCompleted",
  "inbound.cancelled": "notifications.event.inboundCancelled",
  "outbound.created": "notifications.event.outboundCreated",
  "outbound.scan_started": "notifications.event.outboundScanStarted",
  "outbound.posted": "notifications.event.outboundPosted",
  "outbound.cancelled": "notifications.event.outboundCancelled",
  "reversal.created": "notifications.event.reversalCreated",
  "reversal.posted": "notifications.event.reversalPosted",
  "reversal.cancelled": "notifications.event.reversalCancelled",
  "stock.shortage_detected": "notifications.event.stockShortageDetected",
  "warranty.case_created": "notifications.event.warrantyCaseCreated",
  "warranty.status_changed": "notifications.event.warrantyStatusChanged",
  "user.account_changed": "notifications.event.userAccountChanged",
  "role.permissions_changed": "notifications.event.rolePermissionsChanged",
  "security.alert_raised": "notifications.event.securityAlertRaised",
};

/** Khoá i18n cho `source_module` — hiển thị trong modal chi tiết thông báo. */
export const NOTIFICATION_SOURCE_MODULE_LABELS: Record<string, MessageKey> = {
  warehouse: "notifications.source.warehouse",
  auth: "notifications.source.auth",
  notification: "notifications.source.notification",
};

/** Khoá i18n cho `subject_type` — loại đối tượng nghiệp vụ liên quan tới thông báo. */
export const NOTIFICATION_SUBJECT_TYPE_LABELS: Record<string, MessageKey> = {
  stock_document: "notifications.subject.stockDocument",
  reversal_document: "notifications.subject.reversalDocument",
  role: "notifications.subject.role",
  user: "notifications.subject.user",
  warranty_case: "notifications.subject.warrantyCase",
};

/**
 * Khoá i18n cho từng key trong `payload` — payload là JSON tự do theo từng
 * event_key (xem Modules/Notification/app/Listeners/*.php ở BE), map ở đây để
 * modal chi tiết hiển thị được thay vì in thẳng key kỹ thuật.
 */
export const NOTIFICATION_PAYLOAD_FIELD_LABELS: Record<string, MessageKey> = {
  document_id: "notifications.payload.documentId",
  doc_no: "notifications.payload.docNo",
  warehouse_id: "notifications.payload.warehouseId",
  type: "notifications.payload.type",
  reversal_id: "notifications.payload.reversalId",
  role_id: "notifications.payload.roleId",
  role_code: "notifications.payload.roleCode",
  reason_code: "notifications.payload.reasonCode",
  user_id: "notifications.payload.userId",
  case_id: "notifications.payload.caseId",
  case_code: "notifications.payload.caseCode",
  product_code: "notifications.payload.productCode",
  action: "notifications.payload.action",
  from_status: "notifications.payload.fromStatus",
  to_status: "notifications.payload.toStatus",
};
