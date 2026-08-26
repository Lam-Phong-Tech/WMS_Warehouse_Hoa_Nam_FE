export const UNKNOWN_BUSINESS_LABEL = "Chưa xác định";

export function businessLabel(
  labels: Readonly<Record<string, string>>,
  value: string | null | undefined,
  fallback = UNKNOWN_BUSINESS_LABEL,
): string {
  const key = String(value ?? "").trim();
  if (!key) return fallback;
  return labels[key] ?? fallback;
}

export const INBOUND_STATUS_LABELS = {
  DRAFT: "Nháp",
  SCANNING: "Đang quét nhận hàng",
  POSTED: "Đã nhập kho",
  CANCELLED: "Đã hủy",
} as const;

export const OUTBOUND_STATUS_LABELS = {
  DRAFT: "Nháp",
  SCANNING: "Đang quét xuất hàng",
  POSTED: "Đã xuất kho",
  CANCELLED: "Đã hủy",
} as const;

export const SCAN_RESULT_LABELS = {
  VALID: "Hợp lệ",
  DUPLICATE: "Đã quét trước đó",
  UNKNOWN: "Không nhận diện được",
  INVALID: "Không hợp lệ",
} as const;

export const NOTIFICATION_SEVERITY_LABELS = {
  info: "Thông tin",
  warning: "Cảnh báo",
  critical: "Nghiêm trọng",
} as const;

export const SCAN_ENTRY_STATUS_LABELS = {
  ACTIVE: "Đang hiệu lực",
  REMOVED: "Đã bỏ khỏi phiếu",
} as const;

export const SCAN_BATCH_STATUS_LABELS = {
  OPEN: "Đang mở",
  CLASSIFIED: "Đã phân loại",
  PARTIALLY_POSTED: "Đã ghi nhận một phần",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
} as const;

export const QR_RESOLUTION_STATUS_LABELS = {
  NEW_ITEM_CANDIDATE: "Sản phẩm mới chờ ghi nhận",
  EXISTING_ITEM: "Sản phẩm đã có trong hệ thống",
  LEGACY_ITEM: "Sản phẩm từ dữ liệu cũ",
} as const;

export const SCAN_CONTEXT_LABELS = {
  INBOUND: "Nhập kho",
  OUTBOUND: "Xuất kho",
  INVENTORY: "Tồn kho",
  TRACE: "Tra cứu nguồn gốc",
  WARRANTY_RECEIVE: "Tiếp nhận bảo hành",
  WARRANTY_TEMP_ONLY: "Tiếp nhận bảo hành tạm",
} as const;

export const SCAN_CLASSIFICATION_LABELS = {
  ITEM: "Sản phẩm cụ thể",
  CONTAINER: "Vật chứa",
  SKU: "SKU",
} as const;

export const CONTAINER_TYPE_LABELS = {
  CARTON: "Thùng carton",
  BOX: "Hộp",
  TRAY: "Khay",
} as const;

export const REVERSAL_STATUS_LABELS = {
  DRAFT: "Nháp · chưa thay đổi tồn kho",
  POSTED: "Đã ghi nhận điều chỉnh tồn kho",
  CANCELLED: "Đã hủy",
} as const;

export const PHYSICAL_RETURN_STATUS_LABELS = {
  PENDING_RETURN: "Chờ hàng quay lại kho",
  CONFIRMED: "Đã xác nhận hàng về kho",
} as const;

export const RETURN_CONDITION_LABELS = {
  SELLABLE: "Có thể bán/xuất lại",
  DEFECTIVE: "Hàng lỗi",
  NON_SELLABLE: "Không thể bán/xuất",
} as const;

export const INVENTORY_STOCK_STATUS_LABELS = {
  AVAILABLE: "Khả dụng",
  NON_SELLABLE: "Không thể bán/xuất",
  DEFECTIVE: "Hàng lỗi",
  QUARANTINE: "Chờ kiểm tra",
} as const;

export const RECONCILE_STATUS_LABELS = {
  MATCH: "Khớp",
  PASS: "Khớp",
  MISMATCH: "Có chênh lệch",
  FAIL: "Có chênh lệch",
} as const;

export const MOVEMENT_TYPE_LABELS = {
  RECEIPT: "Nhập kho",
  ISSUE: "Xuất kho",
  COMPONENT_ISSUE: "Xuất linh kiện",
  REVERSAL: "Điều chỉnh tồn kho",
} as const;

export const MOVEMENT_STATUS_LABELS = {
  DRAFT: "Nháp",
  POSTED: "Đã ghi nhận",
  REVERSED: "Đã điều chỉnh",
  CANCELLED: "Đã hủy",
} as const;

export const MOVEMENT_ROLE_LABELS = {
  ORIGINAL: "Giao dịch gốc",
  REVERSAL: "Giao dịch điều chỉnh",
} as const;

export const SOURCE_DOCUMENT_TYPE_LABELS = {
  receipt: "Phiếu nhập",
  issue: "Phiếu xuất",
  transfer: "Phiếu chuyển kho",
  inbound: "Phiếu nhập",
  outbound: "Phiếu xuất",
  RECEIPT: "Phiếu nhập",
  ISSUE: "Phiếu xuất",
  COMPONENT_ISSUE: "Phiếu xuất linh kiện",
  REVERSAL: "Phiếu điều chỉnh tồn",
} as const;

export const MASTER_STATUS_LABELS = {
  ACTIVE: "Đang sử dụng",
  INACTIVE: "Ngừng sử dụng",
} as const;

export const SKU_TYPE_LABELS = {
  PRODUCT: "Sản phẩm",
  COMPONENT: "Linh kiện",
} as const;

export const IAM_USER_STATUS_LABELS = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng",
  LOCKED: "Đã khóa",
} as const;

export const IAM_ROLE_STATUS_LABELS = {
  ACTIVE: "Đang sử dụng",
  INACTIVE: "Ngừng sử dụng",
} as const;

export const IAM_SCOPE_LABELS = {
  SYSTEM: "Toàn hệ thống",
  WAREHOUSE: "Theo kho",
  FUNCTION: "Theo chức năng",
} as const;

export const IAM_SCOPE_TYPE_LABELS = IAM_SCOPE_LABELS;

export const PV_STOCK_STATUS_LABELS = {
  IN_STOCK: "Còn hàng",
  OUT_OF_STOCK: "Chưa có hàng",
} as const;

export const PUTAWAY_STATUS_LABELS = {
  RECEIVED_PENDING_PUTAWAY: "Chờ xếp khay",
  STORED: "Đã xếp khay",
} as const;

export const STOCK_REQUEST_STATUS_LABELS = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  converted: "Đã tạo phiếu kho",
  cancelled: "Đã hủy",
} as const;

export const TRANSFER_STATUS_LABELS = {
  in_transit: "Đang vận chuyển",
  return_in_transit: "Đang vận chuyển hoàn",
  completed: "Đã hoàn tất",
  completed_with_loss: "Hoàn tất, có thiếu hụt",
  returned: "Đã hoàn trả",
} as const;

export const WARRANTY_IDENTIFICATION_STATUS_LABELS = {
  IDENTIFIED: "Đã xác định sản phẩm",
  TEMP_ONLY: "Tiếp nhận tạm, chưa xác định sản phẩm",
} as const;

export const WARRANTY_TRACE_STATUS_LABELS = {
  TRACEABLE: "Có thông tin truy xuất",
  NOT_TRACEABLE: "Chưa có thông tin truy xuất",
} as const;

export const ITEM_STATUS_LABELS = {
  NEW: "Mới tạo",
  IN_STOCK: "Đang trong kho",
  ISSUED: "Đã xuất cho khách",
  RETURNED_TO_CUSTOMER: "Đã trả khách",
  IN_WARRANTY: "Đang bảo hành",
} as const;

export const WARRANTY_EVENT_TYPE_LABELS = {
  RECEIVE: "Tiếp nhận",
  CHECK: "Kiểm tra",
  REPAIR: "Sửa chữa",
  COMPLETE: "Hoàn tất",
  RETURN: "Trả khách",
  CANCEL: "Hủy",
  NOTE: "Ghi chú",
} as const;

export const AUDIT_ACTION_LABELS = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  REVOKE_ROLE_SCOPE: "Thu hồi phạm vi vai trò",
  SYNC_ROLE_SCOPES: "Cập nhật phạm vi vai trò",
  SUBMIT: "Gửi xử lý",
  CANCEL: "Hủy",
  ARCHIVE: "Lưu trữ",
  RESTORE: "Khôi phục",
} as const;
