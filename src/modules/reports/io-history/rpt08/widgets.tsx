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
import { PAGE_SIZE, compactRange, displayDay, displayStamp, number, percent } from "./model";

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
    <section className="rpt08-card rpt08-overview-card" aria-label="Tổng quan luân chuyển">
      <div className="rpt08-metric-icon rpt08-metric-icon--swap">
        <ArrowLeftOutlined />
        <ArrowRightOutlined />
      </div>
      <div className="rpt08-overview-card__total">
        <h2>Tổng quan luân chuyển</h2>
        <div className="rpt08-big-number">{number(total)}</div>
        <div className="rpt08-unit-row">
          <span>giao dịch</span>
          {stale ? <small>Dữ liệu gần nhất</small> : null}
        </div>
      </div>
      <div className="rpt08-overview-card__split">
        <div className={"rpt08-ratio-bar" + (total === 0 ? " is-empty" : "")}>
          {total === 0 ? (
            <span className="rpt08-ratio-empty" />
          ) : (
            <>
              <span style={{ width: `${inboundRate}%` }}>{percent(inboundRate)}</span>
              <span style={{ width: `${outboundRate}%` }}>{percent(outboundRate)}</span>
            </>
          )}
        </div>
        <div className="rpt08-overview-breakdown">
          <div>
            <i className="is-inbound" />
            <span>
              Nhập kho <strong>{number(inbound)}</strong>
              {total ? <small> · {percent(inboundRate)}</small> : null}
            </span>
          </div>
          <div>
            <i className="is-outbound" />
            <span>
              Xuất kho <strong>{number(outbound)}</strong>
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
  total: number;
  inbound: number;
  outbound: number;
}) {
  return (
    <section className="rpt08-card rpt08-product-card" aria-label="Sản phẩm luân chuyển">
      <div className="rpt08-metric-icon">
        <StockOutlined />
      </div>
      <div className="rpt08-product-card__body">
        <h2>Sản phẩm luân chuyển</h2>
        <div className="rpt08-product-total">
          <strong>{number(total)}</strong>
          <span>sản phẩm</span>
        </div>
        <div className="rpt08-product-breakdown">
          <span>
            <i className="is-inbound" />
            <strong>{number(inbound)}</strong> sản phẩm nhập
          </span>
          <span>
            <i className="is-outbound" />
            <strong>{number(outbound)}</strong> sản phẩm xuất
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
    <section className="rpt08-card rpt08-chart-card" aria-labelledby="rpt08-daily-title">
      <div className="rpt08-panel-heading">
        <div>
          <h2 id="rpt08-daily-title">Nhập - xuất theo ngày</h2>
          <span>Số giao dịch</span>
          <small>
            Tổng <strong>{number(total)}</strong> giao dịch
          </small>
        </div>
        <div className="rpt08-chart-legend" aria-label="Chú giải biểu đồ">
          <span><i className="is-inbound" /> Nhập kho</span>
          <span><i className="is-outbound" /> Xuất kho</span>
          <span className="rpt08-chart-total">Tổng <strong>{number(total)}</strong></span>
        </div>
      </div>

      <div
        className={"rpt08-bar-chart" + (empty ? " is-empty" : "")}
        role="img"
        aria-label="Biểu đồ số giao dịch nhập và xuất theo ngày"
      >
        <div className="rpt08-y-axis" aria-hidden="true">
          {ticks.map((tick) => <span key={tick}>{tick}</span>)}
        </div>
        <div className="rpt08-plot">
          <div className="rpt08-grid-lines" aria-hidden="true">
            {ticks.map((tick) => <i key={tick} />)}
          </div>
          {empty ? (
            <div className="rpt08-chart-empty">
              <InboxOutlined />
              <span>Chưa có giao dịch</span>
            </div>
          ) : null}
          <div className="rpt08-bar-groups" aria-hidden="true">
            {daily.map((day) => (
              <div className="rpt08-bar-group" key={day.key}>
                <div className="rpt08-bars">
                  <span
                    className="is-inbound"
                    style={{ "--rpt08-bar-height": `${(day.inbound / max) * 100}%` } as CSSProperties}
                  >
                    <b>{day.inbound}</b>
                  </span>
                  <span
                    className="is-outbound"
                    style={{ "--rpt08-bar-height": `${(day.outbound / max) * 100}%` } as CSSProperties}
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
    <section className="rpt08-card rpt08-activity-card" aria-labelledby="rpt08-activity-title">
      <div className="rpt08-panel-heading">
        <div>
          <h2 id="rpt08-activity-title">Cơ cấu &amp; nhịp hoạt động</h2>
          <span>Tỷ lệ giao dịch</span>
        </div>
      </div>

      <div className="rpt08-donut-layout">
        <div className="rpt08-donut-side is-left">
          <strong>{total ? `${Math.round(inboundRate)}%` : "—"}</strong>
          <span>Nhập kho</span>
          <b>{number(inbound)}</b>
        </div>
        <div className={"rpt08-donut" + (total === 0 ? " is-empty" : "")} style={donutStyle}>
          <div>
            <strong>{number(total)}</strong>
            <span>giao dịch</span>
          </div>
        </div>
        <div className="rpt08-donut-side is-right">
          <strong>{total ? `${Math.round(outboundRate)}%` : "—"}</strong>
          <span>Xuất kho</span>
          <b>{number(outbound)}</b>
        </div>
      </div>

      <div className="rpt08-peak">
        <span className="rpt08-peak__icon"><HistoryOutlined /></span>
        {peak ? (
          <>
            <div>
              <span>Ngày hoạt động cao nhất</span>
              <strong>{displayDay(peak.key)}</strong>
            </div>
            <div className="rpt08-peak__value">
              <strong>{number(peak.inbound + peak.outbound)} giao dịch</strong>
              <span>{number(peak.inbound)} nhập · {number(peak.outbound)} xuất</span>
            </div>
          </>
        ) : (
          <div>
            <span>Ngày hoạt động cao nhất</span>
            <strong>Chưa có dữ liệu</strong>
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
  const candidates = new Set<number>([1, 2, 3, page - 1, page, page + 1, totalPages]);
  const pages = [...candidates]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);
  const nodes: ReactNode[] = [];
  let previous = 0;

  for (const value of pages) {
    if (previous > 0 && value - previous > 1) {
      nodes.push(<span key={`gap-${previous}`} className="rpt08-page-gap">…</span>);
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

  return <nav className="rpt08-pagination" aria-label="Phân trang">{nodes}</nav>;
}

export function TypePill({ type }: { type: HistoryRow["type"] }) {
  const inbound = type === "INBOUND";
  return (
    <span className={`rpt08-type-pill is-${inbound ? "inbound" : "outbound"}`}>
      <span className="rpt08-type-arrow" aria-hidden="true">{inbound ? "↓" : "↑"}</span>
      {inbound ? "Nhập kho" : "Xuất kho"}
    </span>
  );
}

function EmptyTable({ onAdjustRange }: { onAdjustRange: () => void }) {
  return (
    <div className="rpt08-table-empty">
      <InboxOutlined />
      <strong>Chưa có giao dịch nhập - xuất</strong>
      <span>Hãy chọn khoảng thời gian khác để xem dữ liệu.</span>
      <button type="button" onClick={onAdjustRange}>Điều chỉnh khoảng thời gian</button>
    </div>
  );
}

function NoResultTable({ onClear }: { onClear: () => void }) {
  return (
    <div className="rpt08-table-empty is-search">
      <strong>Không tìm thấy kết quả</strong>
      <span>Không có giao dịch nào khớp với từ khóa đã nhập.</span>
      <button type="button" onClick={onClear}>Xóa tìm kiếm</button>
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
  demo,
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
  demo: boolean;
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
    <section className="rpt08-card rpt08-table-card" aria-labelledby="rpt08-table-title">
      <div className="rpt08-table-heading">
        <h2 id="rpt08-table-title">
          Lịch sử nhập - xuất kho
          <span>{noResult ? "0 kết quả" : number(total)}</span>
        </h2>
        <label className="rpt08-search-box">
          <SearchOutlined />
          <span className="rpt08-sr-only">Tìm kiếm giao dịch</span>
          <input
            value={search}
            placeholder="Mã phiếu, SKU, Serial, Lô, Pallet..."
            onChange={(event) => onSearch(event.target.value)}
          />
          {search ? (
            <button type="button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => onSearch("")}>
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
                <span className="rpt08-desktop-label">Thời gian</span>
                <span className="rpt08-tablet-label">Thời gian / Mã phiếu</span>
              </th>
              <th>Loại</th>
              <th className="rpt08-code-col">Mã phiếu</th>
              <th>Đối tượng</th>
              <th className="is-number">Số lượng</th>
              <th>Người thực hiện</th>
              <th>Chi tiết</th>
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
                      <strong className="rpt08-mobile-code">{row.documentNo}</strong>
                    </td>
                    <td><TypePill type={row.type} /></td>
                    <td className="rpt08-code-cell"><strong>{row.documentNo}</strong></td>
                    <td className="rpt08-object-cell">
                      <span>{row.objectPrimary}</span>
                      <small> · {row.objectSecondary}</small>
                    </td>
                    <td className="is-number">{number(row.quantity)}</td>
                    <td>{row.actor}</td>
                    <td>
                      <button
                        type="button"
                        className="rpt08-view-button"
                        onClick={() => onOpenRow(row)}
                      >
                        Xem <span aria-hidden="true">›</span>
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
        <footer className="rpt08-table-footer">
          <span>Hiển thị {start}–{end} / {number(total)} giao dịch</span>
          <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
          <span>{demo ? "Dữ liệu minh họa" : "Dữ liệu hệ thống"} · {compactRange(range.from, range.to)}</span>
        </footer>
      ) : null}
    </section>
  );
}
