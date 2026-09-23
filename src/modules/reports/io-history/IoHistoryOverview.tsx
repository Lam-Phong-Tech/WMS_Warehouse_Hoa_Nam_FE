import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import { useId, useMemo, useState, type CSSProperties } from "react";
import dayjs from "dayjs";
import { fmt } from "@/modules/reports/operations/report-format";
import type { IoDocType, IoHistoryRow } from "./io-history-api";
import "./io-history-overview.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

type OverviewProps = {
  rows: IoHistoryRow[];
  loading?: boolean;
  stale?: boolean;
  from?: string;
  to?: string;
};
type DayCount = {
  day: string;
  INBOUND: number;
  OUTBOUND: number;
  REVERSAL: number;
};
const getSERIES = localizedUiValue(
  () =>
    [
      { type: "INBOUND", label: tUi("dashboard.snapshot.inbound"), tone: "in" },
      {
        type: "OUTBOUND",
        label: tUi("dashboard.snapshot.outbound"),
        tone: "out",
      },
      { type: "REVERSAL", label: tUi("iam.role.undo"), tone: "reversal" },
    ] as const,
);

function OverviewIcon({
  name,
}: {
  name: "transfer" | "box" | "calendar" | "empty";
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === "transfer" && <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />}
      {name === "box" && (
        <>
          <path d="m12 2 9 5v10l-9 5-9-5V7Z" />
          <path d="m3 7 9 5 9-5M12 12v10" />
        </>
      )}
      {name === "calendar" && <path d="M4 5h16v16H4ZM8 2v6M16 2v6" />}
      {name === "empty" && (
        <path d="m12 7 7 4-7 4-7-4 7-4Zm-7 4v8l7 4 7-4v-8M12 15v8M5 11 2 7l7-4 3 4 3-4 7 4-3 4M2 23h20" />
      )}
    </svg>
  );
}
function percentage(value: number, total: number, decimal = false): string {
  if (!total) return decimal ? "0,0%" : "—";
  const number = (value / total) * 100;
  return `${decimal ? number.toFixed(1).replace(".", ",") : fmt(Math.round(number * 10) / 10)}%`;
}
function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${fmt(Math.abs(value))}`;
}

function DayChart({
  days,
  hasReversals,
  total,
}: {
  days: DayCount[];
  hasReversals: boolean;
  total: number;
}) {
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const tooltipId = useId();
  const series = hasReversals ? getSERIES() : getSERIES().slice(0, 2);
  const highest = days.reduce(
    (max, day) => Math.max(max, ...series.map(({ type }) => day[type])),
    0,
  );
  const targetStep = Math.max(highest / 3, 1);
  const power = 10 ** Math.floor(Math.log10(targetStep));
  const step =
    ([1, 2, 5, 10].find((candidate) => candidate * power >= targetStep) ?? 10) *
    power;
  const ceiling = total === 0 ? 60 : step * 3;
  const compact = days.length > 10;
  const minimumDayWidth = Math.max(
    42,
    (fmt(highest).length * 6 + 4) * series.length + 12,
  );
  return (
    <div
      className="io-daily-chart"
      aria-label={tUi("updatedUi.text_36cef5453a55")}
    >
      <div
        className="io-chart-axis"
        aria-hidden="true"
        style={{ flexBasis: Math.max(28, fmt(ceiling).length * 7 + 5) }}
      >
        {[3, 2, 1, 0].map((tick) => (
          <span key={tick}>{fmt((ceiling * tick) / 3)}</span>
        ))}
      </div>
      <div
        className="io-chart-scroll"
        tabIndex={compact ? 0 : undefined}
        aria-label={compact ? tUi("updatedUi.text_2ecbe380156e") : undefined}
      >
        <div
          className="io-chart-plot"
          style={
            {
              "--io-day-count": Math.max(days.length, 1),
              "--io-day-min": `${Math.max(compact ? 54 : 0, minimumDayWidth)}px`,
            } as CSSProperties
          }
        >
          <div className="io-chart-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((line) => (
              <span key={line} />
            ))}
          </div>
          <div className="io-chart-days">
            {days.map((day, index) => (
              <div className="io-chart-day" key={day.day}>
                <button
                  type="button"
                  className="io-chart-day-target"
                  aria-label={`${dayjs(day.day).format("DD/MM/YYYY")}: ${series.map(({ type, label }) => `${label} ${fmt(day[type])}`).join(", ")}`}
                  aria-describedby={
                    activeDay === day.day ? `${tooltipId}-${index}` : undefined
                  }
                  onMouseEnter={() => setActiveDay(day.day)}
                  onMouseLeave={() =>
                    setActiveDay((current) =>
                      current === day.day ? null : current,
                    )
                  }
                  onFocus={() => setActiveDay(day.day)}
                  onBlur={() => setActiveDay(null)}
                  onClick={() => setActiveDay(day.day)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setActiveDay(null);
                    }
                  }}
                >
                  {series.map(({ type, tone }) => (
                    <span
                      key={type}
                      className={`io-chart-bar is-${tone}`}
                      style={{ height: `${(day[type] / ceiling) * 100}%` }}
                    >
                      {day[type] > 0 && <b>{fmt(day[type])}</b>}
                    </span>
                  ))}
                </button>
                <span className="io-chart-date">
                  {dayjs(day.day).format("DD/MM")}
                </span>
                {activeDay === day.day && (
                  <div
                    id={`${tooltipId}-${index}`}
                    role="tooltip"
                    className={`io-chart-tooltip${index === 0 ? " is-first" : index === days.length - 1 ? " is-last" : ""}`}
                  >
                    <strong>{dayjs(day.day).format("DD/MM/YYYY")}</strong>
                    {series.map(({ type, label, tone }) => (
                      <span key={type}>
                        <i className={`io-dot is-${tone}`} />
                        {label}
                        <b>{fmt(day[type])}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {total === 0 && (
            <div className="io-chart-empty">
              <OverviewIcon name="empty" />
              <span>{tUi("dashboard.flow.emptyTitle")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div
      className="io-overview is-loading"
      role="status"
      aria-label={tUi("updatedUi.text_64940843819f")}
      aria-busy="true"
    >
      <div className="io-summary-grid" aria-hidden="true">
        <div className="io-overview-card io-transfer-card">
          <span className="io-summary-icon io-skeleton" />
          <div className="io-summary-heading">
            <i className="io-skeleton io-skeleton-title" />
            <i className="io-skeleton io-skeleton-value" />
            <i className="io-skeleton io-skeleton-note" />
          </div>
          <div className="io-transfer-distribution">
            <i className="io-skeleton io-proportion-bar" />
            <div className="io-transfer-counts">
              <i className="io-skeleton io-skeleton-value" />
              <i className="io-skeleton io-skeleton-value" />
            </div>
          </div>
        </div>
        <div className="io-overview-card io-product-card">
          <span className="io-summary-icon io-skeleton" />
          <div className="io-product-content">
            <i className="io-skeleton io-skeleton-title" />
            <i className="io-skeleton io-skeleton-value" />
            <i className="io-skeleton io-skeleton-note" />
          </div>
        </div>
      </div>
      <div className="io-charts-grid" aria-hidden="true">
        <div className="io-overview-card io-daily-card">
          <i className="io-skeleton io-skeleton-title" />
          <i className="io-skeleton io-skeleton-note" />
          <div className="io-skeleton-chart">
            {Array.from({ length: 14 }, (_, index) => (
              <i className="io-skeleton" key={index} />
            ))}
          </div>
        </div>
        <div className="io-overview-card io-rhythm-card">
          <i className="io-skeleton io-skeleton-title" />
          <i className="io-skeleton io-skeleton-note" />
          <div className="io-donut-row">
            <i className="io-skeleton io-skeleton-value" />
            <div className="io-donut io-skeleton-donut">
              <i className="io-skeleton io-skeleton-value" />
            </div>
            <i className="io-skeleton io-skeleton-value" />
          </div>
          <i className="io-skeleton io-skeleton-title" />
        </div>
      </div>
    </div>
  );
}

/** Presentation only: every count and quantity comes from the supplied report snapshot. */
export function IoHistoryOverview({
  rows,
  loading = false,
  stale = false,
  from,
  to,
}: OverviewProps) {
  const data = useMemo(() => {
    const counts: Record<IoDocType, number> = {
      INBOUND: 0,
      OUTBOUND: 0,
      REVERSAL: 0,
    };
    const quantities: Record<IoDocType, number> = {
      INBOUND: 0,
      OUTBOUND: 0,
      REVERSAL: 0,
    };
    const byDay = new Map<string, DayCount>();
    let unknown = 0;
    let net = 0;
    for (const row of rows) {
      counts[row.type] += 1;
      if (row.qty === null || !Number.isFinite(row.qty)) unknown += 1;
      else {
        quantities[row.type] +=
          row.type === "REVERSAL" ? row.qty : Math.abs(row.qty);
        net += row.qty;
      }
      const key = row.postedAt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !dayjs(key).isValid()) continue;
      const day = byDay.get(key) ?? {
        day: key,
        INBOUND: 0,
        OUTBOUND: 0,
        REVERSAL: 0,
      };
      day[row.type] += 1;
      byDay.set(key, day);
    }
    // Preserve the original reversal KPI: absolute value of the signed aggregate.
    quantities.REVERSAL = Math.abs(quantities.REVERSAL);
    const sortedDays = [...byDay.keys()].sort();
    const start = from && dayjs(from).isValid() ? from : sortedDays[0];
    const end = to && dayjs(to).isValid() ? to : sortedDays.at(-1);
    if (start && end) {
      const span = dayjs(end).diff(dayjs(start), "day");
      // Complete normal ranges; retain recorded days individually for longer ranges.
      if (span >= 0 && span <= 366)
        for (let index = 0; index <= span; index += 1) {
          const key = dayjs(start).add(index, "day").format("YYYY-MM-DD");
          if (!byDay.has(key))
            byDay.set(key, { day: key, INBOUND: 0, OUTBOUND: 0, REVERSAL: 0 });
        }
    }
    const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    const dayTotal = (day: DayCount) =>
      day.INBOUND + day.OUTBOUND + day.REVERSAL;
    const busiest = days.reduce<DayCount | undefined>(
      (best, day) => (!best || dayTotal(day) > dayTotal(best) ? day : best),
      undefined,
    );
    return {
      counts,
      quantities,
      days,
      unknown,
      net,
      busiest: busiest && dayTotal(busiest) > 0 ? busiest : undefined,
    };
  }, [rows, from, to]);
  if (loading) return <OverviewSkeleton />;
  const total = rows.length;
  const totalLabel = fmt(total);
  const donutNumberSize =
    totalLabel.length > 4 ? Math.max(10, 105 / totalLabel.length) : undefined;
  const hasReversals = data.counts.REVERSAL > 0;
  const activeSeries = hasReversals ? getSERIES() : getSERIES().slice(0, 2);
  const inPercent = total ? (data.counts.INBOUND / total) * 100 : 0;
  const outEnd = total
    ? ((data.counts.INBOUND + data.counts.OUTBOUND) / total) * 100
    : 0;
  const donutStyle = {
    background: total
      ? `conic-gradient(var(--io-in) 0% ${inPercent}%, var(--io-out) ${inPercent}% ${outEnd}%, var(--io-reversal) ${outEnd}% 100%)`
      : undefined,
  };
  return (
    <div className="io-overview">
      <section className="io-summary-grid" aria-label={tUi("dashboard.title")}>
        <article className="io-overview-card io-transfer-card">
          <span className="io-summary-icon">
            <OverviewIcon name="transfer" />
          </span>
          <div className="io-summary-heading">
            <h2>{tUi("updatedUi.text_97b7bfe0ab46")}</h2>
            <div className="io-summary-number">
              <strong>{fmt(total)}</strong>
              <div className="io-summary-unit">
                <span>{tUi("updatedUi.text_74e542e35044")}</span>
                {stale && (
                  <span className="io-stale-pill" role="status">
                    {tUi("updatedUi.text_5dfbcfbff4e7")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="io-transfer-distribution">
            <div
              className="io-proportion-bar"
              role="img"
              aria-label={activeSeries
                .map(
                  ({ type, label }) =>
                    `${label}: ${percentage(data.counts[type], total, true)}`,
                )
                .join(", ")}
            >
              {total > 0 &&
                activeSeries.map(
                  ({ type, tone }) =>
                    data.counts[type] > 0 && (
                      <span
                        key={type}
                        className={`is-${tone}`}
                        style={{
                          width: `${(data.counts[type] / total) * 100}%`,
                        }}
                      >
                        <b>{percentage(data.counts[type], total, true)}</b>
                      </span>
                    ),
                )}
            </div>
            <div
              className={`io-transfer-counts${hasReversals ? " has-reversals" : ""}`}
            >
              {activeSeries.map(({ type, label, tone }) => (
                <div key={type}>
                  <i className={`io-dot is-${tone}`} />
                  <span>{label}</span>
                  <strong>{fmt(data.counts[type])}</strong>
                  {total > 0 && (
                    <small>
                      · {percentage(data.counts[type], total, true)}
                    </small>
                  )}
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="io-overview-card io-product-card">
          <span className="io-summary-icon">
            <OverviewIcon name="box" />
          </span>
          <div className="io-product-content">
            <h2>{tUi("updatedUi.text_87e5b1b15d2e")}</h2>
            <div className="io-summary-number">
              <strong>
                {fmt(data.quantities.INBOUND + data.quantities.OUTBOUND)}
              </strong>
              <span>{tUi("updatedUi.text_9bfcaa70b19e")}</span>
            </div>
            <div className="io-product-breakdown">
              <div className="is-in">
                <i className="io-dot is-in" />
                <strong>{fmt(data.quantities.INBOUND)}</strong>
                <span>{tUi("updatedUi.text_25db5f984fd0")}</span>
              </div>
              <div className="is-out">
                <i className="io-dot is-out" />
                <strong>{fmt(data.quantities.OUTBOUND)}</strong>
                <span>{tUi("updatedUi.text_b18ef190f880")}</span>
              </div>
            </div>
          </div>
        </article>
        <div className="io-quantity-note">
          <span>
            {fmt(data.quantities.INBOUND)}
            {" " + tUi("updatedUi.text_c72370fb32ff")}
          </span>
          <span>
            {fmt(data.quantities.OUTBOUND)}
            {" " + tUi("updatedUi.text_20270a883e63")}
          </span>
          {hasReversals && (
            <span>
              {tUi("updatedUi.text_bf3a83ef8117") + " "}
              {fmt(data.counts.REVERSAL)}
              {" " + tUi("updatedUi.text_cf3bb0b1eb76")}{" "}
              <span>
                {fmt(data.quantities.REVERSAL)}
                {" " + tUi("updatedUi.text_a7d97a7b57de")}
              </span>
            </span>
          )}
          <span>
            {tUi("updatedUi.text_1123f48cf777") + " "}
            <strong>{signed(data.net)}</strong>
          </span>
          {data.unknown > 0 && (
            <span className="io-unknown-qty">
              {fmt(data.unknown)}
              {" " + tUi("updatedUi.text_2c06e2747b83")}
            </span>
          )}
        </div>
      </section>
      <div className="io-charts-grid">
        <section
          className="io-overview-card io-daily-card"
          aria-label={tUi("updatedUi.text_ffd2bf345883")}
        >
          <div className="io-chart-heading">
            <div>
              <h2>{tUi("updatedUi.text_ffd2bf345883")}</h2>
              <p>{tUi("updatedUi.text_9616f6954659")}</p>
            </div>
            <div className="io-chart-legend">
              {activeSeries.map(({ type, label, tone }) => (
                <span key={type}>
                  <i className={`io-dot is-${tone}`} />
                  {label}
                </span>
              ))}
            </div>
            <div className="io-chart-total">
              {tUi("reports.agencyComparison.colTotal") + " "}
              <strong>{fmt(total)}</strong>
            </div>
          </div>
          <DayChart
            days={data.days}
            hasReversals={hasReversals}
            total={total}
          />
        </section>
        <section
          className="io-overview-card io-rhythm-card"
          aria-label={tUi("updatedUi.text_9e761d69adf4")}
        >
          <div className="io-chart-heading">
            <div>
              <h2>{tUi("updatedUi.text_826a83f5533c")}</h2>
              <p>{tUi("updatedUi.text_f26323da8601")}</p>
            </div>
          </div>
          <div className="io-donut-row">
            <div className="io-donut-label is-in">
              <strong>{percentage(data.counts.INBOUND, total)}</strong>
              <span>{tUi("dashboard.snapshot.inbound")}</span>
              <b>{fmt(data.counts.INBOUND)}</b>
            </div>
            <div
              className="io-donut"
              style={donutStyle}
              role="img"
              aria-label={tUi("updatedUi.text_d14b53b16ada", {
                value0: String(fmt(total)),
                value1: String(
                  activeSeries
                    .map(
                      ({ type, label }) => `${label} ${fmt(data.counts[type])}`,
                    )
                    .join(", "),
                ),
              })}
            >
              <div className="io-donut-hole">
                <strong
                  style={{ fontSize: donutNumberSize }}
                  title={totalLabel}
                >
                  {totalLabel}
                </strong>
                <span>{tUi("updatedUi.text_74e542e35044")}</span>
              </div>
            </div>
            <div className="io-donut-label is-out">
              <strong>{percentage(data.counts.OUTBOUND, total)}</strong>
              <span>{tUi("dashboard.snapshot.outbound")}</span>
              <b>{fmt(data.counts.OUTBOUND)}</b>
            </div>
          </div>
          {hasReversals && (
            <div className="io-donut-reversal">
              <i className="io-dot is-reversal" />
              {tUi("iam.role.undo") + " "}
              <b>{fmt(data.counts.REVERSAL)}</b> ·{" "}
              {percentage(data.counts.REVERSAL, total)}
            </div>
          )}
          <div className="io-busiest-day">
            <span className="io-calendar-icon">
              <OverviewIcon name="calendar" />
            </span>
            <div className="io-busiest-date">
              <span>{tUi("updatedUi.text_887c1d5bc90f")}</span>
              <strong>
                {data.busiest
                  ? dayjs(data.busiest.day).format("DD/MM/YYYY")
                  : tUi("dashboard.lastUpdated.none")}
              </strong>
            </div>
            {data.busiest && (
              <div className="io-busiest-count">
                <strong>
                  {fmt(
                    data.busiest.INBOUND +
                      data.busiest.OUTBOUND +
                      data.busiest.REVERSAL,
                  )}{" "}
                  {tUi("updatedUi.text_74e542e35044")}
                </strong>
                <span>
                  {fmt(data.busiest.INBOUND)}
                  {" " + tUi("updatedUi.text_9b7b237db59a")}{" "}
                  {fmt(data.busiest.OUTBOUND)}
                  {" " + tUi("updatedUi.text_3b16ad526464")}
                  {data.busiest.REVERSAL > 0
                    ? " " +
                      tUi("updatedUi.text_8318b7b404da", {
                        value0: String(fmt(data.busiest.REVERSAL)),
                      })
                    : ""}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
