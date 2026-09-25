import { useEffect, useRef, useState } from "react";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
import {
  activeLocale,
  dashboardNow,
  fmt,
  MAP_OVERVIEW_MAX_RANGE_DAYS,
} from "./overview-data";
import type { CompositionRow } from "./OverviewComposition";
import type { IssueRow } from "./OverviewOperations";
import { SnapshotStockFlowPlot } from "./SnapshotStockFlowPlot";

export type ChartState = "ready" | "loading" | "empty" | "failed" | "forbidden";

const ISO = "YYYY-MM-DD";
const KPI_TONES: Array<{ icon: DashboardIconName; tone: string }> = [
  { icon: "package-search", tone: "stock" },
  { icon: "settings-2", tone: "value" },
  { icon: "package-plus", tone: "in" },
  { icon: "package-minus", tone: "out" },
  { icon: "briefcase-medical", tone: "work" },
];

const dateLabel = (value: string) => dayjs(value).format("DD/MM");

function periodText(period: OverviewPeriod, range: DateRange, t: TranslateFn) {
  if (period === "last7") return t("dashboard.snapshot.periodLast7");
  if (period === "today") return t("dashboard.snapshot.periodToday");
  if (period === "month") return t("dashboard.snapshot.periodLast30");

  const inclusiveDays = dayjs(range.to).diff(dayjs(range.from), "day") + 1;
  const endsToday = range.to === dashboardNow().format(ISO);
  if (endsToday && inclusiveDays === 14)
    return t("dashboard.snapshot.periodLast14");
  if (endsToday && inclusiveDays === 30)
    return t("dashboard.snapshot.periodLast30");

  return t("dashboard.snapshot.periodCustom", {
    from: dateLabel(range.from),
    to: dateLabel(range.to),
  });
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
  const t = useT();

  if (state === "loading") {
    return (
      <div
        className="snapshot-chart-skeleton"
        role="status"
        aria-label={t("dashboard.snapshot.chartLoadingAria")}
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
      t("dashboard.snapshot.chartLoadingTitle"),
      t("dashboard.snapshot.chartLoadingCopy"),
    ],
    empty: [
      "inbox" as DashboardIconName,
      t("dashboard.snapshot.chartEmptyTitle"),
      t("dashboard.snapshot.chartEmptyCopy"),
    ],
    failed: [
      "triangle-alert" as DashboardIconName,
      t("dashboard.snapshot.chartFailedTitle"),
      t("dashboard.snapshot.chartFailedCopy"),
    ],
    forbidden: [
      "lock" as DashboardIconName,
      t("dashboard.snapshot.chartForbiddenTitle"),
      t("dashboard.snapshot.chartForbiddenCopy"),
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
          {t("dashboard.snapshot.changeFilter")}
        </button>
      ) : null}
      {state === "failed" ? (
        <button type="button" onClick={onRetry}>
          {t("dashboard.snapshot.retry")}
        </button>
      ) : null}
      {state === "forbidden" ? (
        <button type="button" onClick={() => window.history.back()}>
          {t("dashboard.snapshot.backOverview")}
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
  if (state !== "ready")
    return (
      <ChartPlaceholder
        state={state}
        onRetry={onRetry}
        onChangeFilter={onChangeFilter}
      />
    );
  return <SnapshotStockFlowPlot rows={rows} trend={trend} />;
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
  const t = useT();
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
          {t("dashboard.snapshot.monthLabel", {
            month: cursor.month() + 1,
            year: cursor.year(),
          })}
        </strong>
        <span>
          <button
            type="button"
            aria-label={t("dashboard.snapshot.prevMonth")}
            onClick={() => setCursor(cursor.subtract(1, "month"))}
          >
            <DashIcon name="chevron-left" />
          </button>
          <button
            type="button"
            aria-label={t("dashboard.snapshot.nextMonth")}
            disabled={!cursor.startOf("month").isBefore(today.startOf("month"))}
            onClick={() => setCursor(cursor.add(1, "month"))}
          >
            <DashIcon name="chevron-right" />
          </button>
        </span>
      </header>
      <div className="snapshot-calendar-week">
        {[
          t("dashboard.weekday.sun"),
          t("dashboard.weekday.mon"),
          t("dashboard.weekday.tue"),
          t("dashboard.weekday.wed"),
          t("dashboard.weekday.thu"),
          t("dashboard.weekday.fri"),
          t("dashboard.weekday.sat"),
        ].map((day) => (
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
  showWarranty: boolean;
  onRetry: () => void;
  onNavigate: (route: string) => void;
}) {
  const t = useT();
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
      ? t("dashboard.snapshot.invalidRequired")
      : draft.from > draft.to
        ? t("dashboard.snapshot.invalidOrder")
        : draft.from > todayIso || draft.to > todayIso
          ? t("dashboard.snapshot.invalidFuture")
          : draftDays > MAP_OVERVIEW_MAX_RANGE_DAYS
            ? t("dashboard.snapshot.invalidMaxDays", {
                days: MAP_OVERVIEW_MAX_RANGE_DAYS,
              })
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

  const effectiveLoading = loading;
  const effectiveFailed = failed;
  const effectiveForbidden = forbidden;
  const effectiveRows = rows;

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
  const tasks = issues.slice(0, 5);

  return (
    <div
      className="hn-dashboard-snapshot"
      data-ui="dashboard-reference"
      data-chart-state={chartState}
    >
      <header className="snapshot-heading">
        <span className="snapshot-heading-icon">
          <DashIcon name="layout-dashboard" />
        </span>
        <div>
          <h1>{t("dashboard.snapshot.greeting", { name })}</h1>
          <p>{t("dashboard.snapshot.greetingSub")}</p>
        </div>
        <div className="snapshot-time">
          <span>
            <DashIcon name="calendar-days" />
            {businessNow.toDate().toLocaleDateString(activeLocale(), {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
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
          aria-label={t("dashboard.snapshot.warehouseOpenAria")}
          onClick={() => onNavigate("/master-data/warehouse")}
        >
          <DashIcon name="warehouse" />
          <span>
            <strong>{warehouseLabel}</strong>
            <small>
              <i />
              {t("dashboard.snapshot.warehouseActive")}
            </small>
          </span>
          <DashIcon name="chevron-down" />
        </button>
      </header>

      {effectiveForbidden ? (
        <section className="snapshot-page-state">
          <span>
            <DashIcon name="lock" />
          </span>
          <h2>{t("dashboard.snapshot.forbiddenTitle")}</h2>
          <p>{t("dashboard.snapshot.forbiddenCopy")}</p>
          <div>
            <button type="button" onClick={() => window.history.back()}>
              {t("dashboard.snapshot.back")}
            </button>
            <button
              type="button"
              className="is-outline"
              onClick={() => onNavigate("/login")}
            >
              {t("dashboard.snapshot.logout")}
            </button>
          </div>
        </section>
      ) : (
        <>
          {
            <section
              className="snapshot-kpis"
              aria-label={t("dashboard.snapshot.kpiAria")}
            >
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
          }

          {effectiveFailed ? (
            <section className="snapshot-page-state is-error">
              <span>
                <DashIcon name="triangle-alert" />
              </span>
              <h2>{t("dashboard.snapshot.errorTitle")}</h2>
              <p>{t("dashboard.snapshot.errorCopy")}</p>
              <button type="button" onClick={onRetry}>
                {t("dashboard.snapshot.retry")}
              </button>
            </section>
          ) : (
            <>
              <section className="snapshot-main-grid">
                <article className="snapshot-card snapshot-chart-card">
                  <header>
                    <h2>{t("dashboard.snapshot.chartTitle")}</h2>
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
                        {periodText(period, range, t)}
                        <DashIcon name="chevron-down" />
                      </button>
                      {filterOpen && !filterDisabled ? (
                        <div className="snapshot-filter-menu" role="menu">
                          <span>{t("dashboard.snapshot.selectRange")}</span>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={selectedPreset === 7}
                            className={
                              selectedPreset === 7 ? "is-selected" : ""
                            }
                            onClick={() => selectDays(7)}
                          >
                            {t("dashboard.snapshot.periodLast7")}
                          </button>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={selectedPreset === 14}
                            className={
                              selectedPreset === 14 ? "is-selected" : ""
                            }
                            onClick={() => selectDays(14)}
                          >
                            {t("dashboard.snapshot.periodLast14")}
                          </button>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={selectedPreset === 30}
                            className={
                              selectedPreset === 30 ? "is-selected" : ""
                            }
                            onClick={() => selectDays(30)}
                          >
                            {t("dashboard.snapshot.periodLast30")}
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
                            {t("dashboard.snapshot.custom")}
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
                    <h2>{t("dashboard.snapshot.priorityTitle")}</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/reports/import-quality")}
                    >
                      {t("dashboard.snapshot.viewAll")}{" "}
                      <DashIcon name="arrow-right" />
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
                    <h2>{t("dashboard.snapshot.recentDocsTitle")}</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/inbound")}
                    >
                      {t("dashboard.snapshot.viewAll")}{" "}
                      <DashIcon name="arrow-right" />
                    </button>
                  </header>
                  <div className="snapshot-empty-table">
                    <DashIcon name="inbox" />
                    <strong>{t("dashboard.snapshot.recentDocsEmpty")}</strong>
                    <span>{t("dashboard.snapshot.recentDocsCopy")}</span>
                  </div>
                </article>
                <article className="snapshot-card snapshot-stock">
                  <header>
                    <h2>{t("dashboard.snapshot.stockCompositionTitle")}</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/inventory")}
                    >
                      {t("dashboard.snapshot.viewDetail")}{" "}
                      <DashIcon name="arrow-right" />
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
                          <span>{t("dashboard.snapshot.totalStock")}</span>
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
                    <strong>
                      {t("dashboard.snapshot.warehouseInfoTitle")}
                    </strong>
                    <small>{t("dashboard.snapshot.warehouseInfoCopy")}</small>
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
                    <strong>
                      {t("dashboard.snapshot.todayProgressTitle")}
                    </strong>
                    <small>{t("dashboard.snapshot.todayProgressCopy")}</small>
                  </div>
                  <DashIcon name="arrow-right" />
                </button>
                <button type="button" onClick={() => onNavigate("/inbound")}>
                  <span>
                    <DashIcon name="calendar-days" />
                  </span>
                  <div>
                    <strong>
                      {t("dashboard.snapshot.dailyScheduleTitle")}
                    </strong>
                    <small>{t("dashboard.snapshot.dailyScheduleCopy")}</small>
                  </div>
                  <DashIcon name="arrow-right" />
                </button>
              </section>
              <section className="snapshot-bottom">
                <article className="snapshot-card snapshot-actions">
                  <h2>{t("dashboard.snapshot.warehouseTasksTitle")}</h2>
                  <div>
                    {[
                      [
                        "package-plus",
                        t("dashboard.snapshot.actionInbound"),
                        "/inbound",
                      ],
                      [
                        "package-minus",
                        t("dashboard.snapshot.actionOutbound"),
                        "/outbound",
                      ],
                      ...(showWarranty
                        ? [
                            [
                              "briefcase-medical",
                              t("dashboard.snapshot.actionWarranty"),
                              "/warranty",
                            ],
                          ]
                        : []),
                      ["search", t("dashboard.snapshot.actionScan"), "/scan"],
                      [
                        "chart-column-big",
                        t("dashboard.snapshot.actionCheck"),
                        "/inventory",
                      ],
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
                    <h2>{t("dashboard.snapshot.recentActivityTitle")}</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate("/audit-logs")}
                    >
                      {t("dashboard.snapshot.viewAll")}{" "}
                      <DashIcon name="arrow-right" />
                    </button>
                  </header>
                  <div className="snapshot-empty-table">
                    <DashIcon name="inbox" />
                    <strong>
                      {t("dashboard.snapshot.recentActivityEmpty")}
                    </strong>
                    <span>{t("dashboard.snapshot.recentActivityCopy")}</span>
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
            aria-label={t("dashboard.snapshot.rangeDialogAria")}
            tabIndex={-1}
          >
            <header>
              <div>
                <h2>{t("dashboard.snapshot.rangeDialogTitle")}</h2>
                <p>{t("dashboard.snapshot.rangeDialogCopy")}</p>
              </div>
              <button
                type="button"
                aria-label={t("dashboard.snapshot.close")}
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
                {t("dashboard.snapshot.periodLast7")}
              </button>
              <button type="button" onClick={() => selectDays(14)}>
                {t("dashboard.snapshot.periodLast14")}
              </button>
              <button type="button" onClick={() => selectDays(30)}>
                {t("dashboard.snapshot.periodLast30")}
              </button>
              <button type="button" className="is-selected">
                {t("dashboard.snapshot.custom")}
              </button>
            </div>
            <div className="snapshot-date-fields">
              <label>
                {t("dashboard.snapshot.fromDate")}
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
                {t("dashboard.snapshot.toDate")}
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
                {t("dashboard.snapshot.selectedRange", {
                  from: dateLabel(draft.from),
                  to: dateLabel(draft.to),
                  days: dayjs(draft.to).diff(dayjs(draft.from), "day") + 1,
                })}
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
                  {t("dashboard.snapshot.cancel")}
                </button>
                <button type="button" disabled={invalid} onClick={applyCustom}>
                  {t("dashboard.snapshot.apply")}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
