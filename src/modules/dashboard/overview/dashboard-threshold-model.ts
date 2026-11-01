import type {
  StockReconcileRow,
  SkuThreshold,
} from "@/modules/reports/stock-reconcile/stock-reconcile-api";

export type DashboardThresholdRow = {
  sku: string;
  name: string;
  kind: string;
  available: number;
  min: number | null;
  max: number | null;
  state: "low" | "high" | "ok";
};

/** Một SKU có thể có nhiều kho và nhiều trạng thái; ngưỡng chỉ so với tổng khả dụng. */
export function buildDashboardThresholds(
  rows: Pick<
    StockReconcileRow,
    "sku_code" | "sku_name" | "item_kind" | "available_qty"
  >[],
  thresholds: Map<string, SkuThreshold>,
) {
  const bySku = new Map<string, DashboardThresholdRow>();
  for (const [sku, limit] of thresholds) {
    // null nghĩa là chưa đặt; 0 là ngưỡng hợp lệ.
    if (limit.min_qty === null && limit.max_qty === null) continue;
    bySku.set(sku, {
      sku,
      name: "",
      kind: "",
      available: 0,
      min: limit.min_qty,
      max: limit.max_qty,
      state: "ok",
    });
  }
  for (const row of rows) {
    const current = bySku.get(row.sku_code);
    if (!current) continue;
    current.available += row.available_qty;
    current.name ||= row.sku_name;
    current.kind ||= row.item_kind;
  }
  const configuredRows = [...bySku.values()]
    .map((row) => ({
      ...row,
      state:
        row.min !== null && row.available < row.min
          ? ("low" as const)
          : row.max !== null && row.available > row.max
            ? ("high" as const)
            : ("ok" as const),
    }))
    .sort(
      (a, b) =>
        (a.state === "ok" ? 1 : 0) - (b.state === "ok" ? 1 : 0) ||
        a.sku.localeCompare(b.sku),
    );
  return {
    rows: configuredRows,
    configured: configuredRows.length,
    unconfigured: Math.max(0, thresholds.size - configuredRows.length),
    below: configuredRows.filter((row) => row.state === "low").length,
    above: configuredRows.filter((row) => row.state === "high").length,
  };
}
