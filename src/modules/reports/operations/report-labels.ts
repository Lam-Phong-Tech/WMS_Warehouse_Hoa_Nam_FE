import type { MessageKey } from "@/shared/i18n/messages";
import type { TranslateFn } from "@/shared/i18n/useT";
import {
  INVENTORY_STOCK_STATUS_LABELS,
  bilingual,
  businessLabel,
} from "@/shared/constants/business-labels";
import type { UiStatusTone } from "@/shared/ui";

// KHÔNG spread map từ business-labels vào đây: các map đó là Proxy song ngữ,
// spread sẽ sao chép giá trị theo ngôn ngữ lúc import và đóng băng ở đó (xem
// chú thích trong business-labels.ts). Vì vậy các mục trùng được chép tay ở cả
// hai thứ tiếng và bọc `bilingual` như nguồn gốc.
export const MOVEMENT_LABELS: Readonly<Record<string, string>> = bilingual(
  {
    OPENING: "Tồn đầu kỳ",
    RECEIPT: "Nhập kho",
    ISSUE: "Xuất kho",
    COMPONENT_ISSUE: "Xuất linh kiện",
    REVERSAL: "Phiếu đảo",
  },
  {
    OPENING: "Opening balance",
    RECEIPT: "Receipt",
    ISSUE: "Issue",
    COMPONENT_ISSUE: "Component issue",
    REVERSAL: "Stock adjustment",
  },
);

export const RECONCILE_LABELS: Readonly<Record<string, string>> = bilingual(
  {
    MATCH: "Khớp",
    PASS: "Khớp",
    MISMATCH: "Có chênh lệch",
    FAIL: "Có chênh lệch",
    NOT_APPLICABLE: "Không áp dụng",
  },
  {
    MATCH: "Matched",
    PASS: "Matched",
    MISMATCH: "Discrepancy found",
    FAIL: "Discrepancy found",
    NOT_APPLICABLE: "Not applicable",
  },
);

/**
 * SRS §7.5: đối soát tồn kho gồm BỐN check độc lập, badge "Trạng thái đối soát"
 * là tổng hợp cả bốn. Cột "Chênh lệch" chỉ phản ánh check đầu tiên, nên khi
 * lệch nằm ở ba check còn lại thì Chênh lệch = 0 mà trạng thái vẫn đỏ — phải
 * gọi tên đúng check đang hỏng, nếu không người đọc tưởng dữ liệu mâu thuẫn.
 */
export const RECONCILE_CHECK_KEYS: Readonly<Record<string, MessageKey>> = {
  ledger_to_balance: "reports.reconcileCheck.ledgerToBalance",
  serial_subledger: "reports.reconcileCheck.serialSubledger",
  quantity_subledger: "reports.reconcileCheck.quantitySubledger",
  container_integrity: "reports.reconcileCheck.containerIntegrity",
};

export function reconcileCheckLabel(code: string, t: TranslateFn): string {
  const key = RECONCILE_CHECK_KEYS[code];
  return key ? t(key) : code;
}

export const REPORT_STATUS_LABELS: Readonly<Record<string, string>> = bilingual(
  {
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
    // Trùng giá trị với WARRANTY_IDENTIFICATION_STATUS_LABELS — chép tay thay
    // vì tham chiếu để không đọc xuyên Proxy lúc import (xem chú thích đầu file).
    IDENTIFIED: "Đã xác định sản phẩm",
    TEMP_ONLY: "Tiếp nhận tạm, chưa xác định sản phẩm",
  },
  {
    DRAFT: "Draft",
    SCANNING: "Scanning",
    POSTED: "Posted",
    CANCELLED: "Cancelled",
    UPLOADED: "Uploaded",
    VALIDATED: "Validated",
    CONSUMED: "Consumed",
    REJECTED: "Rejected",
    PENDING_PRINT: "Awaiting print",
    PRINTED: "Printed",
    PRINT_FAILED: "Print failed",
    RECEIVED: "Received",
    CHECKING: "Under inspection",
    REPAIRING: "Under repair",
    COMPLETED: "Completed",
    RETURNED: "Returned to customer",
    VALID: "Valid",
    INVALID: "Invalid",
    ERROR: "Error",
    PENDING: "Pending",
    COMMITTED: "Committed",
    DRY_RUN: "Dry run",
    COMMIT: "Commit",
    IDENTIFIED: "Product identified",
    TEMP_ONLY: "Temporary intake, product not identified",
  },
);

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

export const DIRECTION_LABEL_KEYS: Readonly<
  Record<StockDirection, MessageKey>
> = {
  INCREASE: "reports.direction.increase",
  DECREASE: "reports.direction.decrease",
  MIXED: "reports.direction.mixed",
  NONE: "reports.direction.none",
};

export const DIRECTION_TONE: Readonly<Record<StockDirection, UiStatusTone>> = {
  INCREASE: "success",
  DECREASE: "warning",
  MIXED: "info",
  NONE: "neutral",
};

/** Loại chứng từ hiển thị trong mục 1.4. */
export const DOC_TYPE_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  INBOUND: "reports.docType.inbound",
  OUTBOUND: "reports.docType.outbound",
  REVERSAL: "reports.docType.reversal",
};

export const SLA_LABEL_KEYS = {
  NORMAL: "reports.sla.normal",
  DUE_SOON: "reports.sla.dueSoon",
  OVERDUE: "reports.sla.overdue",
  UNSET: "reports.sla.unset",
} as const satisfies Record<string, MessageKey>;

export type SlaState = keyof typeof SLA_LABEL_KEYS;

export const SLA_TONE: Readonly<Record<SlaState, UiStatusTone>> = {
  NORMAL: "success",
  DUE_SOON: "warning",
  OVERDUE: "error",
  UNSET: "neutral",
};

/** Trạng thái định mức tồn (mục 2.4). */
export const STOCK_NORM_LABEL_KEYS = {
  LOW: "reports.stockNorm.low",
  NORMAL: "reports.stockNorm.normal",
  OVER: "reports.stockNorm.over",
  UNSET: "reports.stockNorm.unset",
} as const satisfies Record<string, MessageKey>;

export type StockNormState = keyof typeof STOCK_NORM_LABEL_KEYS;

export const STOCK_NORM_TONE: Readonly<Record<StockNormState, UiStatusTone>> = {
  LOW: "error",
  NORMAL: "success",
  OVER: "warning",
  UNSET: "neutral",
};
