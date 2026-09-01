import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Box, UiAlert, UiDatePicker, UiStatusBadge } from "@/shared/ui";
import {
  AuditOutlined,
  CheckCircleOutlined,
  StockOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ActionButton } from "@/shared/components/actions";
import { INVENTORY_STOCK_STATUS_LABELS } from "@/shared/constants/business-labels";
import { StackedBarChart } from "@/shared/components/charts/StackedBarChart";
import { DonutChart } from "@/shared/components/charts/DonutChart";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  fmt,
  fmtDateTime,
  itemKindLabel,
  listOf,
  n,
  pct,
  text,
  type ItemKind,
  type Raw,
} from "./report-format";
import {
  useInventoryBalance,
  useInventoryReconciliation,
  useMovementTrace,
  useSkuCatalog,
  useWarehouseOptions,
  useCategoryOptions,
} from "./report-data";
import {
  ChartCard,
  ChartGrid,
  DrillDownDialog,
  FilterBar,
  FormulaNote,
  ReportKpi,
  ReportKpiRow,
  ReportSectionHeading,
  SegmentedToggle,
} from "./report-ui";
import {
  AllOrPickFilter,
  ExportButtons,
  ItemKindFilter,
} from "./report-filters";
import {
  RECONCILE_LABELS,
  reconcileCheckLabel,
  STOCK_NORM_LABEL_KEYS,
  STOCK_NORM_TONE,
  stockStatusLabel,
  type StockNormState,
} from "./report-labels";
import { ReportPaginationBar, ReportRowDetailModal } from "./report-table";
import {
  sttColumn,
  toResponsiveColumns,
  useClientPagination,
  useReportColumnSort,
  visibleReportColumns,
  type ReportColumn,
} from "./report-columns";
import { MovementTable, ReportStatusBadge } from "./report-drilldown";
import { useReportExport } from "./report-export";

const STOCK_STATUSES = [
  "AVAILABLE",
  "NON_SELLABLE",
  "DEFECTIVE",
  "QUARANTINE",
] as const;

const STOCK_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: CHART_COLORS.success,
  NON_SELLABLE: CHART_COLORS.warning,
  DEFECTIVE: CHART_COLORS.danger,
  QUARANTINE: CHART_COLORS.info,
};

type TopMode = "10" | "20" | "all";

const topOptions = (
  t: TranslateFn,
): Array<{ value: TopMode; label: string }> => [
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
  { value: "all", label: t("reports.stockReconcile.mismatchAll") },
];

const normFilterOptions = (t: TranslateFn) =>
  (Object.keys(STOCK_NORM_LABEL_KEYS) as StockNormState[]).map((value) => ({
    value,
    label: t(STOCK_NORM_LABEL_KEYS[value]),
  }));

const RECONCILE_FILTER_OPTIONS = [
  { value: "MATCH", label: "MATCH" },
  { value: "MISMATCH", label: "MISMATCH" },
];

/** Mục 5: lọc bảng chi tiết theo NHÓM/TRẠNG THÁI tồn (khả dụng/không bán/lỗi/cách ly). */
const STOCK_STATUS_FILTER_OPTIONS = STOCK_STATUSES.map((value) => ({
  value,
  label: stockStatusLabel(value),
}));

type SkuAggregate = {
  product_code: string;
  product_name: string;
  kind: ItemKind;
  available: number;
  onHand: number;
  ledger: number;
  variance: number;
  reconcile: "MATCH" | "MISMATCH";
  /** On-hand tách theo trạng thái tồn (AVAILABLE/NON_SELLABLE/DEFECTIVE/QUARANTINE). */
  statusQty: Record<string, number>;
  /** Mã các check §7.5 đang lệch, gom từ mọi dòng (kho × trạng thái) của SKU. */
  mismatchChecks: string[];
  minQty: number | null;
  maxQty: number | null;
  normState: StockNormState;
  normGap: number | null;
  updatedAt: string;
};

function normStateOf(
  available: number,
  min: number | null,
  max: number | null,
): { state: StockNormState; gap: number | null } {
  if (min === null && max === null) return { state: "UNSET", gap: null };
  if (min !== null && available < min) {
    return { state: "LOW", gap: available - min };
  }
  if (max !== null && available > max) {
    return { state: "OVER", gap: available - max };
  }
  return { state: "NORMAL", gap: min !== null ? available - min : null };
}

/**
 * Tab 2 — Tồn kho và đối soát.
 *
 * 2.1–2.3 mô tả CÙNG một tập tồn kho hiện tại dưới ba câu hỏi khác nhau (cơ cấu
 * trạng thái, tỉ lệ khớp sổ, SKU lệch nhiều nhất) nên dùng chung một bộ lọc
 * loại hàng; 2.4 và 2.5 là hai bảng tra cứu có bộ lọc riêng.
 */
export default function TabStockReconcile() {
  const t = useT();
  const catalog = useSkuCatalog();
  const warehouses = useWarehouseOptions();
  const categories = useCategoryOptions();
  const exporter = useReportExport();

  const [chartKind, setChartKind] = useState<ItemKind>("all");
  const [warehouseId, setWarehouseId] = useState("");
  const [structureKind, setStructureKind] = useState<"PRODUCT" | "COMPONENT">(
    "PRODUCT",
  );
  const [topMode, setTopMode] = useState<TopMode>("10");
  const [asOf, setAsOf] = useState<Dayjs | null>(null);

  const asOfDate = asOf ? asOf.format("YYYY-MM-DD") : undefined;
  const balance = useInventoryBalance({
    warehouseId: warehouseId || undefined,
    asOf: asOfDate,
  });
  // Chốt số liệu tại một ngày quá khứ thì đối soát sổ ↔ số dư không áp dụng,
  // nên không gọi endpoint đối soát và bảng chuyển hẳn sang nguồn ảnh chụp.
  const reconciliation = useInventoryReconciliation({
    warehouseId: warehouseId || undefined,
    enabled: !asOfDate,
  });

  const kindOf = (code: unknown): ItemKind => catalog.kindOfCode(code) ?? "all";

  /** Dòng đối soát (đã có đủ 4 phép kiểm) là nguồn chính; balance là dự phòng. */
  const sourceRows = useMemo(() => {
    if (asOfDate) return listOf(balance.data?.rows);
    const reconcileRows = listOf(reconciliation.data?.rows);
    return reconcileRows.length > 0
      ? reconcileRows
      : listOf(balance.data?.rows);
  }, [reconciliation.data, balance.data, asOfDate]);

  // ── 2.1 Cơ cấu tồn kho hiện tại ────────────────────────────────────────
  const structureSegments = useMemo(() => {
    const rows = sourceRows.filter(
      (row) => kindOf(row.product_code) === structureKind,
    );
    return STOCK_STATUSES.map((status) => ({
      label: stockStatusLabel(status),
      value: rows
        .filter((row) => text(row.stock_status) === status)
        .reduce((acc, row) => acc + n(row.on_hand_qty), 0),
      color: STOCK_STATUS_COLORS[status],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRows, structureKind, catalog]);

  const structureTotal = structureSegments.reduce(
    (acc, segment) => acc + segment.value,
    0,
  );

  // ── Gộp theo SKU (dùng cho 2.2 / 2.3 / 2.4 / 2.5) ──────────────────────
  const skuAggregates = useMemo<SkuAggregate[]>(() => {
    const byCode = new Map<string, SkuAggregate>();
    for (const row of sourceRows) {
      const code = text(row.product_code, "");
      if (code === "") continue;
      const entry = catalog.byCode.get(code);
      const current = byCode.get(code) ?? {
        product_code: code,
        product_name: text(row.product_name, entry?.sku_name ?? ""),
        kind: (entry?.sku_type ?? "all") as ItemKind,
        available: 0,
        onHand: 0,
        ledger: 0,
        variance: 0,
        reconcile: "MATCH" as const,
        statusQty: {} as Record<string, number>,
        mismatchChecks: [] as string[],
        minQty: entry?.min_stock ?? null,
        maxQty: entry?.max_stock ?? null,
        normState: "UNSET" as StockNormState,
        normGap: null,
        updatedAt: "",
      };
      current.available += n(row.available_qty);
      current.onHand += n(row.on_hand_qty);
      current.ledger += n(row.ledger_qty);
      current.variance += n(row.variance);
      const stockStatus = text(row.stock_status, "");
      if (stockStatus !== "") {
        current.statusQty[stockStatus] =
          (current.statusQty[stockStatus] ?? 0) + n(row.on_hand_qty);
      }
      const status = text(
        row.reconciliation_overall ?? row.reconciliation_status,
        "",
      );
      if (status === "MISMATCH") current.reconcile = "MISMATCH";
      // Variance cộng dồn qua nhiều dòng có thể triệt tiêu về 0, và ba check sổ
      // phụ vốn không sinh variance — không giữ lại mã check thì bảng chỉ còn
      // "Có chênh lệch" trống nghĩa.
      for (const code of listOf(row.mismatch_checks as unknown)) {
        const key = text(code, "");
        if (key !== "" && !current.mismatchChecks.includes(key)) {
          current.mismatchChecks.push(key);
        }
      }
      const updated = text(row.updated_at, "");
      if (updated > current.updatedAt) current.updatedAt = updated;
      byCode.set(code, current);
    }
    return [...byCode.values()].map((entry) => {
      const norm = normStateOf(entry.available, entry.minQty, entry.maxQty);
      return { ...entry, normState: norm.state, normGap: norm.gap };
    });
  }, [sourceRows, catalog]);

  const chartAggregates = useMemo(
    () =>
      skuAggregates.filter(
        (entry) => chartKind === "all" || entry.kind === chartKind,
      ),
    [skuAggregates, chartKind],
  );

  // ── 2.2 Tỷ lệ đối soát ─────────────────────────────────────────────────
  const matchCount = chartAggregates.filter(
    (entry) => entry.reconcile === "MATCH",
  ).length;
  const mismatchCount = chartAggregates.length - matchCount;

  const [reconcileDrill, setReconcileDrill] = useState<
    "MATCH" | "MISMATCH" | null
  >(null);

  // ── 2.3 Top SKU chênh lệch ─────────────────────────────────────────────
  const mismatchAggregates = useMemo(
    () =>
      chartAggregates
        .filter((entry) => entry.reconcile === "MISMATCH")
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
    [chartAggregates],
  );

  const topRows = useMemo(() => {
    if (topMode === "all") return mismatchAggregates;
    return mismatchAggregates.slice(0, Number(topMode));
  }, [mismatchAggregates, topMode]);

  // ── Drill-down movement của một SKU ────────────────────────────────────
  const [skuDrill, setSkuDrill] = useState<string | null>(null);
  const skuMovements = useMovementTrace({
    from: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
    enabled: skuDrill !== null,
  });
  const skuMovementRows = useMemo(
    () =>
      listOf(skuMovements.data?.rows).filter(
        (row) => text(row.product_code) === skuDrill,
      ),
    [skuMovements.data, skuDrill],
  );

  // ── 2.4 Cảnh báo định mức tồn kho ──────────────────────────────────────
  const [normState, setNormState] = useState("");
  const [normKind, setNormKind] = useState<ItemKind>("all");
  const [normKeyword, setNormKeyword] = useState("");

  const normRows = useMemo(
    () =>
      skuAggregates.filter((entry) => {
        if (normState && entry.normState !== normState) return false;
        if (normKind !== "all" && entry.kind !== normKind) return false;
        if (normKeyword.trim()) {
          const keyword = normKeyword.trim().toLowerCase();
          const haystack =
            `${entry.product_code} ${entry.product_name}`.toLowerCase();
          if (!haystack.includes(keyword)) return false;
        }
        return true;
      }),
    [skuAggregates, normState, normKind, normKeyword],
  );

  const normPagination = useClientPagination(normRows, 10);

  // ── 2.5 Chi tiết tồn kho & đối soát ────────────────────────────────────
  const [detailKind, setDetailKind] = useState<ItemKind>("all");
  const [detailReconcile, setDetailReconcile] = useState("");
  const [detailNorm, setDetailNorm] = useState("");
  const [detailStockStatus, setDetailStockStatus] = useState("");
  const [detailCategory, setDetailCategory] = useState("");
  const [detailKeyword, setDetailKeyword] = useState("");
  const [detailRow, setDetailRow] = useState<{
    row: Raw;
    index: number;
  } | null>(null);

  const detailRows = useMemo(() => {
    return skuAggregates
      .filter((entry) => {
        if (detailKind !== "all" && entry.kind !== detailKind) return false;
        if (detailReconcile && entry.reconcile !== detailReconcile)
          return false;
        if (detailNorm && entry.normState !== detailNorm) return false;
        if (
          detailStockStatus &&
          (entry.statusQty[detailStockStatus] ?? 0) === 0
        ) {
          return false;
        }
        if (detailCategory) {
          const catalogEntry = catalog.byCode.get(entry.product_code);
          if (catalogEntry?.category_id !== detailCategory) return false;
        }
        if (detailKeyword.trim()) {
          const keyword = detailKeyword.trim().toLowerCase();
          const haystack =
            `${entry.product_code} ${entry.product_name}`.toLowerCase();
          if (!haystack.includes(keyword)) return false;
        }
        return true;
      })
      .map(
        (entry): Raw => ({
          product_code: entry.product_code,
          product_name: entry.product_name,
          item_kind: entry.kind,
          available_qty: entry.available,
          on_hand_qty: entry.onHand,
          ledger_qty: entry.ledger,
          variance: entry.variance,
          reconciliation_status: entry.reconcile,
          mismatch_checks: entry.mismatchChecks,
          min_qty: entry.minQty,
          max_qty: entry.maxQty,
          norm_state: entry.normState,
          updated_at: entry.updatedAt,
        }),
      );
  }, [
    skuAggregates,
    detailKind,
    detailReconcile,
    detailNorm,
    detailStockStatus,
    detailCategory,
    detailKeyword,
    catalog,
  ]);

  const detailPagination = useClientPagination(detailRows, 15);

  const detailColumns = useMemo<ReportColumn[]>(
    () => [
      sttColumn(detailPagination.page, detailPagination.perPage),
      {
        title: "SKU",
        dataIndex: "product_code",
        width: 160,
        fixed: "left",
        sorter: (a, b) =>
          text(a.product_code, "").localeCompare(
            text(b.product_code, ""),
            "vi",
          ),
        render: (value) => (
          <Box
            component="button"
            type="button"
            onClick={() => setSkuDrill(text(value, ""))}
            sx={{
              font: "inherit",
              fontWeight: 700,
              color: "primary.main",
              background: "none",
              border: 0,
              p: 0,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {text(value)}
          </Box>
        ),
      },
      {
        title: t("reports.stockReconcile.colName"),
        dataIndex: "product_name",
        sorter: (a, b) =>
          text(a.product_name, "").localeCompare(
            text(b.product_name, ""),
            "vi",
          ),
        render: (value) => text(value),
      },
      {
        title: t("reports.stockReconcile.colItemKind"),
        dataIndex: "item_kind",
        width: 120,
        render: (value) => itemKindLabel(text(value, ""), t),
      },
      {
        title: "Available Qty",
        dataIndex: "available_qty",
        align: "right",
        width: 130,
        sortType: "value",
        sorter: (a, b) => n(a.available_qty) - n(b.available_qty),
        render: fmt,
      },
      {
        title: "Inventory Balance",
        dataIndex: "on_hand_qty",
        align: "right",
        width: 150,
        sortType: "value",
        sorter: (a, b) => n(a.on_hand_qty) - n(b.on_hand_qty),
        render: fmt,
      },
      {
        title: "Movement Calculated",
        dataIndex: "ledger_qty",
        align: "right",
        width: 175,
        sortType: "value",
        sorter: (a, b) => n(a.ledger_qty) - n(b.ledger_qty),
        render: fmt,
      },
      {
        title: t("reports.stockReconcile.colVariance"),
        dataIndex: "variance",
        align: "right",
        width: 130,
        sortType: "value",
        sorter: (a, b) => n(a.variance) - n(b.variance),
        render: (value) => {
          const amount = n(value);
          return (
            <Box
              component="span"
              sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
              data-variance={amount === 0 ? "zero" : "nonzero"}
            >
              {amount > 0 ? "+" : amount < 0 ? "−" : ""}
              {fmt(Math.abs(amount))}
            </Box>
          );
        },
      },
      {
        title: t("reports.stockReconcile.colReconcileStatus"),
        dataIndex: "reconciliation_status",
        width: 210,
        render: (value, row) => {
          const checks = listOf(row.mismatch_checks as unknown)
            .map((code) => reconcileCheckLabel(text(code, ""), t))
            .filter((label) => label !== "");
          const reason = checks.join(", ");
          return (
            <Box>
              <ReportStatusBadge
                value={value}
                label={RECONCILE_LABELS[text(value, "")] ?? text(value)}
                title={
                  reason === ""
                    ? undefined
                    : t("reports.stockReconcile.mismatchTooltip", { reason })
                }
              />
              {reason === "" ? null : (
                <Box sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
                  {t("reports.stockReconcile.mismatchAt", { reason })}
                </Box>
              )}
            </Box>
          );
        },
      },
      {
        title: "Min Qty",
        dataIndex: "min_qty",
        align: "right",
        width: 110,
        sortType: "value",
        sorter: (a, b) => n(a.min_qty, -1) - n(b.min_qty, -1),
        render: (value) => (value === null ? EMPTY_TEXT : fmt(value)),
      },
      {
        title: "Max Qty",
        dataIndex: "max_qty",
        align: "right",
        width: 110,
        sortType: "value",
        sorter: (a, b) => n(a.max_qty, -1) - n(b.max_qty, -1),
        render: (value) => (value === null ? EMPTY_TEXT : fmt(value)),
      },
      {
        title: t("reports.stockReconcile.colThresholdStatus"),
        dataIndex: "norm_state",
        width: 165,
        detailOnly: true,
        render: (value) => {
          const state = text(value, "UNSET") as StockNormState;
          return (
            <UiStatusBadge
              size="small"
              tone={STOCK_NORM_TONE[state]}
              label={t(STOCK_NORM_LABEL_KEYS[state])}
            />
          );
        },
      },
      {
        title: t("reports.stockReconcile.colUpdatedAt"),
        dataIndex: "updated_at",
        width: 165,
        sorter: (a, b) =>
          text(a.updated_at, "").localeCompare(text(b.updated_at, "")),
        render: (value) => (value ? fmtDateTime(value) : EMPTY_TEXT),
      },
    ],
    [detailPagination.page, detailPagination.perPage, setSkuDrill, t],
  );

  const detailTableColumns = useMemo(
    () => visibleReportColumns(detailColumns),
    [detailColumns],
  );
  const { sortedRows, sortState, onSortChange } = useReportColumnSort(
    detailTableColumns,
    detailPagination.pageRows,
  );
  const responsiveColumns = toResponsiveColumns(detailTableColumns, sortedRows);

  const loading = balance.isLoading || reconciliation.isLoading;
  const error = reconciliation.error ?? balance.error;

  const totalAvailable = chartAggregates.reduce(
    (acc, entry) => acc + entry.available,
    0,
  );
  const lowCount = skuAggregates.filter(
    (entry) => entry.normState === "LOW",
  ).length;
  const overCount = skuAggregates.filter(
    (entry) => entry.normState === "OVER",
  ).length;

  return (
    <Box data-testid="rpt-tab-stock-reconcile">
      <ReportSectionHeading
        id="rpt-tab2-heading"
        title={t("reports.stockReconcile.title")}
        description={t("reports.stockReconcile.description")}
      />

      <FilterBar
        label={t("reports.stockReconcile.chartFilterLabel")}
        hint={t("reports.stockReconcile.chartFilterHint")}
      >
        <ItemKindFilter value={chartKind} onChange={setChartKind} />
        <AllOrPickFilter
          value={warehouseId}
          onChange={setWarehouseId}
          options={warehouses.options}
          allLabel={t("reports.stockReconcile.warehouseAll")}
          ariaLabel="Kho"
          minWidth={210}
        />
        <UiDatePicker
          placeholder={t("reports.stockReconcile.asOfPlaceholder")}
          aria-label={t("reports.stockReconcile.asOfAria")}
          value={asOf}
          onChange={setAsOf}
        />
      </FilterBar>

      {balance.data?.as_of_snapshot ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="warning">
            {t("reports.stockReconcile.asOfNote", {
              date: text(balance.data.as_of),
            })}
          </UiAlert>
        </Box>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label={t("reports.stockReconcile.kpiAvailable")}
          value={fmt(totalAvailable)}
          tone="primary"
          icon={<StockOutlined />}
          hint={t("reports.stockReconcile.kpiAvailableHint", {
            count: fmt(chartAggregates.length),
          })}
        />
        <ReportKpi
          label={t("reports.stockReconcile.kpiMatched")}
          value={fmt(matchCount)}
          tone="success"
          icon={<CheckCircleOutlined />}
          hint={pct(matchCount, chartAggregates.length)}
          onClick={() => setReconcileDrill("MATCH")}
        />
        <ReportKpi
          label={t("reports.stockReconcile.kpiMismatched")}
          value={fmt(mismatchCount)}
          tone="error"
          icon={<AuditOutlined />}
          hint={pct(mismatchCount, chartAggregates.length)}
          onClick={() => setReconcileDrill("MISMATCH")}
        />
        <ReportKpi
          label={t("reports.stockReconcile.kpiLowStock")}
          value={fmt(lowCount)}
          tone="warning"
          icon={<WarningOutlined />}
          hint={t("reports.stockReconcile.kpiLowStockHint")}
          onClick={() => {
            setNormState("LOW");
            setNormKind("all");
          }}
        />
        <ReportKpi
          label={t("reports.stockReconcile.kpiOverStock")}
          value={fmt(overCount)}
          tone="info"
          icon={<WarningOutlined />}
          hint={t("reports.stockReconcile.kpiOverStockHint")}
          onClick={() => {
            setNormState("OVER");
            setNormKind("all");
          }}
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title={t("reports.stockReconcile.structureTitle")}
          description={t("reports.stockReconcile.structureDescription")}
          loading={loading}
          error={error}
          onRetry={() => void reconciliation.refetch()}
          empty={structureTotal === 0}
          emptyText={t("reports.stockReconcile.structureEmpty", {
            kind:
              structureKind === "PRODUCT"
                ? t("reports.itemKind.product")
                : t("reports.itemKind.component"),
          })}
          toolbar={
            <SegmentedToggle
              label={t("reports.stockReconcile.structureToggleLabel")}
              value={structureKind}
              onChange={setStructureKind}
              options={[
                { value: "PRODUCT", label: t("reports.itemKind.product") },
                { value: "COMPONENT", label: t("reports.itemKind.component") },
              ]}
            />
          }
          footer={
            <FormulaNote>
              {t("reports.stockReconcile.structureNote")} {fmt(structureTotal)}.
            </FormulaNote>
          }
        >
          <StackedBarChart
            segments={structureSegments}
            height={180}
            barLabel={
              structureKind === "PRODUCT"
                ? t("reports.itemKind.product")
                : t("reports.itemKind.component")
            }
            valueFormatter={fmt}
          />
        </ChartCard>

        <ChartCard
          title={t("reports.stockReconcile.reconcileRatioTitle")}
          description={t("reports.stockReconcile.reconcileRatioDescription")}
          loading={loading}
          error={error}
          onRetry={() => void reconciliation.refetch()}
          empty={chartAggregates.length === 0}
        >
          <DonutChart
            items={[
              {
                label: "MATCH",
                value: matchCount,
                color: CHART_COLORS.success,
              },
              {
                label: "MISMATCH",
                value: mismatchCount,
                color: CHART_COLORS.danger,
              },
            ]}
            centerLabel={t("reports.stockReconcile.reconcileCenter")}
            valueFormatter={fmt}
            onSelect={(item) =>
              setReconcileDrill(item.label === "MATCH" ? "MATCH" : "MISMATCH")
            }
          />
        </ChartCard>
      </ChartGrid>

      <ChartCard
        title={t("reports.stockReconcile.topMismatchTitle")}
        description={t("reports.stockReconcile.topMismatchDescription")}
        fullWidth
        loading={loading}
        error={error}
        onRetry={() => void reconciliation.refetch()}
        empty={topRows.length === 0}
        emptyText={t("reports.stockReconcile.topMismatchEmpty")}
        toolbar={
          <SegmentedToggle
            label={t("reports.stockReconcile.topMismatchCount")}
            value={topMode}
            onChange={setTopMode}
            options={topOptions(t)}
          />
        }
      >
        {topMode === "all" ? (
          // Toàn bộ mismatch có thể lên tới hàng trăm SKU — một bar chart dài
          // vô hạn không đọc được, nên chuyển hẳn sang bảng theo yêu cầu 2.3.
          <ResponsiveDataTable<SkuAggregate>
            columns={[
              {
                key: "product_code",
                header: "SKU",
                render: (row) => (
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setSkuDrill(row.product_code)}
                    sx={{
                      font: "inherit",
                      fontWeight: 700,
                      color: "primary.main",
                      background: "none",
                      border: 0,
                      p: 0,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {row.product_code}
                  </Box>
                ),
              },
              {
                key: "product_name",
                header: t("reports.stockReconcile.colSkuName"),
                render: (row) => row.product_name || EMPTY_TEXT,
              },
              {
                key: "onHand",
                header: "Inventory Balance",
                align: "right",
                render: (row) => fmt(row.onHand),
              },
              {
                key: "ledger",
                header: "Movement Calculated",
                align: "right",
                render: (row) => fmt(row.ledger),
              },
              {
                key: "variance",
                header: t("reports.stockReconcile.colVariance"),
                align: "right",
                render: (row) => (
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {row.variance > 0 ? "+" : row.variance < 0 ? "−" : ""}
                    {fmt(Math.abs(row.variance))}
                  </Box>
                ),
              },
            ]}
            rows={topRows}
            rowKey={(row) => row.product_code}
            emptyText={t("reports.stockReconcile.mismatchTableEmpty")}
          />
        ) : (
          <MultiSeriesBarChart
            horizontal
            categories={topRows.map((row) => row.product_code)}
            series={[
              {
                name: "Inventory Balance",
                data: topRows.map((row) => row.onHand),
                color: CHART_COLORS.primary,
              },
              {
                name: "Movement Calculated",
                data: topRows.map((row) => row.ledger),
                color: CHART_COLORS.info,
              },
              {
                name: t("reports.stockReconcile.colVariance"),
                data: topRows.map((row) => row.variance),
                color: CHART_COLORS.danger,
              },
            ]}
            valueFormatter={fmt}
            onSelect={(payload) => setSkuDrill(payload.category)}
          />
        )}
      </ChartCard>

      <Box sx={{ height: 16 }} />

      <ReportSectionHeading
        id="rpt-tab2-norm"
        title={t("reports.stockReconcile.thresholdTitle")}
        description={t("reports.stockReconcile.thresholdDescription")}
      />

      <FilterBar
        label={t("reports.stockReconcile.thresholdFilterLabel")}
        hint={`${fmt(normRows.length)} SKU`}
      >
        <AllOrPickFilter
          value={normState}
          onChange={setNormState}
          options={normFilterOptions(t)}
          allLabel={t("reports.stockReconcile.thresholdStatusAll")}
          ariaLabel={t("reports.stockReconcile.thresholdStatusAria")}
          minWidth={220}
        />
        <ItemKindFilter value={normKind} onChange={setNormKind} />
        <SearchInput
          width={260}
          placeholder={t("reports.stockReconcile.skuSearchPlaceholder")}
          aria-label={t("reports.stockReconcile.skuSearchAria")}
          value={normKeyword}
          onChange={setNormKeyword}
        />
      </FilterBar>

      {catalog.entries.length > 0 &&
      skuAggregates.every((entry) => entry.normState === "UNSET") ? (
        <Box sx={{ mb: 1.5 }}>
          <UiAlert tone="info">
            {t("reports.stockReconcile.noThresholdNote")}
          </UiAlert>
        </Box>
      ) : null}

      <ResponsiveDataTable<SkuAggregate>
        columns={[
          {
            key: "product_code",
            header: "SKU",
            render: (row) => (
              <Box
                component="button"
                type="button"
                onClick={() => setSkuDrill(row.product_code)}
                sx={{
                  font: "inherit",
                  fontWeight: 700,
                  color: "primary.main",
                  background: "none",
                  border: 0,
                  p: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {row.product_code}
              </Box>
            ),
          },
          {
            key: "product_name",
            header: t("reports.stockReconcile.colProductName"),
            render: (row) => row.product_name || EMPTY_TEXT,
          },
          {
            key: "kind",
            header: t("reports.stockReconcile.colItemKind"),
            width: 120,
            render: (row) => itemKindLabel(row.kind, t),
          },
          {
            key: "available",
            header: "Available Qty",
            align: "right",
            width: 130,
            sortAccessor: (row) => row.available,
            render: (row) => fmt(row.available),
          },
          {
            key: "min",
            header: "Min Qty",
            align: "right",
            width: 110,
            render: (row) =>
              row.minQty === null ? EMPTY_TEXT : fmt(row.minQty),
          },
          {
            key: "max",
            header: "Max Qty",
            align: "right",
            width: 110,
            render: (row) =>
              row.maxQty === null ? EMPTY_TEXT : fmt(row.maxQty),
          },
          {
            key: "gap",
            header: t("reports.stockReconcile.colVariance"),
            align: "right",
            width: 130,
            sortAccessor: (row) => row.normGap ?? 0,
            render: (row) =>
              row.normGap === null ? (
                EMPTY_TEXT
              ) : (
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {row.normGap > 0 ? "+" : row.normGap < 0 ? "−" : ""}
                  {fmt(Math.abs(row.normGap))}
                </Box>
              ),
          },
          {
            key: "state",
            header: t("reports.stockReconcile.colStatus"),
            width: 150,
            render: (row) => (
              <UiStatusBadge
                size="small"
                tone={STOCK_NORM_TONE[row.normState]}
                label={t(STOCK_NORM_LABEL_KEYS[row.normState])}
              />
            ),
          },
        ]}
        rows={normPagination.pageRows}
        rowKey={(row) => row.product_code}
        loading={loading}
        emptyText={t("reports.stockReconcile.detailEmpty")}
      />
      <ReportPaginationBar
        page={normPagination.page}
        perPage={normPagination.perPage}
        total={normPagination.total}
        onPageChange={normPagination.setPage}
        onPageSizeChange={normPagination.setPerPage}
      />

      <Box sx={{ height: 16 }} />

      <ReportSectionHeading
        id="rpt-tab2-detail"
        title={t("reports.stockReconcile.detailTitle")}
        description={t("reports.stockReconcile.detailDescription")}
      />

      <FilterBar
        label={t("reports.stockReconcile.detailFilterLabel")}
        hint={`${fmt(detailRows.length)} SKU`}
        actions={
          <ExportButtons
            exporting={exporter.exporting}
            disabled={loading}
            onExport={(format) =>
              void exporter.exportReport(format, {
                reportCode: "inventory-balance",
                fileStem: "ton-kho-doi-soat",
                filters: {
                  ...(warehouseId ? { warehouse_id: warehouseId } : {}),
                  ...(detailKeyword.trim()
                    ? { keyword: detailKeyword.trim() }
                    : {}),
                },
              })
            }
          />
        }
      >
        <SearchInput
          width={260}
          placeholder={t("reports.stockReconcile.skuSearchPlaceholder")}
          aria-label={t("reports.stockReconcile.detailSearchAria")}
          value={detailKeyword}
          onChange={setDetailKeyword}
        />
        <AllOrPickFilter
          value={detailCategory}
          onChange={setDetailCategory}
          options={categories.options}
          allLabel={t("reports.stockReconcile.categoryAll")}
          ariaLabel={t("reports.stockReconcile.categoryAria")}
          minWidth={210}
        />
        <ItemKindFilter value={detailKind} onChange={setDetailKind} />
        <AllOrPickFilter
          value={detailStockStatus}
          onChange={setDetailStockStatus}
          options={STOCK_STATUS_FILTER_OPTIONS}
          allLabel={t("reports.stockReconcile.stockStatusAll")}
          ariaLabel={t("reports.stockReconcile.stockStatusAria")}
          minWidth={210}
        />
        <AllOrPickFilter
          value={detailReconcile}
          onChange={setDetailReconcile}
          options={RECONCILE_FILTER_OPTIONS}
          allLabel={t("reports.stockReconcile.reconcileAll")}
          ariaLabel={t("reports.stockReconcile.reconcileAria")}
        />
        <AllOrPickFilter
          value={detailNorm}
          onChange={setDetailNorm}
          options={normFilterOptions(t)}
          allLabel={t("reports.stockReconcile.thresholdStatusAll")}
          ariaLabel={t("reports.stockReconcile.detailThresholdAria")}
          minWidth={220}
        />
      </FilterBar>

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title={t("reports.common.exportDenied")}
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      <ResponsiveDataTable<Raw>
        columns={responsiveColumns}
        rows={sortedRows}
        rowKey={(row) => text(row.product_code, "")}
        loading={loading}
        sortState={sortState}
        onSortChange={onSortChange}
        emptyText={t("reports.stockReconcile.detailEmpty")}
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label={t("reports.stockReconcile.detailRowAria")}
            sx={{ whiteSpace: "nowrap" }}
            onClick={() =>
              setDetailRow({ row, index: sortedRows.indexOf(row) })
            }
          />
        )}
      />
      <ReportPaginationBar
        page={detailPagination.page}
        perPage={detailPagination.perPage}
        total={detailPagination.total}
        onPageChange={detailPagination.setPage}
        onPageSizeChange={detailPagination.setPerPage}
      />

      {reconcileDrill ? (
        <DrillDownDialog
          title={t("reports.stockReconcile.reconcileDrillTitle", {
            state:
              reconcileDrill === "MATCH"
                ? t("reports.stockReconcile.reconcileDrillMatch")
                : t("reports.stockReconcile.reconcileDrillMismatch"),
          })}
          subtitle={t("reports.stockReconcile.reconcileDrillSubtitle", {
            count: fmt(reconcileDrill === "MATCH" ? matchCount : mismatchCount),
          })}
          onClose={() => setReconcileDrill(null)}
        >
          <ResponsiveDataTable<SkuAggregate>
            columns={[
              {
                key: "product_code",
                header: "SKU",
                render: (row) => (
                  <Box
                    component="button"
                    type="button"
                    onClick={() => {
                      setReconcileDrill(null);
                      setSkuDrill(row.product_code);
                    }}
                    sx={{
                      font: "inherit",
                      fontWeight: 700,
                      color: "primary.main",
                      background: "none",
                      border: 0,
                      p: 0,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {row.product_code}
                  </Box>
                ),
              },
              {
                key: "product_name",
                header: t("reports.stockReconcile.colSkuName"),
                render: (row) => row.product_name || EMPTY_TEXT,
              },
              {
                key: "onHand",
                header: "Balance",
                align: "right",
                render: (row) => fmt(row.onHand),
              },
              {
                key: "ledger",
                header: "Movement",
                align: "right",
                render: (row) => fmt(row.ledger),
              },
              {
                key: "variance",
                header: t("reports.stockReconcile.colVariance"),
                align: "right",
                render: (row) => fmt(row.variance),
              },
            ]}
            rows={chartAggregates.filter(
              (entry) => entry.reconcile === reconcileDrill,
            )}
            rowKey={(row) => row.product_code}
            emptyText={t("reports.stockReconcile.drillEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {skuDrill ? (
        <DrillDownDialog
          title={t("reports.stockReconcile.skuMovementTitle", {
            sku: skuDrill,
          })}
          subtitle={t("reports.stockReconcile.skuMovementSubtitle")}
          onClose={() => setSkuDrill(null)}
        >
          <MovementTable
            rows={skuMovementRows}
            loading={skuMovements.isLoading}
            emptyText={t("reports.stockReconcile.skuMovementEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {detailRow ? (
        <ReportRowDetailModal
          title={t("reports.stockReconcile.skuDetailTitle", {
            code: text(detailRow.row.product_code),
          })}
          columns={detailColumns}
          row={detailRow.row}
          rowIndex={detailRow.index}
          onClose={() => setDetailRow(null)}
          extra={
            <Box sx={{ typography: "caption", color: "text.secondary" }}>
              {t("reports.stockReconcile.skuDetailNote")}{" "}
              {STOCK_STATUSES.map(
                (status) => INVENTORY_STOCK_STATUS_LABELS[status] ?? status,
              ).join(" · ")}
              .
            </Box>
          }
        />
      ) : null}
    </Box>
  );
}
