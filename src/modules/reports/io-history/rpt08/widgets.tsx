import { type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  CloseOutlined,
  HistoryOutlined,
  InboxOutlined,
  SearchOutlined,
  StockOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from "@/shared/components/icons";
import type { AppliedFilters, DailyMovement, HistoryRow } from "./model";
import {
  PAGE_SIZE,
  compactRange,
  displayDay,
  displayStamp,
  number,
  percent,
} from "./model";
import { tStatic as tUi } from "@/shared/i18n/useT";

export function OverviewCard({
  total,
  inbound,
  outbound,
  stale,
}: {
  total: number;
  inbound: number;
  outbound: number;
  stale: boolean;
}) {
  const inboundRate = total ? (inbound / total) * 100 : 0;
  const outboundRate = total ? (outbound / total) * 100 : 0;

  return (
    <section
      className="rpt08-card rpt08-overview-card"
      aria-label={tUi("updatedUi.text_97b7bfe0ab46")}
    >
      <div className="rpt08-metric-icon rpt08-metric-icon--swap">
        <ArrowLeftOutlined />
        <ArrowRightOutlined />
      </div>
      <div className="rpt08-overview-card__total">
        <h2>{tUi("updatedUi.text_97b7bfe0ab46")}</h2>
        <div className="rpt08-big-number">{number(total)}</div>
        <div className="rpt08-unit-row">
          <span>{tUi("updatedUi.text_74e542e35044")}</span>
          {stale ? <small>{tUi("updatedUi.text_5dfbcfbff4e7")}</small> : null}
        </div>
      </div>
      <div className="rpt08-overview-card__split">
        <div className={"rpt08-ratio-bar" + (total === 0 ? " is-empty" : "")}>
          {total === 0 ? (
            <span className="rpt08-ratio-empty" />
          ) : (
            <>
              <span style={{ width: `${inboundRate}%` }}>
                {percent(inboundRate)}
              </span>
              <span style={{ width: `${outboundRate}%` }}>
                {percent(outboundRate)}
              </span>
            </>
          )}
        </div>
        <div className="rpt08-overview-breakdown">
          <div>
            <i className="is-inbound" />
            <span>
              {tUi("dashboard.snapshot.inbound") + " "}
              <strong>{number(inbound)}</strong>
              {total ? <small> · {percent(inboundRate)}</small> : null}
            </span>
          </div>
          <div>
            <i className="is-outbound" />
            <span>
              {tUi("dashboard.snapshot.outbound") + " "}
              <strong>{number(outbound)}</strong>
              {total ? <small> · {percent(outboundRate)}</small> : null}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProductCard({
  total,
  inbound,
  outbound,
}: {
  total: number | null;
  inbound: number | null;
  outbound: number | null;
}) {
  return (
    <section
      className="rpt08-card rpt08-product-card"
      aria-label={tUi("updatedUi.text_87e5b1b15d2e")}
    >
      <div className="rpt08-metric-icon">
        <StockOutlined />
      </div>
      <div className="rpt08-product-card__body">
        <h2>{tUi("updatedUi.text_87e5b1b15d2e")}</h2>
        <div className="rpt08-product-total">
          <strong>{total === null ? "—" : number(total)}</strong>
          <span>{tUi("updatedUi.text_9bfcaa70b19e")}</span>
        </div>
        <div className="rpt08-product-breakdown">
          <span>
            <i className="is-inbound" />
            <strong>{inbound === null ? "—" : number(inbound)}</strong>
            {" " + tUi("updatedUi.text_22652147af7d")}
          </span>
          <span>
            <i className="is-outbound" />
            <strong>{outbound === null ? "—" : number(outbound)}</strong>
            {" " + tUi("updatedUi.text_4f12e82f09c9")}
          </span>
        </div>
      </div>
    </section>
  );
}

export function DailyChart({
  daily,
  total,
}: {
  daily: ReadonlyArray<DailyMovement>;
  total: number;
}) {
  const observedMax = Math.max(
    0,
    ...daily.flatMap((day) => [day.inbound, day.outbound]),
  );
  const max = Math.max(60, Math.ceil(observedMax / 10) * 10);
  const ticks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];
  const empty = total === 0;

  return (
    <section
      className="rpt08-card rpt08-chart-card"
      aria-labelledby="rpt08-daily-title"
    >
      <div className="rpt08-panel-heading">
        <div>
          <h2 id="rpt08-daily-title">{tUi("updatedUi.text_ffd2bf345883")}</h2>
          <span>{tUi("updatedUi.text_9616f6954659")}</span>
          <small>
            {tUi("reports.agencyComparison.colTotal") + " "}
            <strong>{number(total)}</strong>
            {" " + tUi("updatedUi.text_74e542e35044")}
          </small>
        </div>
        <div
          className="rpt08-chart-legend"
          aria-label={tUi("dashboard.snapshot.chartLegendAria")}
        >
          <span>
            <i className="is-inbound" />
            {" " + tUi("dashboard.snapshot.inbound")}
          </span>
          <span>
            <i className="is-outbound" />
            {" " + tUi("dashboard.snapshot.outbound")}
          </span>
          <span className="rpt08-chart-total">
            {tUi("reports.agencyComparison.colTotal") + " "}
            <strong>{number(total)}</strong>
          </span>
        </div>
      </div>

      <div
        className={"rpt08-bar-chart" + (empty ? " is-empty" : "")}
        role="img"
        aria-label={tUi("updatedUi.text_5c969326149f")}
      >
        <div className="rpt08-y-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="rpt08-plot">
          <div className="rpt08-grid-lines" aria-hidden="true">
            {ticks.map((tick) => (
              <i key={tick} />
            ))}
          </div>
          {empty ? (
            <div className="rpt08-chart-empty">
              <InboxOutlined />
              <span>{tUi("dashboard.flow.emptyTitle")}</span>
            </div>
          ) : null}
          <div className="rpt08-bar-groups" aria-hidden="true">
            {daily.map((day) => (
              <div className="rpt08-bar-group" key={day.key}>
                <div className="rpt08-bars">
                  <span
                    className="is-inbound"
                    style={
                      {
                        "--rpt08-bar-height": `${(day.inbound / max) * 100}%`,
                      } as CSSProperties
                    }
                  >
                    <b>{day.inbound}</b>
                  </span>
                  <span
                    className="is-outbound"
                    style={
                      {
                        "--rpt08-bar-height": `${(day.outbound / max) * 100}%`,
                      } as CSSProperties
                    }
                  >
                    <b>{day.outbound}</b>
                  </span>
                </div>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ActivityCard({
  total,
  inbound,
  outbound,
  peak,
}: {
  total: number;
  inbound: number;
  outbound: number;
  peak: DailyMovement | null;
}) {
  const inboundRate = total ? (inbound / total) * 100 : 0;
  const outboundRate = total ? (outbound / total) * 100 : 0;
  const donutStyle = total
    ? ({ "--rpt08-inbound-rate": `${inboundRate}%` } as CSSProperties)
    : undefined;

  return (
    <section
      className="rpt08-card rpt08-activity-card"
      aria-labelledby="rpt08-activity-title"
    >
      <div className="rpt08-panel-heading">
        <div>
          <h2 id="rpt08-activity-title">
            {tUi("updatedUi.text_826a83f5533c")}
          </h2>
          <span>{tUi("updatedUi.text_f26323da8601")}</span>
        </div>
      </div>

      <div className="rpt08-donut-layout">
        <div className="rpt08-donut-side is-left">
          <strong>{total ? `${Math.round(inboundRate)}%` : "—"}</strong>
          <span>{tUi("dashboard.snapshot.inbound")}</span>
          <b>{number(inbound)}</b>
        </div>
        <div
          className={"rpt08-donut" + (total === 0 ? " is-empty" : "")}
          style={donutStyle}
        >
          <div>
            <strong>{number(total)}</strong>
            <span>{tUi("updatedUi.text_74e542e35044")}</span>
          </div>
        </div>
        <div className="rpt08-donut-side is-right">
          <strong>{total ? `${Math.round(outboundRate)}%` : "—"}</strong>
          <span>{tUi("dashboard.snapshot.outbound")}</span>
          <b>{number(outbound)}</b>
        </div>
      </div>

      <div className="rpt08-peak">
        <span className="rpt08-peak__icon">
          <HistoryOutlined />
        </span>
        {peak ? (
          <>
            <div>
              <span>{tUi("updatedUi.text_887c1d5bc90f")}</span>
              <strong>{displayDay(peak.key)}</strong>
            </div>
            <div className="rpt08-peak__value">
              <strong>
                {number(peak.inbound + peak.outbound)}
                {" " + tUi("updatedUi.text_74e542e35044")}
              </strong>
              <span>
                {number(peak.inbound)}
                {" " + tUi("updatedUi.text_9b7b237db59a") + " "}
                {number(peak.outbound)}
                {" " + tUi("updatedUi.text_3b16ad526464")}
              </span>
            </div>
          </>
        ) : (
          <div>
            <span>{tUi("updatedUi.text_887c1d5bc90f")}</span>
            <strong>{tUi("dashboard.lastUpdated.none")}</strong>
          </div>
        )}
      </div>
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const candidates = new Set<number>([
    1,
    2,
    3,
    page - 1,
    page,
    page + 1,
    totalPages,
  ]);
  const pages = [...candidates]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);
  const nodes: ReactNode[] = [];
  let previous = 0;

  for (const value of pages) {
    if (previous > 0 && value - previous > 1) {
      nodes.push(
        <span key={`gap-${previous}`} className="rpt08-page-gap">
          …
        </span>,
      );
    }
    nodes.push(
      <button
        key={value}
        type="button"
        className={value === page ? "is-active" : ""}
        aria-current={value === page ? "page" : undefined}
        onClick={() => onChange(value)}
      >
        {value}
      </button>,
    );
    previous = value;
  }

  return (
    <nav
      className="rpt08-pagination hn-report-pagination"
      aria-label={tUi("shared.table.pagination")}
    >
      <button
        type="button"
        data-page-direction="previous"
        aria-label={tUi("reports.traceability.previousPage")}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ‹
      </button>
      {nodes}
      <button
        type="button"
        data-page-direction="next"
        aria-label={tUi("updatedUi.text_8cac33aab67d")}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        ›
      </button>
    </nav>
  );
}

export function TypePill({ type }: { type: HistoryRow["type"] }) {
  const inbound = type === "INBOUND";
  return (
    <span className={`rpt08-type-pill is-${inbound ? "inbound" : "outbound"}`}>
      <span className="rpt08-type-arrow" aria-hidden="true">
        {inbound ? "↓" : "↑"}
      </span>
      {inbound
        ? tUi("dashboard.snapshot.inbound")
        : tUi("dashboard.snapshot.outbound")}
    </span>
  );
}

function EmptyTable({ onAdjustRange }: { onAdjustRange: () => void }) {
  return (
    <div className="rpt08-table-empty">
      <InboxOutlined />
      <strong>{tUi("updatedUi.text_1a2145e7a31f")}</strong>
      <span>{tUi("updatedUi.text_0e0faea6497b")}</span>
      <button type="button" onClick={onAdjustRange}>
        {tUi("updatedUi.text_02810d9b92b9")}
      </button>
    </div>
  );
}

function NoResultTable({ onClear }: { onClear: () => void }) {
  return (
    <div className="rpt08-table-empty is-search">
      <strong>{tUi("updatedUi.text_8a4f82f9ad45")}</strong>
      <span>{tUi("updatedUi.text_f2f5565d0c2b")}</span>
      <button type="button" onClick={onClear}>
        {tUi("updatedUi.text_816c89e8e46b")}
      </button>
    </div>
  );
}

export function HistoryTable({
  rows,
  total,
  search,
  page,
  empty,
  noResult,
  range,
  onSearch,
  onPageChange,
  onOpenRow,
  onAdjustRange,
}: {
  rows: HistoryRow[];
  total: number;
  search: string;
  page: number;
  empty: boolean;
  noResult: boolean;
  range: AppliedFilters;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onOpenRow: (row: HistoryRow) => void;
  onAdjustRange: () => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <section
      className="rpt08-card rpt08-table-card"
      aria-labelledby="rpt08-table-title"
    >
      <div className="rpt08-table-heading">
        <h2 id="rpt08-table-title">
          {tUi("updatedUi.text_8814615e6de0")}
          <span>
            {noResult ? tUi("updatedUi.text_da0384630020") : number(total)}
          </span>
        </h2>
        <label className="rpt08-search-box">
          <SearchOutlined />
          <span className="rpt08-sr-only">
            {tUi("updatedUi.text_71ea46acf0d2")}
          </span>
          <input
            value={search}
            placeholder={tUi("updatedUi.text_863fd52b84b2")}
            onChange={(event) => onSearch(event.target.value)}
          />
          {search ? (
            <button
              type="button"
              aria-label={tUi("updatedUi.text_431466c48cf0")}
              onClick={() => onSearch("")}
            >
              <CloseOutlined />
            </button>
          ) : null}
        </label>
      </div>

      <div className="rpt08-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="rpt08-time-col">
                <span className="rpt08-desktop-label">
                  {tUi("inventory.movement.colTime")}
                </span>
                <span className="rpt08-tablet-label">
                  {tUi("updatedUi.text_5a3a1b69c2b3")}
                </span>
              </th>
              <th>{tUi("inventory.detail.colType")}</th>
              <th className="rpt08-code-col">
                {tUi("warranty.componentList.colCode")}
              </th>
              <th>{tUi("audit.colObject")}</th>
              <th className="is-number">
                {tUi("dashboard.stockMix.colQuantity")}
              </th>
              <th>{tUi("inventory.trace.colPerformedBy")}</th>
              <th>{tUi("reports.importMatchReport.detail")}</th>
            </tr>
          </thead>
          <tbody>
            {!empty && !noResult
              ? rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onDoubleClick={() => onOpenRow(row)}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenRow(row);
                      }
                    }}
                  >
                    <td className="rpt08-time-cell">
                      <span>{displayStamp(row.timestamp)}</span>
                      <strong className="rpt08-mobile-code">
                        {row.documentNo}
                      </strong>
                    </td>
                    <td>
                      <TypePill type={row.type} />
                    </td>
                    <td className="rpt08-code-cell">
                      <strong>{row.documentNo}</strong>
                    </td>
                    <td className="rpt08-object-cell">
                      <span>{row.objectPrimary}</span>
                      <small> · {row.objectSecondary}</small>
                    </td>
                    <td className="is-number">
                      {row.quantity === null ? "—" : number(row.quantity)}
                    </td>
                    <td>{row.actor}</td>
                    <td>
                      <button
                        type="button"
                        className="rpt08-view-button"
                        onClick={() => onOpenRow(row)}
                      >
                        {tUi("reports.ioHistory.view")}{" "}
                        <span aria-hidden="true">›</span>
                      </button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {empty ? <EmptyTable onAdjustRange={onAdjustRange} /> : null}
      {noResult ? <NoResultTable onClear={() => onSearch("")} /> : null}

      {!empty && !noResult ? (
        <footer className="rpt08-table-footer hn-report-pagination-footer">
          <span>
            {tUi("putaway.queue.showing") + " "}
            {start}–{end} / {number(total)}
            {" " + tUi("updatedUi.text_74e542e35044")}
          </span>
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={onPageChange}
          />
          <span>
            {tUi("updatedUi.text_098cc1b3c5b9")} ·{" "}
            {compactRange(range.from, range.to)}
          </span>
        </footer>
      ) : null}
    </section>
  );
}
