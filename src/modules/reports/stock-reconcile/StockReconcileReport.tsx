import { businessToday } from "@/shared/utils/date-time";
import { ReportExportButton } from "../components/ReportExportAction";
import { ReportFilterCombobox } from "../components/ReportFilterCombobox";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";
import { ReportDateRangePicker } from "@/modules/reports/components/ReportDateRangePicker";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { rowActivationProps } from "@/shared/components/data-display/row-activation";
import { RowActionButton } from "@/shared/components/actions";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import { VuexyDemoIcon } from "@/shared/ui";
import {
  ISO_DATE,
  sumRows,
  useInventoryFlowSnapshot,
  type FlowDailyPoint,
  type XntRow,
} from "@/modules/reports/inventory-flow/inventory-flow-api";
import { checkLabelOf } from "./stock-reconcile-labels";
import {
  StockReconcileDrilldown,
  type ReconcileDetailView,
} from "./StockReconcileDrilldown";
import { StockReconcileExportDialog } from "./StockReconcileExportDialog";
import {
  useStockReconcileSnapshot,
  type StockReconcileRow,
} from "./stock-reconcile-api";
import "./stock-reconcile-report.css";
import { tStatic as tUi, useT } from "@/shared/i18n/useT";

type DateRange = { from: string; to: string };
type Filters = DateRange & {
  kind: string;
  reconcile: string;
};

type DetailRow = {
  key: string;
  hasFlow: boolean;
  warehouse: string;
  skuCode: string;
  skuName: string;
  kind: string;
  opening: number;
  inbound: number;
  productOutbound: number;
  componentOutbound: number;
  reversal: number;
  closing: number;
  ledgerStock: number;
  actual: number;
  available: number | null;
  delta: number;
  mismatch: boolean;
  checks: string[];
};

function reconcileState(
  row: DetailRow,
): "matched" | "quantity" | "code" | "review" {
  if (row.delta !== 0) return "quantity";
  if (!row.mismatch) return "matched";
  if (row.checks.some((check) => /serial|container/i.test(check)))
    return "code";
  return "review";
}

function defaultRange(): DateRange {
  return {
    from: businessToday().subtract(6, "day").format(ISO_DATE),
    to: businessToday().format(ISO_DATE),
  };
}

function defaultFilters(): Filters {
  return { ...defaultRange(), kind: "", reconcile: "" };
}

function scrollOwnerOf(element: HTMLElement | null): HTMLElement | null {
  let current = element?.parentElement ?? null;

  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }

  return null;
}

function scrollReportToTop(element: HTMLElement | null) {
  const owner = scrollOwnerOf(element);
  if (owner) owner.scrollTop = 0;
}

function datePickerValue(range: DateRange): [Dayjs | null, Dayjs | null] {
  return [
    range.from ? dayjs(range.from, ISO_DATE) : null,
    range.to ? dayjs(range.to, ISO_DATE) : null,
  ];
}

function signed(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("vi-VN")}`;
}

function quantity(value: number): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function normalized(text: string): string {
  return text.trim().toLocaleLowerCase("vi-VN");
}

function errorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const value = candidate.response?.status ?? candidate.status;
  return typeof value === "number" ? value : null;
}

function aggregateReconciliation(rows: StockReconcileRow[]) {
  const bySku = new Map<
    string,
    {
      warehouse: string;
      skuName: string;
      kind: string;
      balance: number;
      ledger: number;
      available: number;
      mismatch: boolean;
      checks: Set<string>;
    }
  >();

  for (const row of rows) {
    const current = bySku.get(row.sku_code) ?? {
      warehouse: row.warehouse_code,
      skuName: row.sku_name,
      kind: row.item_kind,
      balance: 0,
      ledger: 0,
      available: 0,
      mismatch: false,
      checks: new Set<string>(),
    };
    current.balance += row.balance_qty;
    current.ledger += row.ledger_qty;
    current.available += row.available_qty ?? 0;
    current.mismatch ||= row.reconciliation_status === "MISMATCH";
    row.mismatch_checks.forEach((check) => current.checks.add(check));
    bySku.set(row.sku_code, current);
  }
  return bySku;
}

function mergeRows(
  flowRows: XntRow[],
  reconciliationRows: StockReconcileRow[],
): DetailRow[] {
  const reconciliation = aggregateReconciliation(reconciliationRows);
  const seen = new Set<string>();
  const result: DetailRow[] = flowRows.map((row) => {
    seen.add(row.sku_code);
    const check = reconciliation.get(row.sku_code);
    const actual = check?.balance ?? row.closing;
    const system = check?.ledger ?? row.closing;
    return {
      key: `${row.warehouse_code}:${row.sku_code}`,
      hasFlow: true,
      warehouse: row.warehouse_code,
      skuCode: row.sku_code,
      skuName: row.sku_name,
      kind: row.sku_type,
      opening: row.opening,
      inbound: row.receipt_net,
      productOutbound: row.issue_net,
      componentOutbound: row.component_issue_net,
      reversal: row.reversal_unlinked_net,
      closing: row.closing,
      ledgerStock: system,
      actual,
      available: check?.available ?? null,
      delta: actual - system,
      mismatch: (check?.mismatch ?? !row.matched) || actual !== system,
      checks: [...(check?.checks ?? [])],
    };
  });

  for (const [skuCode, check] of reconciliation) {
    if (seen.has(skuCode)) continue;
    result.push({
      key: `${check.warehouse}:${skuCode}`,
      hasFlow: false,
      warehouse: check.warehouse,
      skuCode,
      skuName: check.skuName,
      kind: check.kind,
      opening: 0,
      inbound: 0,
      productOutbound: 0,
      componentOutbound: 0,
      reversal: 0,
      closing: check.ledger,
      ledgerStock: check.ledger,
      actual: check.balance,
      available: check.available,
      delta: check.balance - check.ledger,
      mismatch: check.mismatch || check.balance !== check.ledger,
      checks: [...check.checks],
    });
  }
  return result.sort((left, right) =>
    left.skuCode.localeCompare(right.skuCode),
  );
}

function Icon({ name }: { name: Parameters<typeof VuexyDemoIcon>[0]["name"] }) {
  return <VuexyDemoIcon name={name} />;
}

function CollapseButton({
  title,
  expanded,
  onClick,
}: {
  title: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rpt02-collapse"
      aria-label={tUi(
        expanded
          ? "reports.stockReconcileReport.collapseSection"
          : "reports.stockReconcileReport.expandSection",
        { title },
      )}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <Icon name="chevron-down" />
    </button>
  );
}

type KpiGlyphName = "box" | "down" | "up" | "wrench" | "undo" | "boxes";

function KpiGlyph({ name }: { name: KpiGlyphName }) {
  if (name === "down" || name === "up") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={
            name === "down" ? "M12 3v18M5 14l7 7 7-7" : "M12 21V3M5 10l7-7 7 7"
          }
        />
      </svg>
    );
  }
  if (name === "wrench") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.7 6.3a4 4 0 0 0-5-5L7.8 3.2l3 3 1.9-1.9a4 4 0 0 0 2 5L6 18l-3 3 3-3 8.7-8.7Z" />
        <circle cx="5" cy="19" r="1" />
      </svg>
    );
  }
  if (name === "undo") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
      </svg>
    );
  }
  if (name === "boxes") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 2 4 2.3v4.5L12 11 8 8.8V4.3L12 2ZM6 10l4 2.3v4.5L6 19l-4-2.2v-4.5L6 10Zm12 0 4 2.3v4.5L18 19l-4-2.2v-4.5L18 10ZM6 19v3m12-3v3m-6-11v11M2 16.8 6 19l4-2.2m4 0 4 2.2 4-2.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 7 9 5 9-5v10l-9 5-9-5V7Zm9 5v10" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: KpiGlyphName;
  tone: "blue" | "green" | "orange" | "red";
}) {
  return (
    <article className={`rpt02-kpi rpt02-kpi--${tone}`}>
      <span className="rpt02-kpi__icon" aria-hidden="true">
        <KpiGlyph name={icon} />
      </span>
      <span className="rpt02-kpi__copy">
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </span>
    </article>
  );
}

function SkeletonReport() {
  return (
    <div className="rpt02-loading" role="status" aria-live="polite">
      <span className="rpt02-sr-only">
        {tUi("updatedUi.text_e5895b543636")}
      </span>
      <div className="rpt02-kpi-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="rpt02-kpi rpt02-skeleton-card" key={index}>
            <i className="rpt02-skeleton rpt02-skeleton--icon" />
            <span>
              <i className="rpt02-skeleton rpt02-skeleton--label" />
              <i className="rpt02-skeleton rpt02-skeleton--value" />
              <i className="rpt02-skeleton rpt02-skeleton--note" />
            </span>
          </div>
        ))}
      </div>
      <div className="rpt02-dashboard" aria-hidden="true">
        <div className="rpt02-panel rpt02-loading-panel">
          <i className="rpt02-skeleton rpt02-skeleton--title" />
          <i className="rpt02-skeleton rpt02-skeleton--chart" />
        </div>
        <div className="rpt02-panel rpt02-loading-panel">
          <i className="rpt02-skeleton rpt02-skeleton--title" />
          <i className="rpt02-skeleton rpt02-skeleton--summary" />
          <i className="rpt02-skeleton rpt02-skeleton--summary" />
          <i className="rpt02-skeleton rpt02-skeleton--summary" />
        </div>
      </div>
      <div className="rpt02-panel rpt02-loading-table" aria-hidden="true">
        <i className="rpt02-skeleton rpt02-skeleton--title" />
        {Array.from({ length: 4 }, (_, index) => (
          <i className="rpt02-skeleton rpt02-skeleton--row" key={index} />
        ))}
      </div>
    </div>
  );
}

type EmptyStateProps = {
  icon: Parameters<typeof VuexyDemoIcon>[0]["name"];
  title: string;
  copy: string;
  code?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: "default" | "warning" | "danger";
};

function EmptyState({
  icon,
  title,
  copy,
  code,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  tone = "default",
}: EmptyStateProps) {
  return (
    <section className={`rpt02-state rpt02-state--${tone}`} role="status">
      <span className="rpt02-state__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {code ? <small>{code}</small> : null}
      <div className="rpt02-state__actions">
        <button
          className="rpt02-button rpt02-button--primary"
          type="button"
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            className="rpt02-button rpt02-button--ghost"
            type="button"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function MovementChart({ points }: { points: FlowDailyPoint[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(760);

  useLayoutEffect(() => {
    const node = chartRef.current;
    if (node === null || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      if (nextWidth > 0) setMeasuredWidth(nextWidth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [points.length]);

  if (points.length === 0) {
    return (
      <div ref={chartRef} className="chart-empty rpt02-chart-empty">
        <span className="rpt02-state__icon" aria-hidden="true">
          <Icon name="chart-column-big" />
        </span>
        <p>{tUi("updatedUi.text_e4e185e125f3")}</p>
      </div>
    );
  }

  const chartWidth = Math.max(260, Math.round(measuredWidth));
  const compact = chartWidth < 560;
  const chartHeight = compact ? 250 : 224;
  const left = compact ? 38 : 48;
  const right = compact ? 10 : 20;
  const top = 24;
  const bottom = 38;
  const innerWidth = chartWidth - left - right;
  const innerHeight = chartHeight - top - bottom;
  const baseline = top + innerHeight;
  const barPlotTop = top + innerHeight * 0.36;
  const barPlotHeight = baseline - barPlotTop;
  const rawBarMax = Math.max(
    1,
    ...points.flatMap((point) => [
      Math.abs(point.inbound),
      Math.abs(point.product),
    ]),
  );
  const magnitude = 10 ** Math.floor(Math.log10(rawBarMax));
  const barMax = Math.ceil(rawBarMax / magnitude) * magnitude;
  const lineValues = points.map((point) => point.closing);
  const lineMin = Math.min(...lineValues);
  const lineMax = Math.max(...lineValues);
  const lineSpan = Math.max(1, lineMax - lineMin);
  const step = innerWidth / Math.max(points.length, 1);
  const barY = (value: number) =>
    baseline - (Math.max(0, value) / barMax) * barPlotHeight;
  const lineY = (value: number) =>
    lineMax === lineMin
      ? top + innerHeight * 0.2
      : top +
        innerHeight * 0.32 -
        ((value - lineMin) / lineSpan) * innerHeight * 0.2;
  const linePoints = points
    .map(
      (point, index) =>
        `${left + step * index + step / 2},${lineY(point.closing)}`,
    )
    .join(" ");
  const dateLabelStride = Math.max(
    1,
    Math.ceil(
      points.length / Math.max(2, Math.floor(innerWidth / (compact ? 54 : 62))),
    ),
  );
  const valueLabelStride = Math.max(
    1,
    Math.ceil(
      points.length / Math.max(2, Math.floor(innerWidth / (compact ? 76 : 68))),
    ),
  );
  const showLabel = (index: number, stride: number) =>
    index === 0 || index === points.length - 1 || index % stride === 0;

  return (
    <>
      <div className="chart-wrap rpt02-chart-wrap">
        <div ref={chartRef} className="chart-plot rpt02-chart-plot">
          <svg
            className="chart-svg rpt02-chart-svg"
            role="img"
            aria-label={tUi("updatedUi.text_9829ad21d404")}
            width={chartWidth}
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ height: chartHeight }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const gridY = barPlotTop + barPlotHeight * ratio;
              return (
                <g key={ratio}>
                  <line
                    className="rpt02-chart-grid"
                    x1={left}
                    x2={chartWidth - right}
                    y1={gridY}
                    y2={gridY}
                  />
                  <text
                    className="rpt02-chart-axis"
                    x={left - 8}
                    y={gridY + 4}
                    textAnchor="end"
                  >
                    {quantity(barMax * (1 - ratio))}
                  </text>
                </g>
              );
            })}
            {points.map((point, index) => {
              const center = left + step * index + step / 2;
              const width = Math.min(16, step * 0.2);
              return (
                <g key={point.date}>
                  <rect
                    className="rpt02-chart-bar rpt02-chart-bar--in"
                    x={center - width - 2}
                    y={barY(point.inbound)}
                    width={width}
                    height={Math.max(0, baseline - barY(point.inbound))}
                    rx="2"
                  />
                  <rect
                    className="rpt02-chart-bar rpt02-chart-bar--out"
                    x={center + 2}
                    y={barY(point.product)}
                    width={width}
                    height={Math.max(0, baseline - barY(point.product))}
                    rx="2"
                  />
                  {showLabel(index, dateLabelStride) ? (
                    <text
                      className="rpt02-chart-axis rpt02-chart-axis--date"
                      x={center}
                      y={chartHeight - 11}
                      textAnchor="middle"
                    >
                      {dayjs(point.date).format("DD/MM")}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <polyline
              className="rpt02-chart-line"
              points={linePoints}
              fill="none"
            />
            {points.map((point, index) => {
              const center = left + step * index + step / 2;
              const pointY = lineY(point.closing);
              const label = quantity(point.closing);
              const labelWidth = Math.max(42, label.length * 7 + 10);
              const labelY = Math.max(top, pointY - 20);
              return (
                <g key={`${point.date}-dot`}>
                  {showLabel(index, valueLabelStride) ? (
                    <>
                      <rect
                        className="rpt02-chart-value-bg"
                        x={center - labelWidth / 2}
                        y={labelY}
                        width={labelWidth}
                        height="16"
                        rx="5"
                      />
                      <text
                        className="rpt02-chart-value"
                        x={center}
                        y={labelY + 12}
                        textAnchor="middle"
                      >
                        {label}
                      </text>
                    </>
                  ) : null}
                  <circle
                    className="rpt02-chart-dot"
                    cx={center}
                    cy={pointY}
                    r="3"
                  >
                    <title>
                      {tUi("updatedUi.text_b61ca2400129", {
                        value0: String(dayjs(point.date).format("DD/MM/YYYY")),
                        value1: String(quantity(point.closing)),
                      })}
                    </title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <details className="chart-table rpt02-chart-table">
        <summary>{tUi("updatedUi.text_fa612645bd64")}</summary>
        <div className="chart-table__body">
          <table>
            <thead>
              <tr>
                <th>{tUi("dashboard.flow.colDate")}</th>
                <th>{tUi("dashboard.snapshot.tooltipInbound")}</th>
                <th>{tUi("dashboard.snapshot.tooltipOutbound")}</th>
                <th>{tUi("dashboard.snapshot.closingStock")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={`${point.date}-table`}>
                  <td>{dayjs(point.date).format("DD/MM/YYYY")}</td>
                  <td>{quantity(point.inbound)}</td>
                  <td>{quantity(point.product)}</td>
                  <td>{quantity(point.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export default function StockReconcileReport() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState<Filters>(defaultFilters);
  const [applied, setApplied] = useState<Filters>(defaultFilters);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(TABLE_PAGE_SIZE_OPTIONS[0]);
  const [detailTab, setDetailTab] = useState<"reconcile" | "flow">("reconcile");
  const [onlyReview, setOnlyReview] = useState(false);
  const [expanded, setExpanded] = useState({
    chart: true,
    reconcile: true,
    detail: true,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<DetailRow | null>(
    null,
  );
  const [detailView, setDetailView] = useState<ReconcileDetailView>("quantity");
  const pageRef = useRef<HTMLElement | null>(null);
  const tableRef = useRef<HTMLElement | null>(null);

  const flow = useInventoryFlowSnapshot({ from: applied.from, to: applied.to });
  const reconciliation = useStockReconcileSnapshot({ asOf: applied.to });
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const canExport = hasAnyWmsPermission(
    permissionCodes,
    WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
    isSuperAdmin,
  );

  const invalidRange =
    draft.from === "" || draft.to === "" || draft.from > draft.to;
  const loading = flow.loading || reconciliation.loading;
  const fetching = flow.fetching || reconciliation.fetching;
  const updating = loading || fetching;
  const error = flow.error ?? reconciliation.error;
  const status = errorStatus(error);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = window.setTimeout(() => setShowSuccess(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showSuccess]);

  useLayoutEffect(() => {
    scrollReportToTop(pageRef.current);
  }, [location.key]);

  const scopedFlowRows = useMemo(
    () =>
      flow.snapshot.rows.filter(
        (row) => applied.kind === "" || row.sku_type === applied.kind,
      ),
    [applied.kind, flow.snapshot.rows],
  );

  const scopedReconciliationRows = useMemo(
    () =>
      reconciliation.snapshot.rows.filter(
        (row) => applied.kind === "" || row.item_kind === applied.kind,
      ),
    [applied.kind, reconciliation.snapshot.rows],
  );

  const allRows = useMemo(
    () => mergeRows(scopedFlowRows, scopedReconciliationRows),
    [scopedFlowRows, scopedReconciliationRows],
  );
  const filteredRows = useMemo(() => {
    const needle = normalized(query);
    return allRows.filter((row) => {
      if (applied.reconcile === "MATCH" && row.mismatch) return false;
      if (applied.reconcile === "MISMATCH" && !row.mismatch) return false;
      if (needle === "") return true;
      return normalized(`${row.skuCode} ${row.skuName}`).includes(needle);
    });
  }, [allRows, applied.reconcile, query]);

  const displayRows =
    detailTab === "flow"
      ? filteredRows.filter((row) => row.hasFlow)
      : onlyReview
        ? filteredRows.filter((row) => row.mismatch)
        : filteredRows;
  const flowTotals = displayRows.reduce(
    (total, row) => ({
      opening: total.opening + row.opening,
      inbound: total.inbound + row.inbound,
      productOutbound: total.productOutbound + row.productOutbound,
      componentOutbound: total.componentOutbound + row.componentOutbound,
      reversal: total.reversal + row.reversal,
      closing: total.closing + row.closing,
    }),
    {
      opening: 0,
      inbound: 0,
      productOutbound: 0,
      componentOutbound: 0,
      reversal: 0,
      closing: 0,
    },
  );

  const summary = useMemo(() => sumRows(scopedFlowRows), [scopedFlowRows]);
  const mismatches = useMemo(
    () => allRows.filter((row) => row.mismatch),
    [allRows],
  );
  const systemTotal = allRows.reduce((sum, row) => sum + row.ledgerStock, 0);
  const actualTotal = allRows.reduce((sum, row) => sum + row.actual, 0);
  const deltaTotal = actualTotal - systemTotal;
  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = displayRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const updateFilters = (changes: Partial<Filters>) => {
    const next = { ...draft, ...changes };
    setDraft(next);
    if (!next.from || !next.to || next.from > next.to) return;
    setApplied(next);
    setPage(1);
  };

  const resetFilters = () => {
    const next = defaultFilters();
    setDraft(next);
    setApplied(next);
    setQuery("");
    setPage(1);
    setShowSuccess(true);
    window.requestAnimationFrame(() => scrollReportToTop(pageRef.current));
  };

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void Promise.all([flow.refetch(), reconciliation.refetch()]).finally(() => {
      setRefreshing(false);
      setShowSuccess(true);
    });
  };

  const goToMismatches = () => {
    setDetailTab("reconcile");
    setOnlyReview(true);
    setExpanded((current) => ({ ...current, detail: true }));
    setDraft((current) => ({ ...current, reconcile: "MISMATCH" }));
    setApplied((current) => ({ ...current, reconcile: "MISMATCH" }));
    setQuery("");
    setPage(1);
    window.requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const home = () => navigate(ROUTES.DASHBOARD);
  const fatal = status === 403 || status === 404 || status === 503;

  return (
    <main className="hn-rpt02" ref={pageRef}>
      {fatal ? (
        <EmptyState
          icon={
            status === 403
              ? "lock"
              : status === 404
                ? "package-search"
                : "settings-2"
          }
          title={
            status === 403
              ? tUi("updatedUi.text_f30ab40e24a3")
              : status === 404
                ? tUi("updatedUi.text_9ac737b89bc1")
                : tUi("updatedUi.text_1f197c0b3e8c")
          }
          copy={
            status === 403
              ? tUi("updatedUi.text_cae47617a2e2")
              : status === 404
                ? tUi("updatedUi.text_6af51ff50143")
                : tUi("updatedUi.text_76ba90c88790")
          }
          code={status === 404 ? tUi("updatedUi.text_96537db5ddd9") : undefined}
          primaryLabel={
            status === 503
              ? tUi("reverse.common.recheck")
              : tUi("updatedUi.text_2864c6d3d5ee")
          }
          onPrimary={status === 503 ? refresh : home}
          secondaryLabel={
            status === 503 ? tUi("updatedUi.text_2864c6d3d5ee") : undefined
          }
          onSecondary={status === 503 ? home : undefined}
          tone={
            status === 503 ? "warning" : status === 403 ? "danger" : "default"
          }
        />
      ) : (
        <>
          <header className="rpt02-heading">
            <div className="rpt02-heading__copy">
              <h1 className="hn-report-page-title">
                {tUi("updatedUi.text_4e7892be4a23")}
              </h1>
              <p>{tUi("updatedUi.text_cf3ca15cba35")}</p>
            </div>
            <div className="rpt02-heading__actions">
              <span
                className="rpt02-tooltip"
                data-tooltip={
                  !canExport ? tUi("updatedUi.text_b363686f3815") : undefined
                }
              >
                <ReportExportButton
                  onClick={() => setShowExport(true)}
                  disabled={!canExport || displayRows.length === 0 || updating}
                />
              </span>
            </div>
          </header>

          {showSuccess ? (
            <aside className="rpt02-notice rpt02-notice--success" role="status">
              <span className="rpt02-notice__check" aria-hidden="true" />
              <div>
                <strong>{tUi("updatedUi.text_5d0cd3a93731")}</strong>
                <p>{tUi("updatedUi.text_d6c349552506")}</p>
              </div>
              <button
                type="button"
                aria-label={tUi("updatedUi.text_8af6ba927e1f")}
                onClick={() => setShowSuccess(false)}
              >
                <Icon name="x" />
              </button>
            </aside>
          ) : null}

          {!canExport ? (
            <aside className="rpt02-notice rpt02-notice--info" role="status">
              <span aria-hidden="true">
                <Icon name="lock" />
              </span>
              <div>
                <strong>{tUi("updatedUi.text_4ce6445597cc")}</strong>
                <p>{tUi("updatedUi.text_f4b806fda605")}</p>
              </div>
            </aside>
          ) : null}

          <section
            className="rpt02-filter"
            aria-label={tUi("reports.recipientAgency.filterTitle")}
          >
            <div
              className={`rpt02-field rpt02-field--date${invalidRange ? " is-invalid" : ""}`}
            >
              <ReportDateRangePicker
                popupClassName="rpt02-date-popup"
                value={datePickerValue(draft)}
                onChange={(value) =>
                  updateFilters({
                    from: value?.[0]?.format(ISO_DATE) ?? "",
                    to: value?.[1]?.format(ISO_DATE) ?? "",
                  })
                }
                maxDate={businessToday().startOf("day")}
                aria-label={tUi("updatedUi.text_27bfb01971ac")}
                disabled={updating || refreshing}
              />
              {invalidRange ? (
                <small>{tUi("updatedUi.text_3e650f641d98")}</small>
              ) : null}
            </div>

            <div className="rpt02-field rpt02-field--kind">
              <ReportFilterCombobox
                id="rpt02-kind"
                value={draft.kind}
                ariaLabel="Chọn nhóm hàng / SKU"
                icon="package-search"
                searchPlaceholder="Tìm nhóm hàng..."
                options={[
                  {
                    value: "",
                    label:
                      tUi("updatedUi.text_4967fc6e0793") +
                      ": " +
                      tUi("reports.stockReconcile.categoryAll"),
                  },
                  { value: "PRODUCT", label: tUi("dashboard.skuType.product") },
                  {
                    value: "COMPONENT",
                    label: tUi("dashboard.skuType.component"),
                  },
                ]}
                onChange={(kind) => updateFilters({ kind })}
                disabled={updating || refreshing}
              />
            </div>
            <div className="rpt02-field rpt02-field--status">
              <ReportFilterCombobox
                id="rpt02-status"
                value={draft.reconcile}
                ariaLabel="Chọn trạng thái đối soát"
                icon="file-clock"
                searchPlaceholder="Tìm trạng thái..."
                options={[
                  {
                    value: "",
                    label:
                      tUi("dashboard.equation.statusLabel") +
                      ": " +
                      tUi("reports.inventoryFlow.statusAll"),
                  },
                  {
                    value: "MATCH",
                    label: tUi("reports.inventoryFlowReport.matched"),
                  },
                  {
                    value: "MISMATCH",
                    label: tUi("reports.traceability.needsReview"),
                  },
                ]}
                onChange={(reconcile) => updateFilters({ reconcile })}
                disabled={updating || refreshing}
              />
            </div>
          </section>

          {loading ? (
            <SkeletonReport />
          ) : error ? (
            <EmptyState
              icon={status === 500 ? "triangle-alert" : "package-search"}
              title={
                status === 500
                  ? tUi("updatedUi.text_07cd0352843d")
                  : tUi("updatedUi.text_c1e574adfa82")
              }
              copy={
                status === 500
                  ? tUi("updatedUi.text_4ce9c8ec1759")
                  : tUi("updatedUi.text_dfbc3676b189")
              }
              code={
                status === 500
                  ? tUi("updatedUi.text_81a0db148499")
                  : tUi("updatedUi.text_76db1ce5d436", {
                      value0: String(dayjs(applied.from).format("DD/MM/YYYY")),
                      value1: String(dayjs(applied.to).format("DD/MM/YYYY")),
                    })
              }
              primaryLabel="Thử lại"
              onPrimary={refresh}
              secondaryLabel="Về Tổng quan"
              onSecondary={home}
              tone="danger"
            />
          ) : allRows.length === 0 ? (
            <EmptyState
              icon="inbox"
              title={tUi("updatedUi.text_4aac0d04366a")}
              copy="Chưa phát sinh giao dịch tồn kho phù hợp với bộ lọc đã chọn."
              code={`${dayjs(applied.from).format("DD/MM/YYYY")} – ${dayjs(applied.to).format("DD/MM/YYYY")}`}
              primaryLabel="Đổi khoảng thời gian"
              onPrimary={() => {
                const input = document.querySelector<HTMLElement>(
                  ".rpt02-date-range button, .rpt02-date-range input",
                );
                input?.focus();
                input?.click();
              }}
              secondaryLabel="Đặt lại bộ lọc"
              onSecondary={resetFilters}
            />
          ) : (
            <>
              <h2 className="rpt02-sr-only">
                {tUi("reports.stockReconcileReport.normTitle")}
              </h2>
              <section
                className="rpt02-kpi-grid"
                aria-label={tUi("updatedUi.text_c4cc87e118cc")}
              >
                <KpiCard
                  label={tUi("dashboard.equation.opening")}
                  value={quantity(summary.opening)}
                  note={t("dashboard.skuType.product")}
                  icon="box"
                  tone="blue"
                />
                <KpiCard
                  label={tUi("updatedUi.text_1993e3247f11")}
                  value={signed(summary.receiptNet)}
                  note={t("dashboard.skuType.product")}
                  icon="down"
                  tone="green"
                />
                <KpiCard
                  label={tUi("dashboard.equation.issueProduct")}
                  value={signed(-summary.issueNet)}
                  note={t("dashboard.skuType.product")}
                  icon="up"
                  tone="red"
                />
                <KpiCard
                  label={tUi("updatedUi.text_6d28e3f5d88a")}
                  value={signed(-summary.componentNet)}
                  note={t("dashboard.skuType.product")}
                  icon="wrench"
                  tone="orange"
                />
                <KpiCard
                  label={tUi("iam.role.undo")}
                  value={signed(summary.reversalUnlinked)}
                  note={t("dashboard.skuType.product")}
                  icon="undo"
                  tone="green"
                />
                <KpiCard
                  label={tUi("dashboard.equation.closing")}
                  value={quantity(summary.closing)}
                  note={t("dashboard.skuType.product")}
                  icon="boxes"
                  tone="blue"
                />
              </section>

              <section className="rpt02-dashboard">
                <article
                  className="rpt02-panel chart-card rpt02-chart-card"
                  data-collapsed={!expanded.chart}
                >
                  <header className="rpt02-panel__head">
                    <div>
                      <h2>{tUi("updatedUi.text_0edf72dbef9f")}</h2>
                      {expanded.chart ? (
                        <p>
                          {dayjs(applied.from).format("DD/MM")} –{" "}
                          {dayjs(applied.to).format("DD/MM/YYYY")}
                          {" " + tUi("updatedUi.text_ebfa6fb72c56")}
                        </p>
                      ) : null}
                    </div>
                    {expanded.chart ? (
                      <div
                        className="rpt02-legend"
                        aria-label={tUi("dashboard.snapshot.chartLegendAria")}
                      >
                        <span>
                          <i className="is-green" />
                          {tUi("dashboard.snapshot.tooltipInbound")}
                        </span>
                        <span>
                          <i className="is-orange" />
                          {tUi("dashboard.flow.issueProduct")}
                        </span>
                        <span>
                          <i className="is-blue" />
                          {tUi("dashboard.snapshot.closingStock")}
                        </span>
                      </div>
                    ) : null}
                    <CollapseButton
                      title={tUi("updatedUi.text_0edf72dbef9f")}
                      expanded={expanded.chart}
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          chart: !current.chart,
                        }))
                      }
                    />
                  </header>
                  {expanded.chart ? (
                    <MovementChart points={flow.snapshot.daily} />
                  ) : null}
                </article>

                <article
                  className="rpt02-panel rpt02-reconcile"
                  data-collapsed={!expanded.reconcile}
                >
                  <header className="rpt02-panel__head">
                    <div>
                      <h2>{tUi("updatedUi.text_d76c6dc86895")}</h2>
                      {expanded.reconcile ? (
                        <p>{dayjs(applied.to).format("DD/MM/YYYY")}</p>
                      ) : null}
                    </div>
                    <CollapseButton
                      title={tUi("updatedUi.text_d76c6dc86895")}
                      expanded={expanded.reconcile}
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          reconcile: !current.reconcile,
                        }))
                      }
                    />
                  </header>
                  {expanded.reconcile ? (
                    <>
                      <dl className="rpt02-reconcile__totals">
                        <div>
                          <dt>{tUi("updatedUi.text_37a49b4e2cd9")}</dt>
                          <dd>{quantity(systemTotal)}</dd>
                        </div>
                        <div>
                          <dt>{tUi("updatedUi.text_8c2153f1a52b")}</dt>
                          <dd>{quantity(actualTotal)}</dd>
                        </div>
                        <div
                          className={deltaTotal === 0 ? "is-ok" : "is-warning"}
                        >
                          <dt>{tUi("inventory.balance.colVariance")}</dt>
                          <dd>{signed(deltaTotal)}</dd>
                        </div>
                        <div
                          className={
                            mismatches.length === 0 ? "is-ok" : "is-warning"
                          }
                        >
                          <dt>
                            {mismatches.length}
                            {" " + tUi("updatedUi.text_a0c43686230e")}
                          </dt>
                          <dd className="rpt02-reconcile__formula">
                            {tUi("updatedUi.text_5b6efbe321b1")}
                          </dd>
                        </div>
                      </dl>

                      {mismatches.length > 0 ? (
                        <div
                          className="rpt02-contract-table"
                          aria-hidden="true"
                        >
                          <table
                            aria-label={tUi(
                              "reports.stockReconcileReport.varianceCardTitle",
                            )}
                          >
                            <thead>
                              <tr>
                                <th>SKU</th>
                                <th>
                                  {tUi(
                                    "reports.stockReconcileReport.colMismatchAt",
                                  )}
                                </th>
                                <th>{tUi("inventory.balance.colVariance")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mismatches.map((row) => (
                                <tr key={`${row.key}-reason`}>
                                  <td>{row.skuCode}</td>
                                  <td>
                                    {row.checks.map(checkLabelOf).join(", ")}
                                  </td>
                                  <td>{quantity(row.delta)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      <div className="rpt02-reconcile__list">
                        <strong>
                          {tUi("inventory.trace.movementDetailTitle")}
                        </strong>
                        <span>
                          <i>{tUi("reports.inventoryFlow.opening")}</i>
                          <b>{quantity(summary.opening)}</b>
                        </span>
                        <span>
                          <i>{tUi("dashboard.snapshot.tooltipInbound")}</i>
                          <b className="is-positive">
                            {signed(summary.receiptNet)}
                          </b>
                        </span>
                        <span>
                          <i>{tUi("dashboard.flow.issueProduct")}</i>
                          <b className="is-negative">
                            {signed(-summary.issueNet)}
                          </b>
                        </span>
                        <span>
                          <i>{tUi("updatedUi.text_8a6c35e57da8")}</i>
                          <b className="is-negative">
                            {signed(-summary.componentNet)}
                          </b>
                        </span>
                        <span>
                          <i>{tUi("iam.role.undo")}</i>
                          <b className="is-positive">
                            {signed(summary.reversalUnlinked)}
                          </b>
                        </span>
                        <span>
                          <i>{tUi("reports.inventoryFlow.closing")}</i>
                          <b>{quantity(summary.closing)}</b>
                        </span>
                      </div>
                      <button
                        className="rpt02-reconcile__link"
                        type="button"
                        onClick={goToMismatches}
                      >
                        {tUi("updatedUi.text_35d391efde06") + " "}
                        <Icon name="arrow-right" />
                      </button>
                    </>
                  ) : null}
                </article>

                <section
                  className="rpt02-panel rpt02-table-card"
                  data-collapsed={!expanded.detail}
                  ref={tableRef}
                >
                  <header className="rpt02-table-card__head">
                    <div>
                      <h2>{tUi("updatedUi.text_600fdcecb8cf")}</h2>
                      {expanded.detail ? (
                        <p>
                          {allRows.length}
                          {" " + tUi("updatedUi.text_df80f0002f7f")}{" "}
                          <span>
                            {mismatches.length}
                            {" " + tUi("updatedUi.text_8a002dbc4912")}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    {expanded.detail ? (
                      <SearchInput
                        value={query}
                        onChange={(value) => {
                          setQuery(value);
                          setPage(1);
                        }}
                        width="100%"
                        aria-label={tUi("updatedUi.text_48f97b02abf5")}
                        placeholder={tUi("updatedUi.text_902e57d8df5b")}
                      />
                    ) : null}
                    <CollapseButton
                      title={tUi("updatedUi.text_600fdcecb8cf")}
                      expanded={expanded.detail}
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          detail: !current.detail,
                        }))
                      }
                    />
                  </header>

                  {expanded.detail ? (
                    <>
                      <div className="rpt02-detail-tabs">
                        <div
                          role="tablist"
                          aria-label={tUi(
                            "reports.stockReconcileReport.detailTabsAria",
                          )}
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={detailTab === "reconcile"}
                            onClick={() => {
                              setDetailTab("reconcile");
                              setPage(1);
                            }}
                          >
                            {tUi(
                              "reports.stockReconcileReport.detailTabReconcile",
                            )}
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={detailTab === "flow"}
                            onClick={() => {
                              setDetailTab("flow");
                              setPage(1);
                            }}
                          >
                            {tUi("reports.stockReconcileReport.detailTabFlow")}
                          </button>
                        </div>
                        {detailTab === "reconcile" ? (
                          <label className="rpt02-detail-switch">
                            <input
                              type="checkbox"
                              checked={onlyReview}
                              onChange={(event) => {
                                setOnlyReview(event.target.checked);
                                setPage(1);
                              }}
                            />
                            <span aria-hidden="true" />
                            {tUi("reports.stockReconcileReport.onlyReview")}
                          </label>
                        ) : null}
                      </div>

                      {displayRows.length === 0 ? (
                        <div className="rpt02-no-result" role="status">
                          <span
                            className="rpt02-state__icon"
                            aria-hidden="true"
                          >
                            <Icon name="search" />
                          </span>
                          <h3>{tUi("updatedUi.text_6537d7653abe")}</h3>
                          <p>{tUi("updatedUi.text_a39e88670393")}</p>
                          <div className="rpt02-no-result__actions">
                            <button
                              className="rpt02-button rpt02-button--primary"
                              type="button"
                              onClick={() => {
                                setQuery("");
                                setOnlyReview(false);
                                setApplied((current) => ({
                                  ...current,
                                  reconcile: "",
                                }));
                              }}
                            >
                              {tUi("updatedUi.text_816c89e8e46b")}
                            </button>
                            <button
                              className="rpt02-button rpt02-button--ghost"
                              type="button"
                              onClick={() =>
                                document
                                  .querySelector<HTMLElement>(
                                    ".rpt02-date-range button, .rpt02-date-range input",
                                  )
                                  ?.click()
                              }
                            >
                              Đổi khoảng thời gian
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="rpt02-table-scroll">
                            <table
                              className="report-table"
                              data-detail-tab={detailTab}
                            >
                              <colgroup>
                                {/* Keep status/actions compact; widths total 100%. */}
                                {(detailTab === "reconcile"
                                  ? [
                                      "6%",
                                      "calc(50% - 240px)",
                                      "14%",
                                      "16%",
                                      "14%",
                                      "160px",
                                      "80px",
                                    ]
                                  : [
                                      "6%",
                                      "28%",
                                      "11%",
                                      "10%",
                                      "11%",
                                      "12%",
                                      "11%",
                                      "11%",
                                    ]
                                ).map((width, index) => (
                                  <col key={index} style={{ width }} />
                                ))}
                              </colgroup>
                              <thead>
                                {detailTab === "reconcile" ? (
                                  <tr>
                                    <th className="rpt02-stt" scope="col">
                                      #
                                    </th>
                                    <th>
                                      SKU / {tUi("inventory.balance.colName")}
                                    </th>
                                    <th className="num">
                                      {tUi(
                                        "reports.stockReconcileReport.colLedgerStock",
                                      )}
                                    </th>
                                    <th className="num">
                                      {tUi(
                                        "reports.stockReconcileReport.colRecordedStock",
                                      )}
                                    </th>
                                    <th className="num">
                                      {tUi("inventory.balance.colVariance")}
                                    </th>
                                    <th>
                                      {tUi("inventory.balance.colReconcile")}
                                    </th>
                                    <th
                                      aria-label={tUi(
                                        "reports.stockReconcileReport.colDetail",
                                      )}
                                    />
                                  </tr>
                                ) : (
                                  <tr>
                                    <th className="rpt02-stt" scope="col">
                                      #
                                    </th>
                                    <th>
                                      SKU / {tUi("inventory.balance.colName")}
                                    </th>
                                    <th className="num">
                                      {tUi("reports.inventoryFlow.opening")}
                                    </th>
                                    <th className="num">
                                      {tUi("dashboard.snapshot.tooltipInbound")}
                                    </th>
                                    <th className="num">
                                      {tUi("dashboard.flow.issueProduct")}
                                    </th>
                                    <th className="num">
                                      {tUi("updatedUi.text_68330ddddb9a")}
                                    </th>
                                    <th className="num">
                                      {tUi("iam.role.undo")}
                                    </th>
                                    <th className="num">
                                      {tUi("reports.inventoryFlow.closing")}
                                    </th>
                                  </tr>
                                )}
                              </thead>
                              <tbody>
                                {detailTab === "reconcile"
                                  ? visibleRows.map((row, index) => {
                                      const state = reconcileState(row);
                                      const label =
                                        state === "quantity"
                                          ? tUi(
                                              "reports.stockReconcileReport.quantityMismatch",
                                            )
                                          : state === "code"
                                            ? tUi(
                                                "reports.stockReconcileReport.codeMismatch",
                                              )
                                            : state === "review"
                                              ? tUi(
                                                  "reports.stockReconcileReport.reviewRequired",
                                                )
                                              : tUi(
                                                  "reports.stockReconcileReport.matched",
                                                );
                                      return (
                                        <tr
                                          key={row.key}
                                          {...rowActivationProps(() => {
                                            setDetailView(
                                              state === "code"
                                                ? "code"
                                                : "quantity",
                                            );
                                            setSelectedEvidence(row);
                                          })}
                                        >
                                          <td className="rpt02-stt">
                                            {(currentPage - 1) * pageSize +
                                              index +
                                              1}
                                          </td>
                                          <td className="rpt02-sku-cell">
                                            <div className="rpt02-sku-identity">
                                              <span
                                                className="rpt02-sku-icon"
                                                aria-hidden="true"
                                              >
                                                <Icon name="package-search" />
                                              </span>
                                              <div>
                                                <strong>{row.skuCode}</strong>
                                                <small>
                                                  {row.skuName ||
                                                    tUi(
                                                      "updatedUi.text_056cae173528",
                                                    )}
                                                </small>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="num">
                                            {quantity(row.ledgerStock)}
                                          </td>
                                          <td className="num">
                                            {quantity(row.actual)}
                                          </td>
                                          <td
                                            className={`num${row.delta === 0 ? "" : " is-alert"}`}
                                          >
                                            {signed(row.delta)}
                                          </td>
                                          <td>
                                            <span
                                              className={`rpt02-status-pill rpt02-status-pill--${state}`}
                                            >
                                              <i aria-hidden="true" />
                                              {label}
                                            </span>
                                            {row.checks.length > 0 ? (
                                              <small className="rpt02-checks">
                                                {row.checks
                                                  .map(checkLabelOf)
                                                  .join(", ")}
                                              </small>
                                            ) : null}
                                          </td>
                                          <td className="rpt02-row-open">
                                            <RowActionButton
                                              kind="view"
                                              className="rpt02-evidence-link"
                                              aria-label={`Xem bằng chứng ${row.skuCode}`}
                                              onClick={() => {
                                                setDetailView(
                                                  state === "code"
                                                    ? "code"
                                                    : "quantity",
                                                );
                                                setSelectedEvidence(row);
                                              }}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })
                                  : visibleRows.map((row, index) => (
                                      <tr
                                        key={row.key}
                                        {...rowActivationProps(() => {
                                          setDetailView("flow");
                                          setSelectedEvidence(row);
                                        })}
                                      >
                                        <td className="rpt02-stt">
                                          {(currentPage - 1) * pageSize +
                                            index +
                                            1}
                                        </td>
                                        <td className="rpt02-sku-cell">
                                          <div className="rpt02-sku-identity">
                                            <span
                                              className="rpt02-sku-icon"
                                              aria-hidden="true"
                                            >
                                              <Icon name="package-search" />
                                            </span>
                                            <div>
                                              <button
                                                type="button"
                                                className="rpt02-flow-sku-link"
                                                onClick={() => {
                                                  setDetailView("flow");
                                                  setSelectedEvidence(row);
                                                }}
                                              >
                                                {row.skuCode}
                                              </button>
                                              <small>
                                                {row.skuName ||
                                                  tUi(
                                                    "updatedUi.text_056cae173528",
                                                  )}
                                              </small>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="num">
                                          {quantity(row.opening)}
                                        </td>
                                        <td className="num is-positive">
                                          {signed(row.inbound)}
                                        </td>
                                        <td className="num is-negative">
                                          {signed(-row.productOutbound)}
                                        </td>
                                        <td className="num is-negative">
                                          {signed(-row.componentOutbound)}
                                        </td>
                                        <td className="num">
                                          {signed(row.reversal)}
                                        </td>
                                        <td className="num">
                                          <strong>
                                            {quantity(row.closing)}
                                          </strong>
                                        </td>
                                      </tr>
                                    ))}
                              </tbody>
                              {detailTab === "flow" ? (
                                <tfoot>
                                  <tr>
                                    <th scope="row" colSpan={2}>
                                      {tUi(
                                        "reports.stockReconcileReport.totalRow",
                                      )}
                                    </th>
                                    <td className="num">
                                      {quantity(flowTotals.opening)}
                                    </td>
                                    <td className="num">
                                      {quantity(flowTotals.inbound)}
                                    </td>
                                    <td className="num">
                                      {quantity(flowTotals.productOutbound)}
                                    </td>
                                    <td className="num">
                                      {quantity(flowTotals.componentOutbound)}
                                    </td>
                                    <td className="num">
                                      {quantity(flowTotals.reversal)}
                                    </td>
                                    <td className="num">
                                      {quantity(flowTotals.closing)}
                                    </td>
                                  </tr>
                                </tfoot>
                              ) : null}
                            </table>
                          </div>
                          <footer className="rpt02-pagination hn-report-pagination-footer">
                            <div className="rpt02-pagination-summary">
                              <span>
                                {tUi("putaway.queue.showing") + " "}
                                {(currentPage - 1) * pageSize + 1}–
                                {Math.min(
                                  currentPage * pageSize,
                                  displayRows.length,
                                )}{" "}
                                / {displayRows.length} SKU
                              </span>
                              <label className="rpt02-page-size">
                                <select
                                  value={pageSize}
                                  aria-label={tUi(
                                    "shared.table.rowsPerPageAria",
                                  )}
                                  onChange={(event) => {
                                    setPageSize(Number(event.target.value));
                                    setPage(1);
                                  }}
                                >
                                  {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>
                                      {tUi("shared.table.perPage", {
                                        size: String(size),
                                      })}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="hn-report-pagination">
                              <button
                                type="button"
                                aria-label={tUi(
                                  "reports.traceability.previousPage",
                                )}
                                onClick={() =>
                                  setPage((value) => Math.max(1, value - 1))
                                }
                                disabled={currentPage === 1}
                              >
                                <Icon name="chevron-left" />
                              </button>
                              {Array.from(
                                { length: Math.min(3, totalPages) },
                                (_, index) => {
                                  const first = Math.min(
                                    Math.max(currentPage - 1, 1),
                                    Math.max(1, totalPages - 2),
                                  );
                                  const number = first + index;
                                  return (
                                    <button
                                      type="button"
                                      key={number}
                                      aria-current={
                                        number === currentPage
                                          ? "page"
                                          : undefined
                                      }
                                      className={
                                        number === currentPage
                                          ? "is-active"
                                          : undefined
                                      }
                                      onClick={() => setPage(number)}
                                    >
                                      {number}
                                    </button>
                                  );
                                },
                              )}
                              <button
                                type="button"
                                aria-label="Trang sau"
                                onClick={() =>
                                  setPage((value) =>
                                    Math.min(totalPages, value + 1),
                                  )
                                }
                                disabled={currentPage === totalPages}
                              >
                                <Icon name="chevron-right" />
                              </button>
                            </div>
                          </footer>
                        </>
                      )}
                    </>
                  ) : null}
                </section>
              </section>
            </>
          )}
        </>
      )}
      {showExport ? (
        <StockReconcileExportDialog
          rows={displayRows}
          pageRows={visibleRows}
          from={applied.from}
          to={applied.to}
          asOf={reconciliation.snapshot.as_of}
          onClose={() => setShowExport(false)}
        />
      ) : null}
      {selectedEvidence ? (
        <StockReconcileDrilldown
          row={selectedEvidence}
          range={{ from: applied.from, to: applied.to }}
          asOf={reconciliation.snapshot.as_of}
          view={detailView}
          canExport={canExport}
          onViewChange={setDetailView}
          onBack={() => setSelectedEvidence(null)}
          onOpenInventory={() => navigate(ROUTES.INVENTORY)}
          onOpenTrace={() => navigate(ROUTES.REPORTS_TRACEABILITY)}
        />
      ) : null}
    </main>
  );
}
