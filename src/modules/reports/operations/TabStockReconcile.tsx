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
  ITEM_KIND_LABELS,
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
  STOCK_NORM_LABELS,
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

const TOP_OPTIONS = [
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
  { value: "all", label: "Tất cả mismatch" },
] as const;

type TopMode = (typeof TOP_OPTIONS)[number]["value"];

const NORM_FILTER_OPTIONS = (
  Object.keys(STOCK_NORM_LABELS) as StockNormState[]
).map((value) => ({ value, label: STOCK_NORM_LABELS[value] }));

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
        title: "Tên",
        dataIndex: "product_name",
        sorter: (a, b) =>
          text(a.product_name, "").localeCompare(
            text(b.product_name, ""),
            "vi",
          ),
        render: (value) => text(value),
      },
      {
        title: "Loại hàng",
        dataIndex: "item_kind",
        width: 120,
        render: (value) =>
          ITEM_KIND_LABELS[text(value, "")] ?? "Chưa phân loại",
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
        title: "Chênh lệch",
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
        title: "Trạng thái đối soát",
        dataIndex: "reconciliation_status",
        width: 210,
        render: (value, row) => {
          const checks = listOf(row.mismatch_checks as unknown)
            .map((code) => reconcileCheckLabel(text(code, "")))
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
                    : `Lệch ở: ${reason}. Cột "Chênh lệch" chỉ đo Sổ cái ↔ số dư.`
                }
              />
              {reason === "" ? null : (
                <Box sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
                  Lệch ở: {reason}
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
        title: "Trạng thái định mức",
        dataIndex: "norm_state",
        width: 165,
        detailOnly: true,
        render: (value) => {
          const state = text(value, "UNSET") as StockNormState;
          return (
            <UiStatusBadge
              size="small"
              tone={STOCK_NORM_TONE[state]}
              label={STOCK_NORM_LABELS[state]}
            />
          );
        },
      },
      {
        title: "Cập nhật cuối",
        dataIndex: "updated_at",
        width: 165,
        sorter: (a, b) =>
          text(a.updated_at, "").localeCompare(text(b.updated_at, "")),
        render: (value) => (value ? fmtDateTime(value) : EMPTY_TEXT),
      },
    ],
    [detailPagination.page, detailPagination.perPage, setSkuDrill],
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
        title="Báo cáo tồn kho và đối soát"
        description="Cơ cấu tồn hiện tại, mức khớp giữa số dư và sổ biến động, cảnh báo định mức."
      />

      <FilterBar
        label="Bộ lọc chung cho các biểu đồ bên dưới"
        hint="Số liệu là ảnh chụp tồn kho tại thời điểm hiện tại, không theo kỳ."
      >
        <ItemKindFilter value={chartKind} onChange={setChartKind} />
        <AllOrPickFilter
          value={warehouseId}
          onChange={setWarehouseId}
          options={warehouses.options}
          allLabel="Tất cả kho"
          ariaLabel="Kho"
          minWidth={210}
        />
        <UiDatePicker
          placeholder="Chốt số liệu tại ngày"
          aria-label="Chốt số liệu tại ngày"
          value={asOf}
          onChange={setAsOf}
        />
      </FilterBar>

      {balance.data?.as_of_snapshot ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="warning">
            {`Đang xem ảnh chụp theo sổ tồn kho tại ${text(balance.data.as_of)}. Cột "Inventory Balance" là số dư tại mốc đó, nên đối soát sổ tồn kho với số dư hiện tại không áp dụng.`}
          </UiAlert>
        </Box>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label="Tồn khả dụng"
          value={fmt(totalAvailable)}
          tone="primary"
          icon={<StockOutlined />}
          hint={`${fmt(chartAggregates.length)} SKU trong phạm vi lọc`}
        />
        <ReportKpi
          label="SKU khớp đối soát"
          value={fmt(matchCount)}
          tone="success"
          icon={<CheckCircleOutlined />}
          hint={pct(matchCount, chartAggregates.length)}
          onClick={() => setReconcileDrill("MATCH")}
        />
        <ReportKpi
          label="SKU lệch đối soát"
          value={fmt(mismatchCount)}
          tone="error"
          icon={<AuditOutlined />}
          hint={pct(mismatchCount, chartAggregates.length)}
          onClick={() => setReconcileDrill("MISMATCH")}
        />
        <ReportKpi
          label="Sắp hết hàng"
          value={fmt(lowCount)}
          tone="warning"
          icon={<WarningOutlined />}
          hint="Available Qty dưới Min Qty đã cấu hình"
          onClick={() => {
            setNormState("LOW");
            setNormKind("all");
          }}
        />
        <ReportKpi
          label="Thừa hàng"
          value={fmt(overCount)}
          tone="info"
          icon={<WarningOutlined />}
          hint="Available Qty vượt Max Qty đã cấu hình"
          onClick={() => {
            setNormState("OVER");
            setNormKind("all");
          }}
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title="Cơ cấu tồn kho hiện tại"
          description="Tỉ trọng tồn theo trạng thái: Khả dụng / Không bán được / Lỗi / Cách ly."
          loading={loading}
          error={error}
          onRetry={() => void reconciliation.refetch()}
          empty={structureTotal === 0}
          emptyText={`Chưa có tồn ${structureKind === "PRODUCT" ? "sản phẩm" : "linh kiện"} nào.`}
          toolbar={
            <SegmentedToggle
              label="Xem sản phẩm hay linh kiện"
              value={structureKind}
              onChange={setStructureKind}
              options={[
                { value: "PRODUCT", label: "Sản phẩm" },
                { value: "COMPONENT", label: "Linh kiện" },
              ]}
            />
          }
          footer={
            <FormulaNote>
              Trục là tỉ lệ %; tooltip hiển thị số tuyệt đối. Tổng tồn đang xem:{" "}
              {fmt(structureTotal)}.
            </FormulaNote>
          }
        >
          <StackedBarChart
            segments={structureSegments}
            height={180}
            barLabel={structureKind === "PRODUCT" ? "Sản phẩm" : "Linh kiện"}
            valueFormatter={fmt}
          />
        </ChartCard>

        <ChartCard
          title="Tỷ lệ đối soát"
          description="Số SKU khớp và lệch giữa Inventory Balance và tồn tính từ Inventory Movement."
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
            centerLabel="Tổng SKU"
            valueFormatter={fmt}
            onSelect={(item) =>
              setReconcileDrill(item.label === "MATCH" ? "MATCH" : "MISMATCH")
            }
          />
        </ChartCard>
      </ChartGrid>

      <ChartCard
        title="Top SKU chênh lệch đối soát"
        description="So sánh Inventory Balance với tồn tính từ Inventory Movement; Chênh lệch = Balance − Movement."
        fullWidth
        loading={loading}
        error={error}
        onRetry={() => void reconciliation.refetch()}
        empty={topRows.length === 0}
        emptyText="Không có SKU nào lệch đối soát theo bộ lọc hiện tại."
        toolbar={
          <SegmentedToggle
            label="Số dòng hiển thị"
            value={topMode}
            onChange={setTopMode}
            options={TOP_OPTIONS}
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
                header: "Tên SKU",
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
                header: "Chênh lệch",
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
            emptyText="Không có SKU mismatch."
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
                name: "Chênh lệch",
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
        title="Cảnh báo định mức tồn kho"
        description="So Available Qty hiện tại với Min Qty / Max Qty đã cấu hình cho từng SKU."
      />

      <FilterBar
        label="Bộ lọc bảng cảnh báo định mức"
        hint={`${fmt(normRows.length)} SKU`}
      >
        <AllOrPickFilter
          value={normState}
          onChange={setNormState}
          options={NORM_FILTER_OPTIONS}
          allLabel="Tất cả trạng thái định mức"
          ariaLabel="Trạng thái định mức"
          minWidth={220}
        />
        <ItemKindFilter value={normKind} onChange={setNormKind} />
        <SearchInput
          width={260}
          placeholder="SKU / tên sản phẩm"
          aria-label="Tìm SKU hoặc tên sản phẩm"
          value={normKeyword}
          onChange={setNormKeyword}
        />
      </FilterBar>

      {catalog.entries.length > 0 &&
      skuAggregates.every((entry) => entry.normState === "UNSET") ? (
        <Box sx={{ mb: 1.5 }}>
          <UiAlert tone="info">
            Chưa SKU nào được đặt Min Qty / Max Qty, nên mọi dòng đang ở trạng
            thái "Chưa cấu hình". Đặt định mức tại màn Danh mục SKU để bảng này
            bắt đầu cảnh báo.
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
            header: "Tên sản phẩm",
            render: (row) => row.product_name || EMPTY_TEXT,
          },
          {
            key: "kind",
            header: "Loại hàng",
            width: 120,
            render: (row) => ITEM_KIND_LABELS[row.kind] ?? "Chưa phân loại",
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
            render: (row) => (row.minQty === null ? EMPTY_TEXT : fmt(row.minQty)),
          },
          {
            key: "max",
            header: "Max Qty",
            align: "right",
            width: 110,
            render: (row) => (row.maxQty === null ? EMPTY_TEXT : fmt(row.maxQty)),
          },
          {
            key: "gap",
            header: "Chênh lệch",
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
            header: "Trạng thái",
            width: 150,
            render: (row) => (
              <UiStatusBadge
                size="small"
                tone={STOCK_NORM_TONE[row.normState]}
                label={STOCK_NORM_LABELS[row.normState]}
              />
            ),
          },
        ]}
        rows={normPagination.pageRows}
        rowKey={(row) => row.product_code}
        loading={loading}
        emptyText="Không có SKU nào theo bộ lọc."
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
        title="Chi tiết tồn kho & đối soát"
        description={
          "Một dòng cho mỗi SKU: số dư, tồn tính từ movement, chênh lệch, định mức. " +
          'Cột "Chênh lệch" = Số dư − Sổ cái; còn "Trạng thái đối soát" tổng hợp cả 4 check ' +
          "của SRS §7.5 (sổ cái ↔ số dư, sổ serial, số lượng trong thùng, toàn vẹn thùng chứa), " +
          'nên chênh lệch bằng 0 mà vẫn đỏ là do lệch ở sổ phụ — dòng "Lệch ở" chỉ rõ check nào.'
        }
      />

      <FilterBar
        label="Bộ lọc bảng chi tiết"
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
          placeholder="SKU / tên sản phẩm"
          aria-label="Tìm SKU hoặc tên sản phẩm ở bảng chi tiết"
          value={detailKeyword}
          onChange={setDetailKeyword}
        />
        <AllOrPickFilter
          value={detailCategory}
          onChange={setDetailCategory}
          options={categories.options}
          allLabel="Tất cả nhóm hàng"
          ariaLabel="Nhóm hàng"
          minWidth={210}
        />
        <ItemKindFilter value={detailKind} onChange={setDetailKind} />
        <AllOrPickFilter
          value={detailStockStatus}
          onChange={setDetailStockStatus}
          options={STOCK_STATUS_FILTER_OPTIONS}
          allLabel="Tất cả trạng thái tồn"
          ariaLabel="Trạng thái tồn"
          minWidth={210}
        />
        <AllOrPickFilter
          value={detailReconcile}
          onChange={setDetailReconcile}
          options={RECONCILE_FILTER_OPTIONS}
          allLabel="MATCH và MISMATCH"
          ariaLabel="Trạng thái đối soát"
        />
        <AllOrPickFilter
          value={detailNorm}
          onChange={setDetailNorm}
          options={NORM_FILTER_OPTIONS}
          allLabel="Tất cả trạng thái định mức"
          ariaLabel="Trạng thái định mức ở bảng chi tiết"
          minWidth={220}
        />
      </FilterBar>

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title="Xuất báo cáo bị từ chối quyền."
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
        emptyText="Không có SKU nào theo bộ lọc."
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label="Xem chi tiết SKU"
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
          title={`SKU ${reconcileDrill === "MATCH" ? "khớp" : "lệch"} đối soát`}
          subtitle={`${fmt(
            reconcileDrill === "MATCH" ? matchCount : mismatchCount,
          )} SKU · bấm mã SKU để xem Movement`}
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
                header: "Tên SKU",
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
                header: "Chênh lệch",
                align: "right",
                render: (row) => fmt(row.variance),
              },
            ]}
            rows={chartAggregates.filter(
              (entry) => entry.reconcile === reconcileDrill,
            )}
            rowKey={(row) => row.product_code}
            emptyText="Không có SKU nào."
          />
        </DrillDownDialog>
      ) : null}

      {skuDrill ? (
        <DrillDownDialog
          title={`Movement của SKU ${skuDrill}`}
          subtitle="90 ngày gần nhất"
          onClose={() => setSkuDrill(null)}
        >
          <MovementTable
            rows={skuMovementRows}
            loading={skuMovements.isLoading}
            emptyText="SKU này không có biến động trong 90 ngày gần nhất."
          />
        </DrillDownDialog>
      ) : null}

      {detailRow ? (
        <ReportRowDetailModal
          title={`Chi tiết tồn kho — ${text(detailRow.row.product_code)}`}
          columns={detailColumns}
          row={detailRow.row}
          rowIndex={detailRow.index}
          onClose={() => setDetailRow(null)}
          extra={
            <Box sx={{ typography: "caption", color: "text.secondary" }}>
              Bấm mã SKU ở cột đầu bảng để mở danh sách Movement liên quan.
              Trạng thái tồn theo từng kho:{" "}
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
