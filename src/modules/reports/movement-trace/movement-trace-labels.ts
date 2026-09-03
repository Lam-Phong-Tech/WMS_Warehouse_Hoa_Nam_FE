import { MOVEMENT_TYPE_LABELS } from "@/shared/constants/business-labels";
import type { UiStatusTone } from "@/shared/ui";
import type { MovementTraceRow } from "./movement-trace-api";

/**
 * Từ vựng của màn RPT-MOV-01, giữ NGUYÊN VĂN bản demo đã duyệt
 * (8.4.WMS_Hoa_Nam_Bao_Cao_Movement_Trace.html + gói bàn giao
 * `Other/MovementTrace_HTML_Export`).
 *
 * Vì sao có "kind" riêng thay vì dùng thẳng `movement_type` của BE: demo tách
 * REVERSAL thành "Reversal phiếu nhập" / "Reversal phiếu xuất", còn enum của BE
 * chỉ có một giá trị REVERSAL. Chiều của bút toán đảo suy TỪ DỮ LIỆU chứ không
 * đoán: đảo một phiếu XUẤT trả hàng về kho nên qty_delta > 0, đảo một phiếu
 * NHẬP rút hàng ra nên qty_delta < 0 (BR-REV-11 net effect).
 */
export type MovementTraceKind =
  | "OPENING"
  | "RECEIPT"
  | "ISSUE"
  | "COMPONENT_ISSUE"
  | "RECEIPT_REVERSAL"
  | "ISSUE_REVERSAL"
  | "REVERSAL";

export function movementKindOf(row: MovementTraceRow): MovementTraceKind {
  if (row.movementType === "REVERSAL") {
    if (row.qtyDelta > 0) return "ISSUE_REVERSAL";
    if (row.qtyDelta < 0) return "RECEIPT_REVERSAL";
    return "REVERSAL";
  }
  if (
    row.movementType === "OPENING" ||
    row.movementType === "RECEIPT" ||
    row.movementType === "ISSUE" ||
    row.movementType === "COMPONENT_ISSUE"
  ) {
    return row.movementType;
  }
  return "REVERSAL";
}

/** Nhãn dùng ở bảng ledger và ở bộ lọc "Loại biến động". */
export const MOVEMENT_KIND_LABELS: Readonly<Record<MovementTraceKind, string>> =
  {
    OPENING: "Tồn đầu kỳ",
    RECEIPT: "Nhập kho đã ghi sổ",
    ISSUE: "Xuất kho đã ghi sổ",
    COMPONENT_ISSUE: MOVEMENT_TYPE_LABELS.COMPONENT_ISSUE,
    RECEIPT_REVERSAL: "Reversal phiếu nhập",
    ISSUE_REVERSAL: "Reversal phiếu xuất",
    REVERSAL: MOVEMENT_TYPE_LABELS.REVERSAL,
  };

/**
 * Nhãn dùng ở dòng thời gian. Demo CỐ Ý gọi bút toán đảo bằng tên nghiệp vụ
 * ("Điều chỉnh tồn kho phiếu xuất") ở timeline và bằng tên kỹ thuật
 * ("Reversal phiếu xuất") ở bảng — chép đúng cả hai, không hợp nhất.
 */
export const MOVEMENT_KIND_TIMELINE_LABELS: Readonly<
  Record<MovementTraceKind, string>
> = {
  ...MOVEMENT_KIND_LABELS,
  RECEIPT_REVERSAL: `${MOVEMENT_TYPE_LABELS.REVERSAL} phiếu nhập`,
  ISSUE_REVERSAL: `${MOVEMENT_TYPE_LABELS.REVERSAL} phiếu xuất`,
};

export const MOVEMENT_KIND_TONES: Readonly<
  Record<MovementTraceKind, UiStatusTone>
> = {
  OPENING: "neutral",
  RECEIPT: "success",
  ISSUE: "primary",
  COMPONENT_ISSUE: "info",
  RECEIPT_REVERSAL: "warning",
  ISSUE_REVERSAL: "warning",
  REVERSAL: "warning",
};

/** Bộ lọc "Loại biến động" — đúng thứ tự và câu chữ của demo. */
export const MOVEMENT_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  value: MovementTraceKind;
  label: string;
}> = [
  { value: "OPENING", label: MOVEMENT_KIND_LABELS.OPENING },
  { value: "RECEIPT", label: MOVEMENT_KIND_LABELS.RECEIPT },
  { value: "ISSUE", label: MOVEMENT_KIND_LABELS.ISSUE },
  { value: "RECEIPT_REVERSAL", label: MOVEMENT_KIND_LABELS.RECEIPT_REVERSAL },
  { value: "ISSUE_REVERSAL", label: MOVEMENT_KIND_LABELS.ISSUE_REVERSAL },
];

/**
 * `movement_type` gửi lên BE cho một lựa chọn của bộ lọc. Hai lựa chọn reversal
 * cùng ánh xạ về REVERSAL (enum BE chỉ có một giá trị) rồi tách tiếp ở client
 * theo `movementKindOf`.
 */
export function serverMovementType(kind: string): string {
  if (kind === "RECEIPT_REVERSAL" || kind === "ISSUE_REVERSAL") {
    return "REVERSAL";
  }
  return kind;
}

/** Bộ lọc "Tra theo". */
export const TRACE_BY_OPTIONS = [
  { value: "physical", label: "Physical Code" },
  { value: "sku", label: "SKU" },
] as const;

export type TraceBy = (typeof TRACE_BY_OPTIONS)[number]["value"];

/** Bộ lọc "Quan hệ" — vị trí của dòng trong chuỗi reversal. */
export const RELATION_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "original", label: "Original" },
  { value: "reversal", label: "Reversal" },
] as const;

export type RelationFilter = (typeof RELATION_OPTIONS)[number]["value"];

/**
 * Trạng thái của một dòng ledger. `stock_movements` là sổ APPEND-ONLY: dòng đã
 * ghi thì vĩnh viễn là đã ghi, một bút toán sai được sửa bằng dòng đảo MỚI chứ
 * không đổi trạng thái dòng cũ — nên cột này là một sự thật hằng của sổ, đúng
 * như demo hiển thị cho cả ba dòng fixture (kể cả dòng đã bị đảo).
 */
export const LEDGER_ROW_STATUS_LABEL = "Đã ghi nhận";
