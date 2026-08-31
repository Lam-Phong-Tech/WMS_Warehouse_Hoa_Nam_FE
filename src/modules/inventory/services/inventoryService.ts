import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type { ApiMeta } from "@/shared/types/api-response";

type RawRecord = Record<string, unknown>;

/**
 * Annex D SCR-INV-01 "Filter SKU/type/status". `status` ở đây là stock_status theo ERD
 * bảng 29 (AVAILABLE/NON_SELLABLE/DEFECTIVE/QUARANTINE) — MVP không có lô (lot) hay
 * định mức tồn an toàn.
 */
export type InventoryStockStatus =
  | "AVAILABLE"
  | "NON_SELLABLE"
  | "DEFECTIVE"
  | "QUARANTINE";

export type InventoryBalanceFilters = {
  page?: number;
  per_page?: number;
  warehouse_id?: string;
  sku_id?: string;
  sku_type?: "PRODUCT" | "COMPONENT";
  stock_status?: InventoryStockStatus;
  keyword?: string;
};

export type StockMovementFilters = {
  page?: number;
  per_page?: number;
  search?: string;
  keyword?: string;
  from_date?: string;
  to_date?: string;
  warehouse_id?: number;
  product_id?: number;
  lot_no?: string;
  movement_type?: string;
  balance_type?: string;
  document_code?: string;
  document_type?: string;
};

export type InventoryBalanceRow = {
  id: string | number;
  sku: string;
  name: string;
  type: string;
  warehouse: string;
  /** ERD bảng 29: bucket trạng thái tồn — chiều phân rã chính của SCR-INV-01. */
  stockStatus: string;
  uom: string;
  available: number;
  onHand: number;
  serialQty: number;
  boxQty: number;
  /** DR-LOC-001: gợi ý tương đối, không tạo bucket tồn và có thể rỗng. */
  containerCode: string;
  location: string;
  reconcile: "MATCH" | "MISMATCH" | string;
  reconcileNote: string;
  /**
   * WWHN-191: ledger-authoritative total (sum of stock_movements.qty_delta) and the
   * signed diff against on_hand_qty — the actual "đối soát" evidence behind `reconcile`.
   * Now rendered in InventoryPage's balance table as "Tồn theo sổ cái" / "Chênh lệch",
   * sitting right before the "Đối soát" tag they justify (see WWHN-191 evidence).
   */
  ledgerTotal: number;
  variance: number;
  /**
   * WWHN-198 / DEC-INV-RESERVED-001: `reserved_qty` là COMPATIBILITY FIELD, backend
   * ghim hằng 0 và nó KHÔNG phải nguồn sự thật của khả dụng. Giữ chỗ trong hệ thống
   * là identity-level — một item cụ thể bị chiếm khi có `outbound_item_matches` ở
   * trạng thái ACTIVE — chứ không phải một con số quantity-level.
   *
   * Vì vậy: KHÔNG hiển thị field này như "Đang giữ chỗ", và KHÔNG tính
   * `khả dụng = onHand - reservedQty`. Cột khả dụng phải đọc `available` (map từ
   * `available_qty`, Annex D SCR-OUT-01). Giữ lại ở đây chỉ để pass-through cho
   * caller nào cần raw value, giống ledgerTotal/variance ở trên.
   */
  reservedQty: number;
  incidentId: string | null;
  incidentStatus: string | null;
  updatedAt: string;
  dataAsOf: string;
  lastMovementId: string;
};

export type StockMovementRow = {
  id: string | number;
  movementId: string;
  time: string;
  type: string;
  sku: string;
  warehouse: string;
  lotNo: string;
  qty: number;
  beforeQty: number | null;
  afterQty: number | null;
  source: string;
  sourceType: string;
  actor: string;
  chain: string;
  status: string;
};

/**
 * WWHN-240 · một mắt xích của correction chain (BR-REV-01/08/11).
 * `role=ORIGINAL` là movement gốc bất biến; các mắt xích còn lại là Reversal append-only.
 */
export type CorrectionChainNode = {
  id: string;
  movement_no: string | null;
  movement_type: string;
  role: "ORIGINAL" | "REVERSAL";
  depth: number;
  is_subject: boolean;
  occurred_at: string | null;
  warehouse_code: string | null;
  product_code: string | null;
  stock_status: string | null;
  quantity: number | null;
  qty_delta: number;
  qty_before: number | null;
  qty_after: number | null;
  actor: string | null;
  original_movement_id: string | null;
  correction_chain_id: string | null;
  reversal_document_no: string | null;
  reversal_status: string | null;
  reason_code: string | null;
  reason_text: string | null;
};

/** WWHN-240 · net effect tính từ ledger authoritative (DEC-INV-001). */
export type ReversalNetEffect = {
  basis: string;
  originalMovementId: string;
  originalMovementType: string;
  originalQty: number;
  reversedQty: number;
  remainingReversibleQty: number;
  netQtyDelta: number;
  fullyReversed: boolean;
  reversalCount: number;
};

export type StockMovementTraceSource = {
  movementId: string | number;
  sourceType: string;
  sourceCode: string;
  status: string;
  postedAt: string;
  actor: string;
  requestId: string;
  summary: RawRecord;
  lines: RawRecord[];
  timeline: RawRecord[];
  /** Rỗng khi BE cũ chưa phát hành correction_chain. */
  chain: CorrectionChainNode[];
  rootMovementId: string | null;
  chainTruncated: boolean;
  netEffect: ReversalNetEffect | null;
};

export type PhysicalCodeTraceResult = {
  physical_code: RawRecord | null;
  resolved_type: string;
  resolved_id: string;
  /** WWHN-191: BE returns this ("PHYSICAL_CODE" | "ITEM_CODE" | fallback resolver key); was missing from the FE type entirely. */
  resolved_by: string | null;
  resolved_object: RawRecord | null;
  movements: RawRecord[];
  container_items: RawRecord[];
  /**
   * Mục 6 (vòng đời sản phẩm): lịch sử bảo hành của CÙNG item (nối tiếp
   * `movements` nhập/xuất/điều chỉnh) — chỉ có khi resolved_type === "ITEM".
   * customer_name/customer_phone đã bị BE mask sẵn nếu actor thiếu
   * warranty.pii.view (StockMovementController::traceWarrantyHistory).
   */
  warranty_history: RawRecord[];
};

export type SubledgerResult = {
  balance_id: string;
  product_id: string;
  warehouse_id: string;
  items: RawRecord[];
  containers: RawRecord[];
  item_count: number;
  container_count: number;
};

export type PagedResult<T> = { rows: T[]; meta: ApiMeta };

function rowsOf<T>(value: T[] | { data?: T[] } | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function nullableNum(value: unknown): number | null {
  return value === undefined || value === null ? null : num(value);
}

function clean<T extends Record<string, unknown>>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== undefined,
    ),
  ) as T;
}

function nested(
  row: RawRecord | undefined,
  key: string,
): RawRecord | undefined {
  const val = row?.[key];
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as RawRecord)
    : undefined;
}

function normalizeBalance(row: RawRecord): InventoryBalanceRow {
  const prod = nested(row, "product");
  const wh = nested(row, "warehouse");
  const available = num(
    row.available_qty ?? row.qty_available ?? row.available,
  );
  const onHand = num(
    row.on_hand_qty ?? row.qty_on_hand ?? row.on_hand ?? row.quantity,
  );
  const reconcile = text(
    row.reconciliation_status ?? row.reconcile_status ?? row.reconcile,
    "",
  );
  const mismatchReason = text(
    row.mismatch_reason ?? row.reconcile_note ?? row.warning_reason,
    "",
  );
  const whName = text(
    row.warehouse_name ??
      wh?.name ??
      wh?.warehouse_name ??
      wh?.code ??
      row.warehouse_code,
    "System scope",
  );
  return {
    id: text(
      row.id ?? `${row.warehouse_id ?? "system"}-${row.product_id ?? row.sku}`,
    ),
    sku: text(
      row.sku ??
        row.sku_code ??
        prod?.sku_code ??
        prod?.code ??
        row.product_sku ??
        row.product_code,
    ),
    name: text(
      row.product_name ??
        row.sku_name ??
        prod?.sku_name ??
        prod?.name ??
        row.name,
    ),
    // ERD bảng SKU: sku_type ∈ PRODUCT/COMPONENT — chiều "type" của bộ lọc SCR-INV-01.
    type: text(
      row.sku_type ?? row.product_type ?? prod?.sku_type ?? row.type,
      "-",
    ),
    warehouse: whName,
    stockStatus: text(row.stock_status, "AVAILABLE"),
    uom: text(row.uom ?? row.unit ?? prod?.unit ?? row.unit_name, ""),
    available,
    onHand,
    serialQty: num(
      row.item_subledger_count ??
        row.serial_qty ??
        row.item_qty ??
        row.serial_count,
    ),
    boxQty: num(
      row.container_subledger_count ??
        row.box_qty ??
        row.container_qty ??
        row.qty_box,
    ),
    containerCode: text(row.container_code, ""),
    location: text(row.location_hint, ""),
    reconcile,
    reconcileNote: mismatchReason,
    ledgerTotal: num(row.ledger_total),
    variance: num(row.variance),
    reservedQty: num(row.reserved_qty),
    incidentId:
      row.incident_id === undefined || row.incident_id === null
        ? null
        : text(row.incident_id),
    incidentStatus:
      row.incident_status === undefined || row.incident_status === null
        ? null
        : text(row.incident_status),
    updatedAt: text(row.updated_at ?? row.last_movement_at ?? row.created_at),
    dataAsOf: text(
      row.data_as_of ?? row.snapshot_at ?? row.last_inventory_sync_at,
    ),
    lastMovementId: text(row.last_movement_id ?? row.stock_movement_id ?? ""),
  };
}

function normalizeMovement(row: RawRecord): StockMovementRow {
  const prod = nested(row, "product");
  const wh = nested(row, "warehouse");
  const doc = nested(row, "document");
  const creator = nested(row, "creator");
  const qty = num(row.qty_change ?? row.qty_delta ?? row.quantity ?? row.qty);
  return {
    id: text(row.id),
    // KHÔNG fallback `?? row.id`: field này tên là "movementId" nhưng nghĩa là
    // MÃ biến động đọc được (movement_no) — nhét UUID vào đây khiến mọi màn
    // render nó tưởng đang hiển thị mã, và in ra chuỗi thô. Thiếu mã thì để
    // rỗng, nơi hiển thị tự quyết định (thường là "—"). `row.id` vẫn có riêng.
    movementId: text(row.movement_no ?? row.code),
    time: text(row.occurred_at ?? row.performed_at ?? row.created_at),
    type: text(row.movement_type ?? row.source_type ?? row.action),
    sku: text(
      row.sku ??
        row.sku_code ??
        prod?.sku_code ??
        prod?.code ??
        row.product_sku ??
        row.product_code,
    ),
    warehouse: text(
      row.warehouse_name ??
        wh?.name ??
        wh?.warehouse_name ??
        wh?.code ??
        row.warehouse_code,
      "-",
    ),
    lotNo: text(row.lot_no ?? row.batch_no ?? row.stock_status ?? row.lot, "-"),
    qty,
    beforeQty: nullableNum(
      row.before_qty ?? row.balance_before ?? row.qty_before,
    ),
    afterQty: nullableNum(row.after_qty ?? row.balance_after ?? row.qty_after),
    source: text(
      row.document_code ??
        row.doc_no ??
        row.source_code ??
        doc?.doc_no ??
        doc?.code ??
        row.movement_no,
    ),
    sourceType: text(
      row.document_type ?? row.source_type ?? doc?.doc_type ?? row.ref_type,
      "-",
    ),
    actor: text(
      row.performed_by_name ??
        row.actor_name ??
        row.created_by_name ??
        creator?.display_name ??
        creator?.name,
      "-",
    ),
    chain: text(
      row.chain_type ??
        row.correction_chain_id ??
        row.reference_type ??
        "Original",
    ),
    status: text(
      row.status ?? row.posting_status ?? row.stock_status ?? "POSTED",
    ),
  };
}

function normalizeTraceSource(
  row: RawRecord,
  movementId: string | number,
): StockMovementTraceSource {
  const source = (row.source ??
    row.document ??
    row.source_document ??
    row) as RawRecord;
  const sourceLines = source.lines;
  const statusHistory = row.status_history ?? source.status_history;
  const mvCreator = nested(nested(row, "movement"), "creator");
  return {
    movementId,
    sourceType: text(
      source.source_type ??
        source.document_type ??
        source.doc_type ??
        row.source_type ??
        row.document_type,
      "-",
    ),
    sourceCode: text(
      source.source_code ??
        source.document_code ??
        source.doc_no ??
        source.code ??
        row.source_code,
      "-",
    ),
    status: text(source.status ?? row.status, "-"),
    postedAt: text(source.posted_at ?? row.posted_at ?? source.created_at),
    actor: text(
      source.actor_name ??
        source.created_by_name ??
        row.actor_name ??
        row.created_by_name ??
        mvCreator?.display_name ??
        mvCreator?.name,
      "-",
    ),
    requestId: text(
      row.request_id ?? (row.meta as RawRecord | undefined)?.request_id,
      "",
    ),
    summary: source,
    lines: rowsOf(
      (row.lines ?? sourceLines) as RawRecord[] | { data?: RawRecord[] },
    ),
    timeline: rowsOf(
      (row.timeline ?? row.chain ?? row.related_movements ?? statusHistory) as
        | RawRecord[]
        | { data?: RawRecord[] },
    ),
    ...normalizeCorrectionChain(row),
  };
}

/**
 * WWHN-240 · BR-REV-11 + §13.10 RPT-MOV-01: trace phải hiển thị movement gốc, TOÀN BỘ
 * reversal chain và net effect. Trước WWHN-240 BE chỉ trả một `reversal_movement` duy
 * nhất nên FE không có gì để dựng chuỗi; các khoá mới đọc mềm để màn hình vẫn chạy khi
 * ghép với một backend chưa cập nhật.
 */
function normalizeCorrectionChain(row: RawRecord): {
  chain: CorrectionChainNode[];
  rootMovementId: string | null;
  chainTruncated: boolean;
  netEffect: ReversalNetEffect | null;
} {
  const chainRaw = (row.correction_chain ?? {}) as RawRecord;
  const nodes = Array.isArray(chainRaw.nodes)
    ? (chainRaw.nodes as CorrectionChainNode[])
    : [];
  const effect = row.net_effect as RawRecord | undefined;

  return {
    chain: nodes,
    rootMovementId: chainRaw.root_movement_id
      ? String(chainRaw.root_movement_id)
      : null,
    chainTruncated: Boolean(chainRaw.truncated),
    netEffect: effect
      ? {
          basis: text(effect.basis, "LEDGER"),
          originalMovementId: text(effect.original_movement_id, ""),
          originalMovementType: text(effect.original_movement_type, "-"),
          originalQty: Number(effect.original_qty ?? 0),
          reversedQty: Number(effect.reversed_qty ?? 0),
          remainingReversibleQty: Number(effect.remaining_reversible_qty ?? 0),
          netQtyDelta: Number(effect.net_qty_delta ?? 0),
          fullyReversed: Boolean(effect.fully_reversed),
          reversalCount: Number(effect.reversal_count ?? 0),
        }
      : null,
  };
}

export async function fetchInventoryBalances(
  params: InventoryBalanceFilters = {},
): Promise<PagedResult<InventoryBalanceRow>> {
  const result = await http.getPage<
    InventoryBalanceRow[] | { data?: RawRecord[] }
  >(API_ENDPOINTS.INVENTORY_BALANCES, {
    params: clean({ per_page: 10, ...params }),
  });
  return {
    rows: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
      normalizeBalance,
    ),
    meta: result.meta,
  };
}

export async function fetchBalanceSubledger(
  balanceId: string,
): Promise<SubledgerResult> {
  return http.get<SubledgerResult>(
    API_ENDPOINTS.INVENTORY_BALANCE_SUBLEDGER.replace(":id", balanceId),
  );
}

export async function fetchStockMovements(
  params: StockMovementFilters = {},
): Promise<PagedResult<StockMovementRow>> {
  const result = await http.getPage<
    StockMovementRow[] | { data?: RawRecord[] }
  >(API_ENDPOINTS.STOCK_MOVEMENTS, {
    params: clean({ per_page: 10, ...params }),
  });
  return {
    rows: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
      normalizeMovement,
    ),
    meta: result.meta,
  };
}

export async function fetchStockMovement(
  id: string | number,
): Promise<RawRecord> {
  return http.get<RawRecord>(
    API_ENDPOINTS.STOCK_MOVEMENT.replace(":id", String(id)),
  );
}

export async function traceStockMovementSource(
  id: string | number,
): Promise<StockMovementTraceSource> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.STOCK_MOVEMENT_TRACE_SOURCE.replace(":id", String(id)),
  );
  return normalizeTraceSource(result, id);
}

export async function traceByPhysicalCode(
  code: string,
): Promise<PhysicalCodeTraceResult> {
  return http.get<PhysicalCodeTraceResult>(
    API_ENDPOINTS.STOCK_MOVEMENT_TRACE_BY_CODE,
    { params: { code } },
  );
}

export type InventoryReconciliationFilters = {
  warehouse_id?: string;
  product_id?: string;
  stock_status?: InventoryStockStatus;
  only_mismatch?: boolean;
};

/** Shape do `OperationalReportController::inventoryReconciliation()` trả về. */
export type InventoryReconciliationResult = {
  formula: string;
  dimension: string[];
  checks: string[];
  summary: {
    rows_checked: number;
    mismatch_count: number;
    serial_subledger_mismatch_count: number;
    quantity_subledger_mismatch_count: number;
    container_integrity_mismatch_count: number;
    status: "PASS" | "FAIL";
    overall_status: "PASS" | "FAIL";
  };
  rows: RawRecord[];
  mismatches: RawRecord[];
};

/**
 * WWHN-202 (DEV202-P1-05R2) — báo cáo đối soát on-demand, §7.5 bốn check
 * (ledger_to_balance / serial_subledger / quantity_subledger / container_integrity).
 *
 * `API_ENDPOINTS.INVENTORY_RECONCILIATION` trước đây được khai nhưng không hàm nào gọi,
 * nên FE không thể xác nhận bề mặt "reconcile" là dùng được. Màn hình SCR-INV-01 hiện đọc
 * `reconciliation_status`/`variance`/`incident_id` theo từng dòng balance (RPT-INV-01),
 * còn endpoint này là bản tổng hợp có `summary.overall_status` — đúng cổng
 * "Ledger=Balance=subledger; FAIL warning/block sign-off" của §13.10.
 *
 * Permission BE: `report.view` (khác `inventory.view` của nhóm balance/movement).
 */
export async function fetchInventoryReconciliation(
  params: InventoryReconciliationFilters = {},
): Promise<InventoryReconciliationResult> {
  return http.get<InventoryReconciliationResult>(
    API_ENDPOINTS.INVENTORY_RECONCILIATION,
    { params: clean(params as Record<string, unknown>) },
  );
}
