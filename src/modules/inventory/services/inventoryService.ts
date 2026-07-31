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
  available: number;
  serialQty: number;
  boxQty: number;
  location: string;
  reconcile: "PASS" | "WARNING" | "FAIL" | string;
  updatedAt: string;
};

export type StockMovementRow = {
  id: string | number;
  movementId: string;
  time: string;
  type: string;
  sku: string;
  qty: number;
  source: string;
  actor: string;
  chain: string;
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
  return Array.isArray(value) ? value : Array.isArray(value.data) ? value.data : [];
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function clean<T extends Record<string, unknown>>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
  ) as T;
}

function normalizeBalance(row: RawRecord): InventoryBalanceRow {
  const available = num(row.available_qty ?? row.qty_available ?? row.available);
  const reserved = num(row.reserved_qty);
  const inTransit = num(row.in_transit_qty);
  return {
    id: text(row.id ?? `${row.warehouse_id ?? "system"}-${row.product_id ?? row.sku}`),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    name: text(row.product_name ?? row.sku_name ?? row.name),
    type: text(row.product_type ?? row.type ?? row.category_name, "-"),
    available,
    serialQty: num(row.serial_qty ?? row.item_qty ?? row.serial_count),
    boxQty: num(row.box_qty ?? row.container_qty ?? row.qty_box),
    location: text(row.location_hint ?? row.lot_no ?? row.warehouse_name, "-"),
    reconcile: reserved < 0 || inTransit < 0 ? "FAIL" : "PASS",
    updatedAt: text(row.updated_at ?? row.last_movement_at ?? row.created_at),
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
    qty,
    source: text(row.document_code ?? row.doc_no ?? row.source_code ?? row.document_id),
    actor: text(row.performed_by_name ?? row.actor_name ?? row.created_by_name, "-"),
    chain: text(row.chain_type ?? row.reference_type ?? "Original"),
  };
}

export async function fetchInventoryBalances(
  params: InventoryBalanceFilters = {},
): Promise<InventoryBalanceRow[]> {
  const result = await http.getPage<InventoryBalanceRow[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.INVENTORY_BALANCES,
    { params: clean({ limit: 20, ...params }) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeBalance,
  );
}

export async function fetchStockMovements(
  params: StockMovementFilters = {},
): Promise<StockMovementRow[]> {
  const result = await http.getPage<StockMovementRow[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.STOCK_MOVEMENTS,
    { params: clean({ per_page: 20, ...params }) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeMovement,
  );
}

export async function fetchStockMovement(id: string | number): Promise<RawRecord> {
  return http.get<RawRecord>(
    API_ENDPOINTS.STOCK_MOVEMENT.replace(":id", String(id)),
  );
}

export async function traceStockMovementSource(
  id: string | number,
): Promise<RawRecord> {
  return http.get<RawRecord>(
    API_ENDPOINTS.STOCK_MOVEMENT_TRACE_SOURCE.replace(":id", String(id)),
  );
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
