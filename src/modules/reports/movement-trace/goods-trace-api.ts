import { useQuery } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { CACHE_POLICIES } from "@/shared/cache/cache-policy";

export type GoodsTraceQuery = {
  code?: string;
  code_type?: "all" | "serial" | "box" | "tray" | "document" | "sku";
  from_date?: string;
  to_date?: string;
  activity_type?: string;
  source?: string;
  actor?: string;
  relation?: "all" | "original" | "reversal";
  stock_only?: boolean;
};
export type GoodsTraceDocument = { id: string; code: string; type: string };
export type GoodsTraceEvent = {
  id: string;
  occurred_at: string;
  recorded_at: string;
  event_type: string;
  event_label: string;
  code: string;
  sku_code: string;
  sku_name: string;
  warehouse_code: string;
  location_before: string;
  location_after: string;
  quantity: number | null;
  qty_delta: number | null;
  source_qty_delta?: number | null;
  related_entity_keys?: string[];
  qty_before: number | null;
  qty_after: number | null;
  source_id: string;
  source_no: string;
  source_type: string;
  actor: string;
  related_documents: GoodsTraceDocument[];
  source_quantity: number | null;
  entity_quantity: number | null;
  status: string;
  entity_key: string;
};
export type GoodsTraceEntity = {
  key: string;
  code: string;
  code_type: string;
  sku_code: string;
  sku_name: string;
  unit: string;
  warehouse_code: string;
  current_status: string;
  current_location: string;
  current_quantity: number | null;
  current_source_no: string;
  parent_code: string;
  parent_type: string;
};
export type GoodsTraceRelation = {
  parent_code: string;
  child_code: string;
  sku_code: string;
  quantity: number | null;
  location: string;
};
export type GoodsTraceData = {
  events: GoodsTraceEvent[];
  entities: GoodsTraceEntity[];
  relations: GoodsTraceRelation[];
  resolved: boolean | null;
  complete: boolean;
  loaded_count: number;
  total_count: number;
  data_as_of: string;
  warnings: string[];
};
type Raw = Record<string, unknown>;
const object = (value: unknown): Raw =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
const qty = (value: unknown): number | null => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const stringFields = (raw: Raw, keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, text(raw[key])]));
const eventStrings = [
  "id",
  "occurred_at",
  "recorded_at",
  "event_type",
  "event_label",
  "code",
  "sku_code",
  "sku_name",
  "warehouse_code",
  "location_before",
  "location_after",
  "source_id",
  "source_no",
  "source_type",
  "actor",
  "status",
  "entity_key",
];
const entityStrings = [
  "key",
  "code",
  "code_type",
  "sku_code",
  "sku_name",
  "unit",
  "warehouse_code",
  "current_status",
  "current_location",
  "current_source_no",
  "parent_code",
  "parent_type",
];

export function normalizeGoodsTraceData(value: unknown): GoodsTraceData {
  const raw = object(value);
  if (
    !Array.isArray(raw.events) ||
    !Array.isArray(raw.entities) ||
    !Array.isArray(raw.relations)
  )
    throw new Error("Dữ liệu truy vết không hợp lệ. Vui lòng thử lại.");
  const events = raw.events.map((entry): GoodsTraceEvent => {
    const item = object(entry);
    const change = qty(item.qty_delta);
    if (
      !text(item.id) ||
      item.qty_delta === undefined ||
      (item.qty_delta !== null && change === null)
    )
      throw new Error("Sự kiện truy vết thiếu mã hoặc số lượng biến động.");
    return {
      ...stringFields(item, eventStrings),
      qty_delta: change,
      source_qty_delta: qty(item.source_qty_delta),
      related_entity_keys: Array.isArray(item.related_entity_keys)
        ? item.related_entity_keys.filter(
            (key): key is string => typeof key === "string",
          )
        : [],
      quantity: qty(item.quantity),
      qty_before: qty(item.qty_before),
      qty_after: qty(item.qty_after),
      source_quantity: qty(item.source_quantity),
      entity_quantity: qty(item.entity_quantity),
      related_documents: Array.isArray(item.related_documents)
        ? item.related_documents.map((value) => {
            const doc = object(value);
            return {
              id: text(doc.id),
              code: text(doc.code),
              type: text(doc.type),
            };
          })
        : [],
    } as GoodsTraceEvent;
  });
  const entities = raw.entities.map((entry): GoodsTraceEntity => {
    const item = object(entry);
    return {
      ...stringFields(item, entityStrings),
      current_quantity: qty(item.current_quantity),
    } as GoodsTraceEntity;
  });
  const relations = raw.relations.map((entry): GoodsTraceRelation => {
    const item = object(entry);
    return {
      ...stringFields(item, [
        "parent_code",
        "child_code",
        "sku_code",
        "location",
      ]),
      quantity: qty(item.quantity),
    } as GoodsTraceRelation;
  });
  const loaded = qty(raw.loaded_count);
  const total = qty(raw.total_count);
  const countsValid =
    loaded !== null &&
    total !== null &&
    Number.isInteger(loaded) &&
    Number.isInteger(total) &&
    loaded >= 0 &&
    total >= loaded &&
    loaded === events.length;
  return {
    events,
    entities,
    relations,
    resolved: typeof raw.resolved === "boolean" ? raw.resolved : null,
    complete: raw.complete === true && countsValid && loaded === total,
    loaded_count: events.length,
    total_count:
      total !== null && total >= events.length ? total : events.length,
    data_as_of: text(raw.data_as_of),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  };
}

export function goodsTraceParams(
  query: GoodsTraceQuery,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] =
      key === "stock_only"
        ? value
          ? 1
          : 0
        : typeof value === "string"
          ? value.trim()
          : value;
  }
  return params;
}

export function useGoodsTraceReport(query: GoodsTraceQuery) {
  const params = goodsTraceParams(query);
  return useQuery({
    queryKey: ["reports", "goods-trace", params],
    queryFn: async ({ signal }) =>
      normalizeGoodsTraceData(
        await http.get<unknown>("/reports/goods-trace", { params, signal }),
      ),
    staleTime: CACHE_POLICIES.report.staleTime,
    retry: false,
  });
}

/** Only return verified module deep links; unsupported sources remain read-only metadata. */
export function goodsTraceSourcePath(type: string, id: string): string | null {
  if (!id) return null;
  const encoded = encodeURIComponent(id);
  if (/REVERSAL|REVERSE/.test(type.toUpperCase()))
    return `/reverse?screen=REV-02&id=${encoded}`;
  if (/WARRANTY/.test(type.toUpperCase()))
    return `/warranty?screen=WAR-03&id=${encoded}`;
  return null;
}
