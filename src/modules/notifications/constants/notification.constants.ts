import type { NotificationItem } from "@/modules/notifications/types/notification.types";

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
 * Nhãn tiếng Việt cho `event_key` — dùng ở modal chi tiết (mục "Loại thông
 * báo") để phân biệt loại sự kiện, tách khỏi `title` (vốn là câu văn cụ thể
 * đã gắn số phiếu). Khớp đúng eventKey của từng Listener ở
 * Modules/Notification/app/Listeners/*.php.
 */
export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  "inbound.created": "Tạo phiếu nhập",
  "inbound.scan_started": "Bắt đầu quét nhập kho",
  "inbound.completed": "Hoàn tất nhập kho",
  "inbound.cancelled": "Huỷ phiếu nhập",
  "outbound.created": "Tạo phiếu xuất",
  "outbound.scan_started": "Bắt đầu quét xuất kho",
  "outbound.posted": "Post Issue xuất kho",
  "outbound.cancelled": "Huỷ phiếu xuất",
  "reversal.created": "Tạo phiếu điều chỉnh",
  "reversal.posted": "Post điều chỉnh tồn kho",
  "reversal.cancelled": "Huỷ phiếu điều chỉnh",
  "stock.shortage_detected": "Tồn kho không đủ",
  "warranty.case_created": "Tiếp nhận case bảo hành",
  "warranty.status_changed": "Đổi trạng thái case bảo hành",
  "user.account_changed": "Thay đổi tài khoản người dùng",
  "role.permissions_changed": "Thay đổi phân quyền vai trò",
  "security.alert_raised": "Cảnh báo bảo mật đăng nhập",
};

/** Nhãn tiếng Việt cho `source_module` — hiển thị trong modal chi tiết thông báo. */
export const NOTIFICATION_SOURCE_MODULE_LABELS: Record<string, string> = {
  warehouse: "Kho vận",
  auth: "Tài khoản & phân quyền",
  notification: "Hệ thống",
};

/** Nhãn tiếng Việt cho `subject_type` — loại đối tượng nghiệp vụ liên quan tới thông báo. */
export const NOTIFICATION_SUBJECT_TYPE_LABELS: Record<string, string> = {
  stock_document: "Phiếu nhập/xuất kho",
  reversal_document: "Phiếu điều chỉnh (reversal)",
  role: "Vai trò",
  user: "Tài khoản người dùng",
  warranty_case: "Case bảo hành",
};

/**
 * Nhãn tiếng Việt cho từng key trong `payload` — payload là JSON tự do theo
 * từng event_key (xem Modules/Notification/app/Listeners/*.php ở BE), map ở
 * đây để modal chi tiết hiển thị được thay vì in thẳng key kỹ thuật.
 */
export const NOTIFICATION_PAYLOAD_FIELD_LABELS: Record<string, string> = {
  document_id: "Mã phiếu",
  doc_no: "Số phiếu",
  warehouse_id: "Mã kho",
  type: "Loại chứng từ",
  reversal_id: "Mã phiếu điều chỉnh",
  role_id: "Mã vai trò",
  role_code: "Mã code vai trò",
  reason_code: "Mã lý do",
  user_id: "Mã tài khoản",
  case_id: "Mã case bảo hành",
  case_code: "Số case bảo hành",
  product_code: "Mã sản phẩm",
  action: "Hành động",
  from_status: "Trạng thái trước",
  to_status: "Trạng thái sau",
};
