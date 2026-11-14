import { useMemo } from "react";
import {
  useInventoryReconciliation,
  useSkuCatalog,
} from "@/modules/reports/operations/report-data";
import { listOf, n, text } from "@/modules/reports/operations/report-format";
import { buildDashboardThresholds } from "./dashboard-threshold-model";

/** Same threshold rules/catalog as the detail report, without its reconciliation evidence. */
export function useDashboardThresholdSource() {
  const source = useInventoryReconciliation({ view: "dashboard-thresholds" });
  const catalog = useSkuCatalog();
  const { entries, kindOfCode } = catalog;
  const summary = useMemo(() => {
    const rows = listOf(source.data?.rows)
      .map((row): Parameters<typeof buildDashboardThresholds>[0][number] => {
        const code = text(row.product_code, "");
        const kind = text(row.sku_type, "");
        return {
          sku_code: code,
          sku_name: text(row.product_name, ""),
          item_kind:
            kind === "PRODUCT" || kind === "COMPONENT"
              ? kind
              : (kindOfCode(code) ?? ""),
          available_qty: n(row.available_qty),
        };
      })
      .filter((row) => row.sku_code !== "");
    return buildDashboardThresholds(
      rows,
      new Map(
        entries.map((entry) => [
          entry.sku_code,
          {
            min_qty: entry.min_stock,
            max_qty: entry.max_stock,
          },
        ]),
      ),
    );
  }, [source.data, entries, kindOfCode]);
  return {
    summary,
    loading: source.isLoading || catalog.loading,
    error: source.error ?? catalog.error,
    hasSnapshot: source.dataUpdatedAt > 0 && catalog.entries.length > 0,
    refetch: () => Promise.all([source.refetch(), catalog.refetch()]),
  };
}
