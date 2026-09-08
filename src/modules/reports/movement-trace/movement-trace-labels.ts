import { bilingual, enumLabelOrText } from "@/shared/constants/business-labels";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { tStatic } from "@/shared/i18n/useT";
import type { UiStatusTone } from "@/shared/ui";
import type { MovementTraceRow } from "./movement-trace-api";

/**
 * Từ vựng của màn RPT-MOV-01, giữ NGUYÊN VĂN bản demo đã duyệt
 * (8.4.WMS_Hoa_Nam_Bao_Cao_Movement_Trace.html + gói bàn giao
 * `Other/MovementTrace_HTML_Export`).
 *
 * Vì sao có "kind" riêng thay vì dùng thẳng `movement_type` của BE: demo tách
 * REVERSAL thành "Đảo phiếu nhập" / "Đảo phiếu xuất", còn enum của BE
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

/**
 * Nhãn dùng ở bảng ledger và ở bộ lọc "Loại biến động".
 *
 * KHÔNG spread / tham chiếu map của business-labels vào đây: các map đó là Proxy
 * song ngữ, đọc thuộc tính lúc import sẽ đóng băng ngôn ngữ tại thời điểm đó
 * (xem chú thích trong business-labels.ts). Mục trùng nghĩa được chép tay ở cả
 * hai thứ tiếng rồi bọc `bilingual` như nguồn gốc.
 */
export const MOVEMENT_KIND_LABELS: Readonly<Record<MovementTraceKind, string>> =
  bilingual(
    {
      OPENING: "Tồn đầu kỳ",
      RECEIPT: "Nhập kho đã ghi sổ",
      ISSUE: "Xuất kho đã ghi sổ",
      COMPONENT_ISSUE: "Xuất linh kiện",
      RECEIPT_REVERSAL: "Đảo phiếu nhập",
      ISSUE_REVERSAL: "Đảo phiếu xuất",
      REVERSAL: "Phiếu đảo",
    },
    {
      OPENING: "Opening balance",
      RECEIPT: "Posted receipt",
      ISSUE: "Posted issue",
      COMPONENT_ISSUE: "Component issue",
      RECEIPT_REVERSAL: "Receipt reversal",
      ISSUE_REVERSAL: "Issue reversal",
      REVERSAL: "Stock adjustment",
    },
  );

/**
 * Nhãn dùng ở dòng thời gian. Demo CỐ Ý gọi bút toán đảo bằng tên nghiệp vụ
 * ("Phiếu đảo cho phiếu xuất") ở timeline và bằng tên kỹ thuật
 * ("Đảo phiếu xuất") ở bảng — giữ đúng hai cách gọi, không hợp nhất. Tên nghiệp vụ
 * đổi từ "Điều chỉnh tồn kho ..." sang "Phiếu đảo ..." theo sheet 06 (UI-23).
 *
 * Chép tay lại cả bảng thay vì spread `MOVEMENT_KIND_LABELS`: spread một Proxy
 * song ngữ sẽ đóng băng ngôn ngữ lúc import (cùng lý do đã ghi ở trên).
 */
export const MOVEMENT_KIND_TIMELINE_LABELS: Readonly<
  Record<MovementTraceKind, string>
> = bilingual(
  {
    OPENING: "Tồn đầu kỳ",
    RECEIPT: "Nhập kho đã ghi sổ",
    ISSUE: "Xuất kho đã ghi sổ",
    COMPONENT_ISSUE: "Xuất linh kiện",
    RECEIPT_REVERSAL: "Phiếu đảo cho phiếu nhập",
    ISSUE_REVERSAL: "Phiếu đảo cho phiếu xuất",
    REVERSAL: "Phiếu đảo",
  },
  {
    OPENING: "Opening balance",
    RECEIPT: "Posted receipt",
    ISSUE: "Posted issue",
    COMPONENT_ISSUE: "Component issue",
    RECEIPT_REVERSAL: "Stock adjustment for a receipt document",
    ISSUE_REVERSAL: "Stock adjustment for an issue document",
    REVERSAL: "Stock adjustment",
  },
);

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

/**
 * Bộ lọc "Loại biến động" — đúng thứ tự và câu chữ của demo.
 *
 * `label` là GETTER chứ không phải giá trị: đọc `MOVEMENT_KIND_LABELS[...]` ngay
 * tại đây sẽ đóng băng ngôn ngữ lúc import module.
 */
export const MOVEMENT_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  value: MovementTraceKind;
  label: string;
}> = [
  {
    value: "OPENING",
    get label() {
      return MOVEMENT_KIND_LABELS.OPENING;
    },
  },
  {
    value: "RECEIPT",
    get label() {
      return MOVEMENT_KIND_LABELS.RECEIPT;
    },
  },
  {
    value: "ISSUE",
    get label() {
      return MOVEMENT_KIND_LABELS.ISSUE;
    },
  },
  {
    value: "RECEIPT_REVERSAL",
    get label() {
      return MOVEMENT_KIND_LABELS.RECEIPT_REVERSAL;
    },
  },
  {
    value: "ISSUE_REVERSAL",
    get label() {
      return MOVEMENT_KIND_LABELS.ISSUE_REVERSAL;
    },
  },
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

/** Nhãn của hai bộ lọc dưới đây — cùng cơ chế đọc-tại-lúc-truy-cập. */
const TRACE_BY_LABELS = bilingual(
  { physical: "Mã vật lý", sku: "SKU" },
  { physical: "Physical code", sku: "SKU" },
);

const RELATION_LABELS = bilingual(
  { all: "Tất cả", original: "Bút toán gốc", reversal: "Bút toán đảo" },
  { all: "All", original: "Original entry", reversal: "Reversal entry" },
);

/** Bộ lọc "Tra theo". */
/**
 * `stock_movements.source_type` — chứng từ nào đẻ ra dòng biến động này.
 * Đây là cột KỸ THUẬT của sổ, trước đây in nguyên `STOCK_DOCUMENT` /
 * `OPENING_ADJUSTMENT` ngay dưới mã chứng từ ở cột Nguồn.
 */
export const MOVEMENT_SOURCE_TYPE_LABELS: Readonly<Record<string, string>> =
  bilingual(
    {
      STOCK_DOCUMENT: "Phiếu nhập / xuất kho",
      INBOUND_DOCUMENT: "Phiếu nhập kho",
      OUTBOUND_DOCUMENT: "Phiếu xuất kho",
      INBOUND: "Phiếu nhập kho",
      OUTBOUND: "Phiếu xuất kho",
      COMPONENT_ISSUE_DOCUMENT: "Phiếu xuất linh kiện",
      REVERSAL_DOCUMENT: "Phiếu đảo",
      OPENING_BALANCE: "Tồn đầu kỳ",
      OPENING_ADJUSTMENT: "Điều chỉnh tồn đầu kỳ",
      SEEDER: "Dữ liệu dựng sẵn",
      SEED_COVERAGE: "Dữ liệu dựng sẵn",
    },
    {
      STOCK_DOCUMENT: "Receipt / issue document",
      INBOUND_DOCUMENT: "Receipt document",
      OUTBOUND_DOCUMENT: "Issue document",
      INBOUND: "Receipt document",
      OUTBOUND: "Issue document",
      COMPONENT_ISSUE_DOCUMENT: "Component issue document",
      REVERSAL_DOCUMENT: "Stock adjustment document",
      OPENING_BALANCE: "Opening balance",
      OPENING_ADJUSTMENT: "Opening balance adjustment",
      SEEDER: "Seed data",
      SEED_COVERAGE: "Seed data",
    },
  );

/** Nhãn cột Nguồn; mã lạ vẫn đọc được thay vì hiện nguyên dạng máy. */
export function movementSourceLabel(value: string | null | undefined): string {
  return enumLabelOrText(MOVEMENT_SOURCE_TYPE_LABELS, value);
}

export const TRACE_BY_OPTIONS = [
  {
    value: "physical",
    get label() {
      return TRACE_BY_LABELS.physical;
    },
  },
  {
    value: "sku",
    get label() {
      return TRACE_BY_LABELS.sku;
    },
  },
] as const;

export type TraceBy = (typeof TRACE_BY_OPTIONS)[number]["value"];

/** Bộ lọc "Quan hệ" — vị trí của dòng trong chuỗi reversal. */
export const RELATION_OPTIONS = [
  {
    value: "all",
    get label() {
      return RELATION_LABELS.all;
    },
  },
  {
    value: "original",
    get label() {
      return RELATION_LABELS.original;
    },
  },
  {
    value: "reversal",
    get label() {
      return RELATION_LABELS.reversal;
    },
  },
] as const;

export type RelationFilter = (typeof RELATION_OPTIONS)[number]["value"];

/**
 * Trạng thái của một dòng ledger. `stock_movements` là sổ APPEND-ONLY: dòng đã
 * ghi thì vĩnh viễn là đã ghi, một bút toán sai được sửa bằng dòng đảo MỚI chứ
 * không đổi trạng thái dòng cũ — nên cột này là một sự thật hằng của sổ, đúng
 * như demo hiển thị cho cả ba dòng fixture (kể cả dòng đã bị đảo).
 *
 * Live binding (`export let`) thay vì hằng: nơi dùng chỉ import một chuỗi, nên
 * giá trị phải được cập nhật lại khi đổi ngôn ngữ (cùng lối
 * `UNKNOWN_BUSINESS_LABEL` của business-labels.ts).
 */
export let LEDGER_ROW_STATUS_LABEL: string = tStatic(
  "reports.movementTrace.ledgerRowStatus",
);

useLanguageStore.subscribe(() => {
  LEDGER_ROW_STATUS_LABEL = tStatic("reports.movementTrace.ledgerRowStatus");
});
