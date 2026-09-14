import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { DashIcon } from "../components/DashIcon";
import type { DashboardIconName } from "../components/DashIcon";
import type { KpiCardModel } from "./OverviewKpiGrid";
import type {
  FlowRow,
  TrendRow,
  DateRange,
  OverviewPeriod,
} from "./overview-data";
import { dashboardNow, fmt } from "./overview-data";
import type { CompositionRow } from "./OverviewComposition";
import type { IssueRow } from "./OverviewOperations";

export type ChartState =
  | "ready"
  | "loading"
  | "empty"
  | "failed"
  | "forbidden";
export type OverviewReferenceState =
  | "loading"
  | "empty"
  | "error"
  | "permission-denied"
  | "pending-approval"
  | "processing"
  | "completed"
  | "overdue"
  | "urgent";

const ISO = "YYYY-MM-DD";
const MAP_FILTER_MAX_DAYS = 90;

const KPI_TONES: Array<{ icon: DashboardIconName; tone: string }> = [
  { icon: "package-search", tone: "stock" },
  { icon: "settings-2", tone: "value" },
  { icon: "package-plus", tone: "in" },
  { icon: "package-minus", tone: "out" },
  { icon: "briefcase-medical", tone: "work" },
];

const dateLabel = (value: string) => dayjs(value).format("DD/MM");

function periodText(period: OverviewPeriod, range: DateRange) {
  if (period === "last7") return "7 ngày gần nhất";
  if (period === "today") return "Hôm nay";
  if (period === "month") return "30 ngày gần nhất";
  return `Tùy chỉnh · ${dateLabel(range.from)}–${dateLabel(range.to)}`;
}

function ChartPlaceholder({
  state,
  onRetry,
  onChangeFilter,
}: {
  state: ChartState;
  onRetry: () => void;
  onChangeFilter: () => void;
}) {
  if (state === "loading") {
    return (
      <div
        className="snapshot-chart-skeleton"
        role="status"
        aria-label="Đang tải biểu đồ"
      >
        <div className="snapshot-chart-skeleton-legend" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="snapshot-chart-skeleton-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="snapshot-chart-skeleton-bars" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
      </div>
    );
  }

  const content = {
    loading: [
      "loader-circle" as DashboardIconName,
      "Đang tải biểu đồ",
      "Dữ liệu xu hướng đang được cập nhật.",
    ],
    empty: [
      "inbox" as DashboardIconName,
      "Chưa có dữ liệu trong khoảng đã chọn",
      "Chọn khoảng thời gian khác để xem xu hướng nhập – xuất – tồn kho.",
    ],
    failed: [
      "triangle-alert" as DashboardIconName,
      "Không tải được dữ liệu biểu đồ",
      "Đã xảy ra lỗi khi tải dữ liệu trong khoảng đã chọn.",
    ],
    forbidden: [
      "lock" as DashboardIconName,
      "Bạn không có quyền xem biểu đồ",
      "Liên hệ quản trị viên để được cấp quyền xem xu hướng kho.",
    ],
  } as const;
  const [icon, title, copy] = content[state === "ready" ? "empty" : state];
  return (
    <div className={`snapshot-chart-state is-${state}`} role="status">
      <span className="snapshot-state-icon">
        <DashIcon name={icon} />
      </span>
      <strong>{title}</strong>
      <p>{copy}</p>
      {state === "empty" ? (
        <button type="button" onClick={onChangeFilter}>
          Đổi bộ lọc
        </button>
      ) : null}
      {state === "failed" ? (
        <button type="button" onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
      {state === "forbidden" ? (
        <button type="button" onClick={() => window.history.back()}>
          Quay lại Tổng quan
        </button>
      ) : null}
    </div>
  );
}

function SnapshotChart({
  rows,
  trend,
  state,
  onRetry,
  onChangeFilter,
}: {
  rows: FlowRow[];
  trend: TrendRow[];
  state: ChartState;
  onRetry: () => void;
  onChangeFilter: () => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (state !== "ready")
    return (
      <ChartPlaceholder
        state={state}
        onRetry={onRetry}
        onChangeFilter={onChangeFilter}
      />
    );
  const W = 760;
  const H = 238;
  const pad = { left: 42, right: 40, top: 28, bottom: 34 };
  const maxFlow = Math.max(
    1,
    ...rows.flatMap((row) => [row.inbound, row.product + row.component]),
  );
  const maxTrend = Math.max(1, ...trend.map((row) => row.closing));
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const step = plotW / Math.max(rows.length, 1);
  const pointFor = (index: number, value: number) => ({
    x: pad.left + step * index + step / 2,
    y: pad.top + plotH - (value / maxTrend) * plotH,
  });
  const trendPoints = rows.map((row, index) =>
    pointFor(index, trend.find((item) => item.date === row.date)?.closing ?? 0),
  );
  const d = trendPoints
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const hoveredRow =
    hoveredIndex === null ? null : (rows[hoveredIndex] ?? null);
  const hoveredPoint =
    hoveredIndex === null ? null : (trendPoints[hoveredIndex] ?? null);
  const hoveredStock = hoveredRow
    ? (trend.find((item) => item.date === hoveredRow.date)?.closing ?? 0)
    : 0;
  // Tooltip cao gần bằng nửa vùng plot. Với điểm tồn ở sát cạnh trên, hiển thị
  // nó phía trên sẽ che tiêu đề và chú giải của biểu đồ.
  const showTooltipBelow = hoveredPoint !== null && hoveredPoint.y < 140;

  return (
    <div className="snapshot-chart-canvas">
      <div className="snapshot-legend" aria-label="Chú giải biểu đồ">
        <span className="is-in">
          <i />
          Nhập kho
        </span>
        <span className="is-out">
          <i />
          Xuất kho
        </span>
        <span className="is-stock">
          <i />
          Tồn kho
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Biểu đồ nhập xuất tồn kho"
        preserveAspectRatio="none"
      >
        {ticks.map((tick) => {
          const y = pad.top + plotH - tick * plotH;
          return (
            <g key={tick}>
              <line
                className="snapshot-grid"
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
              />
              <text className="snapshot-axis" x="6" y={y + 4}>
                {fmt(Math.round(maxFlow * tick))}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const x = pad.left + step * index + step * 0.18;
          const inner = Math.min(22, step * 0.28);
          const inboundH = (row.inbound / maxFlow) * plotH;
          const outboundH = ((row.product + row.component) / maxFlow) * plotH;
          return (
            <g className="snapshot-bars" key={row.date}>
              <rect
                x={x}
                y={pad.top + plotH - inboundH}
                width={inner}
                height={inboundH}
                rx="2"
              />
              <rect
                className="is-out"
                x={x + inner + 4}
                y={pad.top + plotH - outboundH}
                width={inner}
                height={outboundH}
                rx="2"
              />
              <text
                className="snapshot-axis snapshot-x"
                x={pad.left + step * index + step / 2}
                y={H - 8}
                textAnchor="middle"
              >
                {dateLabel(row.date)}
              </text>
              <rect
                className="snapshot-hover-target"
                x={pad.left + step * index}
                y={pad.top}
                width={step}
                height={plotH}
                rx="2"
                tabIndex={0}
                role="button"
                aria-label={`${dateLabel(row.date)}: Nhập ${fmt(row.inbound)}, Xuất ${fmt(
                  row.product + row.component,
                )}, Tồn ${fmt(
                  trend.find((item) => item.date === row.date)?.closing ?? 0,
                )}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                onPointerDown={() => setHoveredIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setHoveredIndex(null);
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setHoveredIndex(index);
                  }
                }}
              />
            </g>
          );
        })}
        <path className="snapshot-trend" d={d} />
        {trendPoints.map((point, index) => (
          <circle
            className="snapshot-point"
            key={rows[index]?.date ?? index}
            cx={point.x}
            cy={point.y}
            r="4"
          />
        ))}
        <text className="snapshot-stock-axis" x={W - 2} y={17} textAnchor="end">
          Tồn cuối ngày
        </text>
      </svg>
      {hoveredRow && hoveredPoint ? (
        <div
          className={`snapshot-chart-tooltip ${showTooltipBelow ? "is-below" : ""}`}
          role="status"
          style={{
            left: `${(hoveredPoint.x / W) * 100}%`,
            top: `${(Math.max(52, hoveredPoint.y) / H) * 100}%`,
          }}
        >
          <strong>{dayjs(hoveredRow.date).format("DD/MM/YYYY")}</strong>
          <span>
            <i className="is-in" />
            Nhập <b>{fmt(hoveredRow.inbound)}</b>
          </span>
          <span>
            <i className="is-out" />
            Xuất <b>{fmt(hoveredRow.product + hoveredRow.component)}</b>
          </span>
          <span>
            <i className="is-stock" />
            Tồn <b>{fmt(hoveredStock)}</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MonthGrid({
  range,
  invalid,
  onPick,
}: {
  range: DateRange;
  invalid: boolean;
  onPick: (value: string) => void;
}) {
  const cursorValue = range.from || range.to;
  const [cursor, setCursor] = useState(() =>
    dayjs(cursorValue || dashboardNow()).startOf("month"),
  );
  const today = dashboardNow().startOf("day");
  const start = cursor.startOf("month").startOf("week");
  const cells = Array.from({ length: 42 }, (_, index) =>
    start.add(index, "day"),
  );
  const hasRange = Boolean(range.from && range.to);
  const rangeStart =
    hasRange && range.from <= range.to ? range.from : hasRange ? range.to : "";
  const rangeEnd =
    hasRange && range.from <= range.to ? range.to : hasRange ? range.from : "";

  return (
    <div className={`snapshot-calendar ${invalid ? "is-invalid" : ""}`}>
      <header>
        <strong>
          Tháng {cursor.month() + 1} {cursor.year()}
        </strong>
        <span>
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => setCursor(cursor.subtract(1, "month"))}
          >
            <DashIcon name="chevron-left" />
          </button>
          <button
            type="button"
            aria-label="Tháng sau"
            disabled={!cursor.startOf("month").isBefore(today.startOf("month"))}
            onClick={() => setCursor(cursor.add(1, "month"))}
          >
            <DashIcon name="chevron-right" />
          </button>
        </span>
      </header>
      <div className="snapshot-calendar-week">
        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="snapshot-calendar-days">
        {cells.map((date) => {
          const iso = date.format(ISO);
          const isStart = hasRange && iso === range.from;
          const isEnd = hasRange && iso === range.to;
          const inRange =
            hasRange &&
            iso >= rangeStart &&
            iso <= rangeEnd &&
            !isStart &&
            !isEnd;
          const classes = [
            date.month() !== cursor.month() ? "is-other" : "",
            isStart ? "is-range-start" : "",
            isEnd ? "is-range-end" : "",
            inRange ? "is-in-range" : "",
            invalid && (isStart || isEnd || inRange) ? "is-invalid-range" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={iso}
              type="button"
              className={classes}
              aria-pressed={isStart || isEnd}
              disabled={date.isAfter(today, "day")}
              onClick={() => onPick(iso)}
            >
              {date.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardSnapshot({
  name,
  warehouseLabel,
  cards,
  rows,
  trend,
  composition,
  issues,
  range,
  period,
  custom,
  onPeriodChange,
  onCustomChange,
  loading,
  failed,
  forbidden,
  chartStateOverride,
  referenceState,
  showWarranty,
  onRetry,
  onNavigate,
}: {
  name: string;
  warehouseLabel: string;
  cards: KpiCardModel[];
  rows: FlowRow[];
  trend: TrendRow[];
  composition: CompositionRow[];
  issues: IssueRow[];
  range: DateRange;
  period: OverviewPeriod;
  custom: DateRange;
  onPeriodChange: (value: OverviewPeriod) => void;
  onCustomChange: (value: DateRange) => void;
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
  chartStateOverride?: ChartState;
  referenceState?: OverviewReferenceState;
  showWarranty: boolean;
  onRetry: () => void;
  onNavigate: (route: string) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState(custom);
  const [rangePickMode, setRangePickMode] = useState<"from" | "to">("from");
  const [activeIssue, setActiveIssue] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const customDialogRef = useRef<HTMLElement | null>(null);
  const businessNow = dashboardNow();
  const todayIso = businessNow.format(ISO);
  const draftDays =
    draft.from && draft.to
      ? dayjs(draft.to).diff(dayjs(draft.from), "day") + 1
      : 0;
  const invalidReason =
    !draft.from || !draft.to
      ? "Chọn đầy đủ ngày bắt đầu và ngày kết thúc."
      : draft.from > draft.to
        ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."
        : draft.from > todayIso || draft.to > todayIso
          ? "Không thể chọn ngày trong tương lai."
          : draftDays > MAP_FILTER_MAX_DAYS
            ? `Khoảng thời gian tối đa ${MAP_FILTER_MAX_DAYS} ngày.`
            : "";
  const invalid = invalidReason !== "";

  useEffect(() => {
    if (!filterOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !filterRef.current?.contains(target)) {
        setFilterOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFilterOpen(false);
      filterButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!customOpen) return;
    const focusTimer = window.setTimeout(
      () => customDialogRef.current?.focus(),
      0,
    );
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCustomOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [customOpen]);

  const selectedRangeDays =
    period === "last7"
      ? 7
      : period === "custom" && range.to === todayIso
        ? dayjs(range.to).diff(dayjs(range.from), "day") + 1
        : null;
  const selectedPreset =
    selectedRangeDays === 7 ||
    selectedRangeDays === 14 ||
    selectedRangeDays === 30
      ? selectedRangeDays
      : null;
  const customSelected = period === "custom" && selectedPreset === null;
  const total = composition.reduce((sum, row) => sum + row.value, 0);
  const donut = composition.reduce(
    (parts, row, index) => {
      const from = parts.at(-1)?.to ?? 0;
      return [
        ...parts,
        {
          ...row,
          from,
          to: from + (total ? (row.value / total) * 100 : 0),
          index,
        },
      ];
    },
    [] as Array<CompositionRow & { from: number; to: number; index: number }>,
  );
  const referenceLoading = referenceState === "loading";
  const referenceEmpty = referenceState === "empty";
  const referenceFailed = referenceState === "error";
  const referenceForbidden = referenceState === "permission-denied";
  const effectiveLoading = loading || referenceLoading;
  const effectiveFailed = failed || referenceFailed;
  const effectiveForbidden = forbidden || referenceForbidden;
  const effectiveRows = referenceEmpty ? [] : rows;
  const chartState: ChartState =
    chartStateOverride ??
    (effectiveForbidden
      ? "forbidden"
      : effectiveLoading
        ? "loading"
        : effectiveFailed
          ? "failed"
          : effectiveRows.length === 0
            ? "empty"
            : "ready");
  const filterDisabled = chartState === "loading" || chartState === "forbidden";

  const selectDays = (days: 7 | 14 | 30) => {
    setFilterOpen(false);
    setCustomOpen(false);
    if (days === 7) return onPeriodChange("last7");
    const next = {
      from: dashboardNow()
        .subtract(days - 1, "day")
        .format(ISO),
      to: todayIso,
    };
    onCustomChange(next);
    onPeriodChange("custom");
  };
  const applyCustom = () => {
    if (!invalid) {
      onCustomChange(draft);
      onPeriodChange("custom");
      setCustomOpen(false);
      setRangePickMode("from");
    }
  };
  const pickRangeDate = (value: string) => {
    if (rangePickMode === "from" || !draft.from) {
      setDraft({ from: value, to: value });
      setRangePickMode("to");
      return;
    }
    if (value < draft.from) {
      setDraft({ from: value, to: draft.from });
    } else {
      setDraft({ ...draft, to: value });
    }
    setRangePickMode("from");
  };
  const tasks = referenceEmpty ? [] : issues.slice(0, 5);
  const referenceOperationState =
    referenceState === "pending-approval"
      ? {
          label: "Chờ duyệt",
          icon: "file-clock" as DashboardIconName,
          tone: "warning",
        }
      : referenceState === "processing"
        ? {
            label: "Đang xử lý",
            icon: "loader-circle" as DashboardIconName,
            tone: "info",
          }
        : referenceState === "completed"
          ? {
              label: "Hoàn thành",
              icon: "circle-dot" as DashboardIconName,
              tone: "success",
            }
          : referenceState === "overdue"
            ? {
                label: "Quá hạn",
                icon: "file-clock" as DashboardIconName,
                tone: "danger",
              }
            : referenceState === "urgent"
              ? {
                  label: "Khẩn cấp",
                  icon: "triangle-alert" as DashboardIconName,
                  tone: "danger",
                }
              : null;
  return (
    <div
      className="hn-dashboard-snapshot"
      data-ui="dashboard-reference"
      data-reference-state={referenceState ?? "live"}
      data-chart-state={chartState}
    >
      <header className="snapshot-heading">
        <span className="snapshot-heading-icon">
          <DashIcon name="layout-dashboard" />
        </span>
        <div>
          <h1>Chào buổi sáng, {name}!</h1>
          <p>Cùng quản lý kho hiệu quả hơn mỗi ngày.</p>
        </div>
        <div className="snapshot-time">
          <span>
            <DashIcon name="calendar-days" />
            {businessNow.format("dddd, DD [tháng] M, YYYY")}
          </span>
          <i />
          <span>
            <DashIcon name="circle-dot" />
            {businessNow.format("HH:mm")}
          </span>
        </div>
        <button
          type="button"
          className="snapshot-warehouse"
          aria-label="Mở thông tin kho đang xem"
          onClick={() => onNavigate("/master-data/warehouse")}
        >
          <DashIcon name="warehouse" />
          <span>
            <strong>{warehouseLabel}</strong>
            <small>
              <i />
              Đang hoạt động
            </small>
          </span>
          <DashIcon name="chevron-down" />
        </button>
      </header>

      {referenceOperationState ? (
        <section
          className={`snapshot-reference-state is-${referenceOperationState.tone}`}
          role="status"
          aria-label={`Trạng thái tổng quan: ${referenceOperationState.label}`}
        >
          <span>
            <DashIcon name={referenceOperationState.icon} />
          </span>
          <strong>{referenceOperationState.label}</strong>
        </section>
      ) : null}

      {effectiveForbidden ? (
        <section className="snapshot-page-state">
          <span>
            <DashIcon name="lock" />
          </span>
          <h2>Bạn chưa có quyền xem Tổng quan</h2>
          <p>Tài khoản của bạn chưa được cấp quyền truy cập màn hình này.</p>
          <div>
            <button type="button" onClick={() => window.history.back()}>
              Quay lại
            </button>
            <button
              type="button"
              className="is-outline"
              onClick={() => onNavigate("/login")}
            >
              Đăng xuất
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="snapshot-kpis" aria-label="Chỉ số tổng quan">
            {cards.map((card, index) => {
              const appearance = KPI_TONES[index] ?? KPI_TONES[0];
              return (
                <article
                  key={card.id}
                  className={`snapshot-kpi ${
                    effectiveLoading ? "is-loading" : ""
                  }`}
                  data-kpi-id={card.id}
                >
                  <span className={`snapshot-kpi-icon is-${appearance.tone}`}>
                    <DashIcon name={appearance.icon} />
                  </span>
                  <div>
                    <span>{card.label}</span>
                    <strong>
                      {effectiveLoading
                        ? ""
                        : card.value === null
                          ? "—"
                          : fmt(card.value)}
                    </strong>
                    <small>{effectiveLoading ? "" : card.note}</small>
                    {!effectiveLoading && card.delta ? (
                      <em className={`is-${card.trend}`}>{card.delta}</em>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>

          {referenceEmpty ? (
            <section className="snapshot-page-state is-empty">
              <span>
                <DashIcon name="inbox" />
              </span>
              <h2>Chưa có dữ liệu tổng quan</h2>
              <p>Chưa có dữ liệu phù hợp để hiển thị trong phạm vi hiện tại.</p>
            </section>
          ) : effectiveFailed && !chartStateOverride ? (
            <section className="snapshot-page-state is-error">
              <span>
                <DashIcon name="triangle-alert" />
              </span>
              <h2>Không thể tải dữ liệu tổng quan</h2>
              <p>Đã xảy ra lỗi khi kết nối dữ liệu. Vui lòng thử lại.</p>
              <button type="button" onClick={onRetry}>
                Thử lại
              </button>
            </section>
          ) : (
            <>
              <section className="snapshot-main-grid">
                <article className="snapshot-card snapshot-chart-card">
                  <header>
                    <h2>Biểu đồ nhập - xuất - tồn kho</h2>
                    <div className="snapshot-filter" ref={filterRef}>
                      <button
                        ref={filterButtonRef}
                        type="button"
                        aria-expanded={filterOpen && !filterDisabled}
                        aria-haspopup="menu"
                        disabled={filterDisabled}
                        onClick={() => {
                          if (!filterDisabled) setFilterOpen((value) => !value);
                        }}
                      >
                        {periodText(period, range)}
                        <DashIcon name="chevron-down" />
                      </button>
                      {filterOpen && !filterDisabled ? (
                        <div className="snapshot-filter-menu" role="menu">
                          <span>Chọn khoảng thời gian</span>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={selectedPreset === 7}
                            className={selectedPreset === 7 ? "is-selected" : ""}
                            onClick={() => selectDays(7)}
                          >
                            7 ngày gần nhất
                          </button>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={selectedPreset === 14}
                            className={selectedPreset === 14 ? "is-selected" : ""}
                            onClick={() => selectDays(14)}
                          >
                            14 ngày gần nhất
                          </button>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={selectedPreset === 30}
                            className={selectedPreset === 30 ? "is-selected" : ""}
                            onClick={() => selectDays(30)}
                          >
                            30 ngày gần nhất
                          </button>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={customSelected}
                            className={customSelected ? "is-selected" : ""}
                            onClick={() => {
                              setDraft(custom);
                              setRangePickMode("from");
                              setCustomOpen(true);
                              setFilterOpen(false);
                            }}
                          >
                            Tùy chỉnh
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </header>
                  <SnapshotChart
                    rows={effectiveRows}
                    trend={trend}
                    state={chartState}
                    onRetry={onRetry}
                    onChangeFilter={() => setFilterOpen(true)}
                  />
                </article>
                <article className="snapshot-card snapshot-priority">
                  <header>
                    <h2>Công việc cần ưu tiên</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/reports/import-quality")}
                    >
                      Xem tất cả <DashIcon name="arrow-right" />
                    </button>
                  </header>
                  {effectiveLoading ? (
                    <div className="snapshot-list-loading" />
                  ) : tasks.length ? (
                    <div>
                      {tasks.map((task, index) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => {
                            setActiveIssue(task.id);
                            onNavigate(task.route);
                          }}
                          className={`snapshot-priority-row ${activeIssue === task.id ? "is-active" : ""}`}
                        >
                          <span
                            className={`snapshot-priority-icon is-${task.severity.toLowerCase()}`}
                          >
                            <DashIcon
                              name={
                                index === 1
                                  ? "settings-2"
                                  : index === 2
                                    ? "briefcase-medical"
                                    : "triangle-alert"
                              }
                            />
                          </span>
                          <span>
                            <strong>{task.title}</strong>
                            <small>{task.detail}</small>
                          </span>
                          <b>{fmt(task.count)}</b>
                          <i>Xem</i>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <ChartPlaceholder
                      state="empty"
                      onRetry={onRetry}
                      onChangeFilter={() => setFilterOpen(true)}
                    />
                  )}
                </article>
                <article className="snapshot-card snapshot-recent">
                  <header>
                    <h2>Phiếu gần đây</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/inbound")}
                    >
                      Xem tất cả <DashIcon name="arrow-right" />
                    </button>
                  </header>
                  <div className="snapshot-empty-table">
                    <DashIcon name="inbox" />
                    <strong>Chưa có phiếu gần đây</strong>
                    <span>
                      Dữ liệu phiếu sẽ hiển thị khi nguồn được kết nối.
                    </span>
                  </div>
                </article>
                <article className="snapshot-card snapshot-stock">
                  <header>
                    <h2>Cơ cấu trạng thái tồn kho</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/inventory")}
                    >
                      Xem chi tiết <DashIcon name="arrow-right" />
                    </button>
                  </header>
                  {effectiveLoading ? (
                    <div className="snapshot-donut-loading" />
                  ) : total > 0 ? (
                    <div className="snapshot-stock-body">
                      <div
                        className="snapshot-donut"
                        style={{
                          background: `conic-gradient(${donut.map((row) => `var(--snapshot-donut-${row.index}) ${row.from}% ${row.to}%`).join(",")})`,
                        }}
                      >
                        <div>
                          <strong>{fmt(total)}</strong>
                          <span>Tổng tồn</span>
                        </div>
                      </div>
                      <div className="snapshot-stock-list">
                        {composition.map((row, index) => (
                          <div key={row.status}>
                            <i
                              style={{
                                background: `var(--snapshot-donut-${index})`,
                              }}
                            />
                            <span>{row.label}</span>
                            <strong>{fmt(row.value)}</strong>
                            <small>{row.pct}%</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ChartPlaceholder
                      state="empty"
                      onRetry={onRetry}
                      onChangeFilter={() => setFilterOpen(true)}
                    />
                  )}
                </article>
              </section>

              <section className="snapshot-link-cards">
                <button
                  type="button"
                  onClick={() => onNavigate("/master-data/warehouse")}
                >
                  <span className="is-orange">
                    <DashIcon name="package-search" />
                  </span>
                  <div>
                    <strong>Thông tin kho</strong>
                    <small>Phạm vi kho đang được cấp quyền</small>
                  </div>
                  <DashIcon name="arrow-right" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("/reports/inventory-flow")}
                >
                  <span className="is-green">
                    <DashIcon name="chart-column-big" />
                  </span>
                  <div>
                    <strong>Tiến độ xử lý hôm nay</strong>
                    <small>Dữ liệu nhập – xuất theo ngày</small>
                  </div>
                  <DashIcon name="arrow-right" />
                </button>
                <button type="button" onClick={() => onNavigate("/inbound")}>
                  <span>
                    <DashIcon name="calendar-days" />
                  </span>
                  <div>
                    <strong>Lịch nhập/xuất trong ngày</strong>
                    <small>Theo dõi phiếu phát sinh</small>
                  </div>
                  <DashIcon name="arrow-right" />
                </button>
              </section>
              <section className="snapshot-bottom">
                <article className="snapshot-card snapshot-actions">
                  <h2>Tác vụ kho</h2>
                  <div>
                    {[
                      ["package-plus", "Nhập kho", "/inbound"],
                      ["package-minus", "Xuất kho", "/outbound"],
                      ...(showWarranty
                        ? [["briefcase-medical", "Bảo hành", "/warranty"]]
                        : []),
                      ["search", "Quét hoặc nhập mã sản phẩm", "/scan"],
                      ["chart-column-big", "Kiểm tra mã", "/inventory"],
                    ].map(([icon, label, route]) => (
                      <button
                        type="button"
                        key={label}
                        onClick={() => onNavigate(route)}
                      >
                        <DashIcon name={icon as DashboardIconName} />
                        <strong>{label}</strong>
                      </button>
                    ))}
                  </div>
                </article>
                <article className="snapshot-card snapshot-activity">
                  <header>
                    <h2>Nhật ký hoạt động gần đây</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/audit-logs")}
                    >
                      Xem tất cả <DashIcon name="arrow-right" />
                    </button>
                  </header>
                  <div className="snapshot-empty-table">
                    <DashIcon name="inbox" />
                    <strong>Chưa có hoạt động</strong>
                    <span>
                      Hoạt động gần đây sẽ được hiển thị khi nguồn được kết nối.
                    </span>
                  </div>
                </article>
              </section>
            </>
          )}
        </>
      )}
      {customOpen ? (
        <div
          className="snapshot-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCustomOpen(false);
              setRangePickMode("from");
            }
          }}
        >
          <section
            ref={customDialogRef}
            className="snapshot-custom-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Chọn khoảng thời gian"
            tabIndex={-1}
          >
            <header>
              <div>
                <h2>Chọn khoảng thời gian</h2>
                <p>Chỉ áp dụng cho biểu đồ nhập – xuất – tồn kho.</p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => {
                  setCustomOpen(false);
                  setRangePickMode("from");
                }}
              >
                ×
              </button>
            </header>
            <div className="snapshot-preset-row">
              <button type="button" onClick={() => selectDays(7)}>
                7 ngày gần nhất
              </button>
              <button type="button" onClick={() => selectDays(14)}>
                14 ngày gần nhất
              </button>
              <button type="button" onClick={() => selectDays(30)}>
                30 ngày gần nhất
              </button>
              <button type="button" className="is-selected">
                Tùy chỉnh
              </button>
            </div>
            <div className="snapshot-date-fields">
              <label>
                Từ ngày
                <input
                  type="date"
                  value={draft.from}
                  max={todayIso}
                  onFocus={() => setRangePickMode("from")}
                  onChange={(event) => {
                    setRangePickMode("to");
                    setDraft({ ...draft, from: event.target.value });
                  }}
                />
              </label>
              <label>
                Đến ngày
                <input
                  type="date"
                  value={draft.to}
                  max={todayIso}
                  onFocus={() => setRangePickMode("to")}
                  onChange={(event) => {
                    setRangePickMode("from");
                    setDraft({ ...draft, to: event.target.value });
                  }}
                />
              </label>
            </div>
            {invalid ? (
              <p className="snapshot-date-error">{invalidReason}</p>
            ) : (
              <p className="snapshot-date-summary">
                Đang chọn: {dateLabel(draft.from)} → {dateLabel(draft.to)} ·{" "}
                {dayjs(draft.to).diff(dayjs(draft.from), "day") + 1} ngày
              </p>
            )}
            <MonthGrid range={draft} invalid={invalid} onPick={pickRangeDate} />
            <footer>
              <span>
                {dateLabel(draft.from)} → {dateLabel(draft.to)}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomOpen(false);
                    setRangePickMode("from");
                  }}
                >
                  Hủy
                </button>
                <button type="button" disabled={invalid} onClick={applyCustom}>
                  Áp dụng
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
