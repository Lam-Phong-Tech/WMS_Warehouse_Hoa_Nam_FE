import {
  INVENTORY_STOCK_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  RECONCILE_STATUS_LABELS,
  WARRANTY_IDENTIFICATION_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import type { UiStatusTone } from "@/shared/ui";

export const MOVEMENT_LABELS: Readonly<Record<string, string>> = {
  OPENING: "Tồn đầu kỳ",
  ...MOVEMENT_TYPE_LABELS,
};

export const RECONCILE_LABELS: Readonly<Record<string, string>> = {
  ...RECONCILE_STATUS_LABELS,
  NOT_APPLICABLE: "Không áp dụng",
};

/**
 * SRS §7.5: đối soát tồn kho gồm BỐN check độc lập, badge "Trạng thái đối soát"
 * là tổng hợp cả bốn. Cột "Chênh lệch" chỉ phản ánh check đầu tiên, nên khi
 * lệch nằm ở ba check còn lại thì Chênh lệch = 0 mà trạng thái vẫn đỏ — phải
 * gọi tên đúng check đang hỏng, nếu không người đọc tưởng dữ liệu mâu thuẫn.
 */
export const RECONCILE_CHECK_LABELS: Readonly<Record<string, string>> = {
  ledger_to_balance: "Sổ cái ↔ số dư",
  serial_subledger: "Sổ serial",
  quantity_subledger: "Số lượng trong thùng",
  container_integrity: "Toàn vẹn thùng chứa",
};

export function reconcileCheckLabel(code: string): string {
  return RECONCILE_CHECK_LABELS[code] ?? code;
}

export const REPORT_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Nháp",
  SCANNING: "Đang quét",
  POSTED: "Đã ghi nhận",
  CANCELLED: "Đã hủy",
  UPLOADED: "Đã tải lên",
  VALIDATED: "Đã kiểm tra",
  CONSUMED: "Đã sử dụng",
  REJECTED: "Đã từ chối",
  PENDING_PRINT: "Chờ in",
  PRINTED: "Đã in",
  PRINT_FAILED: "In thất bại",
  RECEIVED: "Đã tiếp nhận",
  CHECKING: "Đang kiểm tra",
  REPAIRING: "Đang sửa chữa",
  COMPLETED: "Đã hoàn tất",
  RETURNED: "Đã trả khách",
  VALID: "Hợp lệ",
  INVALID: "Không hợp lệ",
  ERROR: "Lỗi",
  PENDING: "Chờ xử lý",
  COMMITTED: "Đã ghi nhận",
  DRY_RUN: "Chạy thử",
  COMMIT: "Ghi thật",
  IDENTIFIED: WARRANTY_IDENTIFICATION_STATUS_LABELS.IDENTIFIED,
  TEMP_ONLY: WARRANTY_IDENTIFICATION_STATUS_LABELS.TEMP_ONLY,
};

export function reportStatusLabel(value: unknown): string {
  return businessLabel(
    REPORT_STATUS_LABELS,
    value as string | null | undefined,
  );
}

export function stockStatusLabel(value: unknown): string {
  return businessLabel(
    INVENTORY_STOCK_STATUS_LABELS,
    value as string | null | undefined,
  );
}

/** Tone theo trạng thái — một bảng duy nhất cho cả 7 tab. */
const STATUS_TONE: Readonly<Record<string, UiStatusTone>> = {
  POSTED: "success",
  PRINTED: "success",
  CONSUMED: "success",
  RETURNED: "success",
  COMPLETED: "success",
  VALIDATED: "success",
  VALID: "success",
  COMMITTED: "success",
  MATCH: "success",
  AVAILABLE: "success",
  SCANNING: "info",
  PENDING_PRINT: "info",
  PENDING: "info",
  RECEIVED: "info",
  CHECKING: "info",
  REPAIRING: "info",
  UPLOADED: "info",
  DRY_RUN: "info",
  DRAFT: "neutral",
  NOT_APPLICABLE: "neutral",
  QUARANTINE: "warning",
  NON_SELLABLE: "warning",
  CANCELLED: "error",
  REJECTED: "error",
  PRINT_FAILED: "error",
  INVALID: "error",
  ERROR: "error",
  MISMATCH: "error",
  DEFECTIVE: "error",
};

export function statusTone(value: unknown): UiStatusTone {
  return STATUS_TONE[String(value ?? "")] ?? "neutral";
}

/** Chiều tác động lên tồn kho của một chứng từ — cột "Tăng/Giảm" mục 1.4. */
export type StockDirection = "INCREASE" | "DECREASE" | "MIXED" | "NONE";

export const DIRECTION_LABELS: Readonly<Record<StockDirection, string>> = {
  INCREASE: "Tăng",
  DECREASE: "Giảm",
  MIXED: "Tăng/Giảm",
  NONE: "Không đổi",
};

export const DIRECTION_TONE: Readonly<Record<StockDirection, UiStatusTone>> = {
  INCREASE: "success",
  DECREASE: "warning",
  MIXED: "info",
  NONE: "neutral",
};

/** Loại chứng từ hiển thị trong mục 1.4. */
export const DOC_TYPE_LABELS: Readonly<Record<string, string>> = {
  INBOUND: "Phiếu nhập",
  OUTBOUND: "Phiếu xuất",
  REVERSAL: "Phiếu hoàn trả / điều chỉnh",
};

export const SLA_LABELS = {
  NORMAL: "Bình thường",
  DUE_SOON: "Sắp đến hạn",
  OVERDUE: "Quá hạn",
  UNSET: "Chưa đặt hạn",
} as const;

export type SlaState = keyof typeof SLA_LABELS;

export const SLA_TONE: Readonly<Record<SlaState, UiStatusTone>> = {
  NORMAL: "success",
  DUE_SOON: "warning",
  OVERDUE: "error",
  UNSET: "neutral",
};

/** Trạng thái định mức tồn (mục 2.4). */
export const STOCK_NORM_LABELS = {
  LOW: "Sắp hết hàng",
  NORMAL: "Bình thường",
  OVER: "Thừa hàng",
  UNSET: "Chưa cấu hình",
} as const;

export type StockNormState = keyof typeof STOCK_NORM_LABELS;

export const STOCK_NORM_TONE: Readonly<Record<StockNormState, UiStatusTone>> = {
  LOW: "error",
  NORMAL: "success",
  OVER: "warning",
  UNSET: "neutral",
};
