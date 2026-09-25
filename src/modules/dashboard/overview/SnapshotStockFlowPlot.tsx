import { Component, type KeyboardEvent } from "react";
import dayjs from "dayjs";
import { useT } from "@/shared/i18n/useT";
import { activeLocale } from "./overview-data";
import {
  axisY,
  snapshotPlotGeometry,
  stockFlowDays,
  type FlowInput,
  type StockInput,
} from "./snapshot-stock-flow-model";
import "./snapshot-stock-flow.css";

type PlotProps = { rows: readonly FlowInput[]; trend: readonly StockInput[] };
type PlotCopy = {
  inbound: string;
  outbound: string;
  stock: string;
  closing: string;
  legend: string;
  chart: string;
  variance: string;
  point: (date: string, inbound: string, outbound: string, stock: string) => string;
};
type CanvasProps = PlotProps & { copy: PlotCopy; locale: string };
type CanvasState = { width: number; hovered: string | null; scrollLeft: number };

/** Measures CSS pixels instead of stretching text and round markers in an SVG. */
export class StockFlowPlotCanvas extends Component<CanvasProps, CanvasState> {
  state: CanvasState = { width: 760, hovered: null, scrollLeft: 0 };
  private viewport: HTMLDivElement | null = null;
  private scroller: HTMLDivElement | null = null;
  private observer: ResizeObserver | null = null;
  private targets = new Map<string, SVGRectElement>();

  componentDidMount() {
    this.measure();
    if (typeof ResizeObserver !== "undefined" && this.viewport) {
      this.observer = new ResizeObserver(this.measure);
      this.observer.observe(this.viewport);
    } else {
      window.addEventListener("resize", this.measure);
    }
  }
  componentWillUnmount() {
    this.observer?.disconnect();
    window.removeEventListener("resize", this.measure);
  }
  private measure = () => {
    const width = this.viewport?.clientWidth ?? 0;
    // Keep-alive/display:none must not replace the last usable measurement.
    if (width > 0 && width !== this.state.width) this.setState({ width });
  };
  private focusDate = (index: number, dates: readonly string[]) => {
    const date = dates[Math.min(dates.length - 1, Math.max(0, index))];
    const target = this.targets.get(date);
    target?.focus?.({ preventScroll: true });
    if (date) this.setState({ hovered: date });
    if (!target || !this.scroller) return;
    const left = Number(target.getAttribute("x"));
    const right = left + Number(target.getAttribute("width"));
    if (left < this.scroller.scrollLeft) this.scroller.scrollLeft = left;
    else if (right > this.scroller.scrollLeft + this.scroller.clientWidth) {
      this.scroller.scrollLeft = right - this.scroller.clientWidth;
    }
  };
  private keyDown = (event: KeyboardEvent<SVGRectElement>, index: number, dates: readonly string[]) => {
    if (event.key === "Escape") {
      this.setState({ hovered: null });
      return;
    }
    const next = event.key === "ArrowLeft" ? index - 1
      : event.key === "ArrowRight" ? index + 1
        : event.key === "Home" ? 0
          : event.key === "End" ? dates.length - 1
            : event.key === "Enter" || event.key === " " ? index : null;
    if (next === null) return;
    event.preventDefault();
    this.focusDate(next, dates);
  };

  render() {
    const { rows, trend, copy, locale } = this.props;
    const days = stockFlowDays(rows, trend);
    const geometry = snapshotPlotGeometry(days, this.state.width);
    const { width, height, pad, plotHeight, step, barWidth, barGap,
      flowAxis, stockAxis, points, path, labelIndices, x } = geometry;
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    const format = (value: number | null) => value === null ? "—" : number.format(value);
    const shortDate = (value: string) => dayjs(value).format("DD/MM");
    const dates = days.map((day) => day.date);
    const hoveredIndex = dates.indexOf(this.state.hovered ?? "");
    const hovered = days[hoveredIndex];
    const hoveredPoint = points[hoveredIndex];
    const localX = hovered ? x(hoveredIndex) - this.state.scrollLeft : 0;
    const tooltipWidth = Math.max(160, Math.min(240, this.state.width - 16));
    const tooltipLeft = Math.max(8, Math.min(this.state.width - tooltipWidth - 8, localX - tooltipWidth / 2));
    const tooltipVisible = hovered && localX >= 0 && localX <= this.state.width;
    const zero = axisY(0, flowAxis, pad.top, plotHeight);
    const stockVisible = points.some((point) => point !== null);

    return (
      <div className="hn-stock-flow">
        <div className="hn-stock-flow__legend" aria-label={copy.legend}>
          <span><i className="hn-stock-flow__in" />{copy.inbound}</span>
          <span><i className="hn-stock-flow__out" />{copy.outbound}</span>
          <span><i className="hn-stock-flow__stock" />{copy.stock}</span>
        </div>
        <div className="hn-stock-flow__viewport" ref={(node) => { this.viewport = node; }}>
          <div className="hn-stock-flow__scroll" ref={(node) => { this.scroller = node; }}
            onScroll={(event) => this.setState({ scrollLeft: event.currentTarget.scrollLeft })}>
            <svg className="hn-stock-flow__svg" width={width} height={height}
              style={{ width, height }} viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMinYMin meet" role="img" aria-label={copy.chart}>
              <text className="hn-stock-flow__axis-title" x={8} y={16}>
                {copy.inbound} / {copy.outbound} ←
              </text>
              <text className="hn-stock-flow__axis-title hn-stock-flow__axis-title--stock"
                x={width - 8} y={16} textAnchor="end">→ {copy.closing}</text>
              {flowAxis.ticks.map((value) => {
                const y = axisY(value, flowAxis, pad.top, plotHeight);
                return <g key={value}>
                  <line className="hn-stock-flow__grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
                  <text className="hn-stock-flow__tick" data-axis="flow" x={pad.left - 10} y={y + 4} textAnchor="end">{format(value)}</text>
                </g>;
              })}
              {stockVisible ? stockAxis.ticks.map((value) => {
                const y = axisY(value, stockAxis, pad.top, plotHeight);
                return <g key={value}>
                  <line className="hn-stock-flow__right-tick" x1={width - pad.right} x2={width - pad.right + 5} y1={y} y2={y} />
                  <text className="hn-stock-flow__tick hn-stock-flow__tick--stock" data-axis="stock"
                    x={width - pad.right + 10} y={y + 4}>{format(value)}</text>
                </g>;
              }) : null}
              {days.map((day, index) => {
                const center = x(index);
                const bar = (value: number | null, outbound: boolean) => {
                  if (value === null) return null;
                  const y = axisY(value, flowAxis, pad.top, plotHeight);
                  return <rect className={outbound ? "hn-stock-flow__bar is-out" : "hn-stock-flow__bar"}
                    data-flow={outbound ? "outbound" : "inbound"} data-date={day.date}
                    x={outbound ? center + barGap / 2 : center - barWidth - barGap / 2}
                    y={Math.min(zero, y)} width={barWidth} height={Math.abs(zero - y)} rx={2} />;
                };
                return <g key={day.date}>
                  {bar(day.inbound, false)}{bar(day.outbound, true)}
                  {labelIndices.has(index) ? <text className="hn-stock-flow__tick" data-axis="date"
                    x={center} y={height - 12} textAnchor="middle">{shortDate(day.date)}</text> : null}
                </g>;
              })}
              <path className="hn-stock-flow__line" d={path} />
              {points.map((point, index) => point === null ? null : (
                <circle className="hn-stock-flow__point" data-date={days[index].date}
                  key={days[index].date} cx={point.x} cy={point.y} r={days.length > 45 ? 2 : 3} />
              ))}
              {/* Hit targets are last so the inventory line cannot steal hover/focus. */}
              {days.map((day, index) => <rect key={day.date}
                ref={(node) => { if (node) this.targets.set(day.date, node); else this.targets.delete(day.date); }}
                className="hn-stock-flow__target" data-date={day.date}
                x={pad.left + step * index} y={pad.top} width={step} height={plotHeight}
                tabIndex={0} role="button"
                aria-label={copy.point(shortDate(day.date), format(day.inbound), format(day.outbound), format(day.closing))}
                onMouseEnter={() => this.setState({ hovered: day.date })}
                onMouseLeave={() => this.setState({ hovered: null })}
                onFocus={() => this.setState({ hovered: day.date })}
                onBlur={() => this.setState({ hovered: null })}
                onPointerDown={() => this.setState({ hovered: day.date })}
                onKeyDown={(event) => this.keyDown(event, index, dates)} />)}
            </svg>
          </div>
          {tooltipVisible ? <div className="hn-stock-flow__tooltip" role="status"
            style={{ width: tooltipWidth, left: tooltipLeft,
              top: hoveredPoint && hoveredPoint.y > height / 2 ? 34 : height - 174 }}>
            <strong>{dayjs(hovered.date).format("DD/MM/YYYY")}</strong>
            <span>{copy.inbound}<b>{format(hovered.inbound)}</b></span>
            <span>{copy.outbound}<b>{format(hovered.outbound)}</b></span>
            <span className="hn-stock-flow__tooltip-stock">{copy.closing}<b>{format(hovered.closing)}</b></span>
            {hovered.change !== null ? <small>
              Δ {copy.variance} ({shortDate(dates[hoveredIndex - 1])} → {shortDate(hovered.date)})
              <b>{hovered.change > 0 ? "+" : ""}{format(hovered.change)}</b>
            </small> : null}
          </div> : null}
        </div>
      </div>
    );
  }
}

export function SnapshotStockFlowPlot(props: PlotProps) {
  const t = useT();
  return <StockFlowPlotCanvas {...props} locale={activeLocale()} copy={{
    inbound: t("dashboard.snapshot.inbound"),
    outbound: t("dashboard.snapshot.outbound"),
    stock: t("dashboard.snapshot.stock"),
    closing: t("dashboard.snapshot.closingStock"),
    legend: t("dashboard.snapshot.chartLegendAria"),
    chart: t("dashboard.snapshot.chartAria"),
    variance: t("inventory.balance.colVariance"),
    point: (date, inbound, outbound, stock) => t("dashboard.snapshot.chartPointAria", { date, inbound, outbound, stock }),
  }} />;
}
