/** Geometry only. Closing balances come from the API, never from a guessed opening. */
export type FlowInput = {
  date: string;
  inbound: number;
  product: number;
  component: number;
};
export type StockInput = { date: string; closing: number };
export type StockFlowDay = {
  date: string;
  inbound: number | null;
  outbound: number | null;
  closing: number | null;
  change: number | null;
};
export type PlotAxis = { min: number; max: number; ticks: number[] };
export type PlotPoint = { x: number; y: number };
const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function consecutiveDays(previous: string, next: string): boolean {
  return Date.parse(`${next}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === 86400000;
}

export function stockFlowDays(
  flows: readonly FlowInput[],
  stocks: readonly StockInput[],
): StockFlowDay[] {
  const flowByDate = new Map(flows.map((row) => [row.date, row]));
  const stockByDate = new Map(stocks.map((row) => [row.date, row]));
  const dates = [...new Set([...flowByDate.keys(), ...stockByDate.keys()])].sort();
  return dates.map((date, index) => {
    const flow = flowByDate.get(date);
    const product = finite(flow?.product);
    const component = finite(flow?.component);
    const closing = finite(stockByDate.get(date)?.closing);
    const previousDate = dates[index - 1];
    const previous = previousDate ? finite(stockByDate.get(previousDate)?.closing) : null;
    return {
      date,
      inbound: finite(flow?.inbound),
      outbound: product !== null && component !== null ? product + component : null,
      closing,
      change: closing !== null && previous !== null && consecutiveDays(previousDate, date)
        ? closing - previous : null,
    };
  });
}

/** Zero stays visible. Add real scale headroom, not a clamp or a fabricated trend. */
export function plotAxis(values: readonly (number | null)[]): PlotAxis {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const low = Math.min(0, ...valid);
  const high = Math.max(0, ...valid);
  const roundUp = (value: number): number => {
    if (value <= 0) return 0;
    const power = 10 ** Math.floor(Math.log10(value));
    const ratio = value / power;
    const multiple = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((step) => step >= ratio) ?? 10;
    return multiple * power;
  };
  const min = low < 0 ? -roundUp(-low * 1.08) : 0;
  const max = high > 0 ? roundUp(high * 1.08) : low < 0 ? 0 : 1;
  const ticks = Array.from({ length: 5 }, (_, index) =>
    Number((min + ((max - min) * index) / 4).toPrecision(12)),
  );
  if (!ticks.includes(0)) ticks.push(0);
  ticks.sort((left, right) => left - right);
  return { min, max, ticks };
}

export function axisY(value: number, axis: PlotAxis, top: number, height: number): number {
  return top + height - ((value - axis.min) / (axis.max - axis.min)) * height;
}

/** Screen-width labels, not a fixed count stretched over a 760-unit viewBox. */
export function visibleDateLabels(count: number, plotWidth: number): Set<number> {
  if (count < 1) return new Set();
  const step = plotWidth / count;
  const stride = Math.max(1, Math.ceil(62 / step));
  const visible = new Set([0, count - 1]);
  for (let index = stride; index < count - stride; index += stride) visible.add(index);
  return visible;
}

export function stockPath(days: readonly StockFlowDay[], points: readonly (PlotPoint | null)[]): string {
  return points.map((point, index) => {
    if (point === null) return "";
    const connected = index > 0 && points[index - 1] !== null &&
      consecutiveDays(days[index - 1].date, days[index].date);
    return `${connected ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ");
}

export function snapshotPlotGeometry(days: readonly StockFlowDay[], availableWidth: number) {
  const flowAxis = plotAxis(days.flatMap((day) => [day.inbound, day.outbound]));
  const stockAxis = plotAxis(days.map((day) => day.closing));
  const viewport = Math.max(240, Number.isFinite(availableWidth) ? availableWidth : 760);
  const height = viewport < 600 ? 300 : 320;
  const pad = { left: 76, right: 86, top: 34, bottom: 34 };
  // At most a local horizontal scroll on narrow/long ranges; never squeeze bars or glyphs.
  const width = Math.max(viewport, pad.left + pad.right + days.length * 18);
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const step = plotWidth / Math.max(days.length, 1);
  const barWidth = Math.min(18, step * 0.28);
  const barGap = Math.min(4, step * 0.12);
  const x = (index: number) => pad.left + step * (index + 0.5);
  const points = days.map((day, index) => day.closing === null ? null : ({
    x: x(index), y: axisY(day.closing, stockAxis, pad.top, plotHeight),
  }));
  return {
    width, height, pad, plotWidth, plotHeight, step, barWidth, barGap,
    flowAxis, stockAxis, points, path: stockPath(days, points),
    labelIndices: visibleDateLabels(days.length, plotWidth), x,
  };
}
