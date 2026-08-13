import type { WarrantyCaseStatus } from "./types";

/** Trạng thái baseline theo SRS v1.6: RECEIVED → CHECKING → REPAIRING → COMPLETED → RETURNED / CANCELLED. */
export const WARRANTY_BASELINE_STATUSES: WarrantyCaseStatus[] = [
  "RECEIVED",
  "CHECKING",
  "REPAIRING",
  "COMPLETED",
  "RETURNED",
  "CANCELLED",
];

export const WARRANTY_TERMINAL_STATUSES: WarrantyCaseStatus[] = [
  "RETURNED",
  "RETURNED_TO_CUSTOMER",
  "CLOSED",
  "CANCELLED",
];

/** Transition hợp lệ khớp state machine backend (CurrentBaselineWarrantyController). */
export const WARRANTY_NEXT_STATUS: Partial<
  Record<WarrantyCaseStatus, WarrantyCaseStatus[]>
> = {
  RECEIVED: ["CHECKING", "CANCELLED"],
  CHECKING: ["REPAIRING", "CANCELLED"],
  REPAIRING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["RETURNED", "CANCELLED"],
};

export const WARRANTY_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Đã tiếp nhận",
  OPEN: "Mở case",
  CHECKING: "Đang kiểm tra",
  PROCESSING: "Đang xử lý",
  WAITING_PARTS: "Chờ linh kiện",
  REPAIRING: "Đang sửa chữa",
  COMPLETED: "Đã hoàn tất xử lý",
  READY: "Sẵn sàng trả",
  RETURNED: "Đã trả khách",
  RETURNED_TO_CUSTOMER: "Đã trả khách",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

export const WARRANTY_STATUS_COLORS: Record<string, string> = {
  RECEIVED: "default",
  OPEN: "default",
  CHECKING: "processing",
  PROCESSING: "processing",
  REPAIRING: "warning",
  WAITING_PARTS: "blue",
  COMPLETED: "success",
  READY: "success",
  RETURNED: "success",
  RETURNED_TO_CUSTOMER: "success",
  CLOSED: "default",
  CANCELLED: "error",
};

export const WARRANTY_ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  INTAKE: "Ảnh/tệp tiếp nhận",
  DIAGNOSTIC: "Ảnh/tệp chẩn đoán",
  RETURN: "Ảnh/tệp trả máy",
  OTHER: "Khác",
};

export function formatWarrantyDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}
