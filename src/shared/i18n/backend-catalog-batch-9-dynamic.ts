import type { BackendCatalogEntry } from "./backend-catalog.types";

/** Raw aliases and complete templates that generic UI rules only partly translated. */
export const BACKEND_CATALOG_BATCH_9_DYNAMIC: ReadonlyArray<BackendCatalogEntry> =
  [
    [
      "Cannot {value0} when document status is {value1}.",
      "Cannot {value0} when document status is {value1}.",
      "单据处于 {value1} 状态时，无法执行操作：{value0}。",
      { value0: "action", value1: "status" },
    ],
    [
      "Document {value0} is no longer in SCANNING status for posting.",
      "Document {value0} is no longer in SCANNING status for posting.",
      "单据 {value0} 已不处于 SCANNING 状态，无法过账。",
    ],
    [
      "Full-post guard failed on line {value0}: scanned_qty must equal planned quantity.",
      "Full-post validation failed on line {value0}: scanned_qty must equal the planned quantity.",
      "第 {value0} 行的完整过账校验失败：scanned_qty 必须等于计划数量。",
    ],
    [
      "Inbound document line {value0}",
      "Inbound document line {value0}",
      "入库单第 {value0} 行",
    ],
    [
      "Lý do xuất PII phải có ít nhất {value0} ký tự.",
      "The PII export reason must contain at least {value0} characters.",
      "导出个人信息的原因至少需要 {value0} 个字符。",
    ],
    [
      "Scan quantity exceeds remaining quantity on line {value0}.",
      "The scanned quantity exceeds the remaining quantity on line {value0}.",
      "扫描数量超过第 {value0} 行的剩余数量。",
    ],
    [
      "{value0} must contain exactly {value1} numbered physical tables; parsed {value2}.",
      "{value0} must contain exactly {value1} numbered physical tables; parsed {value2}.",
      "{value0} 必须包含恰好 {value1} 张带编号的物理表；实际解析出 {value2} 张。",
    ],
    [
      "{value0}.trạng thái không hợp lệ.",
      "{value0}.status is invalid.",
      "{value0}.status 无效。",
    ],
    [
      "{value0}.status không hợp lệ.",
      "{value0}.status is invalid.",
      "{value0}.status 无效。",
    ],
    [
      "Định mức tồn tối đa phải lớn hơn định mức tồn tối thiểu đang đặt ({value0}).",
      "The maximum stock threshold must be greater than the current minimum threshold ({value0}).",
      "最高库存限额必须大于当前最低库存限额（{value0}）。",
    ],
  ];
