import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";

type RawRecord = Record<string, unknown>;

export type InventoryBalanceFilters = {
  page?: number;
  limit?: number;
  scope?: "system";
  warehouse_id?: number;
  product_id?: number;
  lot_no?: string;
  status?: string;
  search?: string;
  sort?: string;
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
  lotNo: string;
  uom: string;
  available: number;
  onHand: number;
  reserved: number;
  inTransit: number;
  blocked: number;
  serialQty: number;
  boxQty: number;
  location: string;
  reconcile: "PASS" | "WARNING" | "FAIL" | string;
  reconcileNote: string;
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
};

export type SafeStockConfigPayload = {
  product_id?: number | string;
  sku_id?: number | string;
  warehouse_id?: number | string;
  min_qty?: number;
  max_qty?: number;
  status?: string | number;
};

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
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

function normalizeBalance(row: RawRecord): InventoryBalanceRow {
  const available = num(
    row.available_qty ?? row.qty_available ?? row.available,
  );
  const onHand = num(
    row.on_hand_qty ?? row.qty_on_hand ?? row.on_hand ?? row.quantity,
  );
  const reserved = num(row.reserved_qty ?? row.qty_reserved ?? row.reserved);
  const inTransit = num(
    row.in_transit_qty ?? row.qty_in_transit ?? row.in_transit,
  );
  const blocked = num(row.blocked_qty ?? row.hold_qty ?? row.qty_blocked);
  const reconcile = text(
    row.reconcile_status ?? row.reconciliation_status ?? row.reconcile,
    reserved < 0 || inTransit < 0 ? "FAIL" : "PASS",
  );
  return {
    id: text(
      row.id ?? `${row.warehouse_id ?? "system"}-${row.product_id ?? row.sku}`,
    ),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    name: text(row.product_name ?? row.sku_name ?? row.name),
    type: text(row.product_type ?? row.type ?? row.category_name, "-"),
    warehouse: text(
      row.warehouse_name ??
        row.warehouse_code ??
        row.warehouse ??
        "System scope",
    ),
    lotNo: text(row.lot_no ?? row.batch_no ?? row.lot ?? "-"),
    uom: text(row.uom ?? row.unit ?? row.unit_name, ""),
    available,
    onHand,
    reserved,
    inTransit,
    blocked,
    serialQty: num(row.serial_qty ?? row.item_qty ?? row.serial_count),
    boxQty: num(row.box_qty ?? row.container_qty ?? row.qty_box),
    location: text(row.location_hint ?? row.lot_no ?? row.warehouse_name, "-"),
    reconcile,
    reconcileNote: text(
      row.reconcile_note ??
        row.reconciliation_note ??
        row.warning_reason ??
        row.note,
      "",
    ),
    updatedAt: text(row.updated_at ?? row.last_movement_at ?? row.created_at),
    dataAsOf: text(
      row.data_as_of ?? row.snapshot_at ?? row.last_inventory_sync_at,
    ),
    lastMovementId: text(row.last_movement_id ?? row.stock_movement_id ?? ""),
  };
}

function normalizeMovement(row: RawRecord): StockMovementRow {
  const qty = num(row.qty_change ?? row.quantity ?? row.qty);
  return {
    id: text(row.id),
    movementId: text(row.movement_no ?? row.code ?? row.id),
    time: text(row.occurred_at ?? row.performed_at ?? row.created_at),
    type: text(row.movement_type ?? row.source_type ?? row.action),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    warehouse: text(
      row.warehouse_name ?? row.warehouse_code ?? row.warehouse,
      "-",
    ),
    lotNo: text(row.lot_no ?? row.batch_no ?? row.lot, "-"),
    qty,
    beforeQty: nullableNum(
      row.before_qty ?? row.balance_before ?? row.qty_before,
    ),
    afterQty: nullableNum(row.after_qty ?? row.balance_after ?? row.qty_after),
    source: text(
      row.document_code ?? row.doc_no ?? row.source_code ?? row.document_id,
    ),
    sourceType: text(row.document_type ?? row.source_type ?? row.ref_type, "-"),
    actor: text(
      row.performed_by_name ?? row.actor_name ?? row.created_by_name,
      "-",
    ),
    chain: text(row.chain_type ?? row.reference_type ?? "Original"),
    status: text(row.status ?? row.posting_status ?? "POSTED"),
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
  return {
    movementId,
    sourceType: text(
      source.source_type ??
        source.document_type ??
        row.source_type ??
        row.document_type,
      "-",
    ),
    sourceCode: text(
      source.source_code ??
        source.document_code ??
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
        row.created_by_name,
      "-",
    ),
    requestId: text(
      row.request_id ?? (row.meta as RawRecord | undefined)?.request_id,
      "",
    ),
    summary: source,
    lines: rowsOf(row.lines as RawRecord[] | { data?: RawRecord[] }),
    timeline: rowsOf(
      (row.timeline ?? row.chain ?? row.related_movements) as
        | RawRecord[]
        | { data?: RawRecord[] },
    ),
  };
}

export async function fetchInventoryBalances(
  params: InventoryBalanceFilters = {},
): Promise<InventoryBalanceRow[]> {
  const result = await http.getPage<
    InventoryBalanceRow[] | { data?: RawRecord[] }
  >(API_ENDPOINTS.INVENTORY_BALANCES, {
    params: clean({ limit: 20, ...params }),
  });
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeBalance,
  );
}

export async function fetchStockMovements(
  params: StockMovementFilters = {},
): Promise<StockMovementRow[]> {
  const result = await http.getPage<
    StockMovementRow[] | { data?: RawRecord[] }
  >(API_ENDPOINTS.STOCK_MOVEMENTS, {
    params: clean({ per_page: 20, ...params }),
  });
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeMovement,
  );
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

export async function fetchSafeStockAlerts(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SAFE_STOCK_ALERTS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}

export async function fetchSafeStockConfigs(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SAFE_STOCK_CONFIGS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}

export async function createSafeStockConfig(
  payload: SafeStockConfigPayload,
): Promise<RawRecord> {
  return http.post<RawRecord>(API_ENDPOINTS.SAFE_STOCK_CONFIGS, payload);
}

export async function fetchScanBatches(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SCAN_BATCHES,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}

export async function createScanBatch(payload: {
  source_type?: string;
  source_id?: string;
  warehouse_id?: string;
  codes?: string[];
}): Promise<RawRecord> {
  return http.post<RawRecord>(API_ENDPOINTS.SCAN_BATCHES, payload);
}

export async function fetchScanEvents(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SCAN_EVENTS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}
