import { it } from "vitest";
import assert from "node:assert/strict";
import { axisY, consecutiveDays, plotAxis, snapshotPlotGeometry, stockFlowDays,
  visibleDateLabels, type FlowInput, type StockInput } from "./snapshot-stock-flow-model";

const flow = (date: string, inbound = 0, product = 0, component = 0): FlowInput => ({ date, inbound, product, component });
const stock = (date: string, closing: number): StockInput => ({ date, closing });
const days = (closing: number[]) => stockFlowDays(
  closing.map((_, i) => flow(`2026-09-${String(i + 1).padStart(2, "0")}`, 10, 5)),
  closing.map((value, i) => stock(`2026-09-${String(i + 1).padStart(2, "0")}`, value)),
);

it("sorts ISO days without mutating API arrays", () => {
  const input = [flow("2026-09-02"), flow("2026-09-01")];
  const before = JSON.stringify(input);
  assert.deepEqual(stockFlowDays(input, []).map(row => row.date), ["2026-09-01", "2026-09-02"]);
  assert.equal(JSON.stringify(input), before);
});
it("joins closing by date, not by array index", () => {
  const result = stockFlowDays([flow("2026-09-01"), flow("2026-09-02")], [stock("2026-09-02", 40), stock("2026-09-01", 80)]);
  assert.deepEqual(result.map(row => row.closing), [80, 40]);
});
it("outbound includes product plus component issue", () => {
  assert.equal(stockFlowDays([flow("2026-09-01", 10, 7, 3)], [])[0].outbound, 10);
});
it("a declining API closing balance draws down even with inbound columns", () => {
  const geometry = snapshotPlotGeometry(days([400, 390, 360]), 940);
  assert.ok(geometry.points[0]!.y < geometry.points[1]!.y);
  assert.ok(geometry.points[1]!.y < geometry.points[2]!.y);
});
it("lower daily receipts do not force a falling inventory balance", () => {
  const result = stockFlowDays([flow("2026-09-01", 200, 100), flow("2026-09-02", 20, 5)], [stock("2026-09-01", 1000), stock("2026-09-02", 1015)]);
  assert.equal(result[1].change, 15);
  const geometry = snapshotPlotGeometry(result, 940);
  assert.ok(geometry.points[1]!.y < geometry.points[0]!.y);
});
it("does not rebuild stock from gross flow columns and lose reversals/opening", () => {
  const result = stockFlowDays([flow("2026-09-01", 100, 10), flow("2026-09-02", 0, 40)], [stock("2026-09-01", 600), stock("2026-09-02", 610)]);
  assert.deepEqual(result.map(row => row.closing), [600, 610]);
  assert.equal(result[1].change, 10);
});
it("preserves flat stock exactly", () => {
  const geometry = snapshotPlotGeometry(days([500, 500, 500]), 940);
  assert.equal(geometry.points[0]!.y, geometry.points[2]!.y);
});
it("does not clamp a negative closing to zero", () => {
  const geometry = snapshotPlotGeometry(days([10, -20]), 940);
  assert.ok(geometry.stockAxis.min < -20);
  assert.ok(geometry.points[1]!.y > axisY(0, geometry.stockAxis, geometry.pad.top, geometry.plotHeight));
});
it("keeps a missing closing as a gap, never zero or carried forward", () => {
  const result = stockFlowDays([flow("2026-09-01"), flow("2026-09-02"), flow("2026-09-03")], [stock("2026-09-01", 100), stock("2026-09-03", 90)]);
  const geometry = snapshotPlotGeometry(result, 940);
  assert.equal(result[1].closing, null);
  assert.equal(geometry.points[1], null);
  assert.equal((geometry.path.match(/M/g) ?? []).length, 2);
});
it("does not bridge an absent calendar day", () => {
  const result = stockFlowDays([], [stock("2026-09-01", 100), stock("2026-09-03", 80)]);
  assert.equal((snapshotPlotGeometry(result, 940).path.match(/M/g) ?? []).length, 2);
  assert.equal(result[1].change, null);
});
it("a stock-only date does not manufacture inbound/outbound zeroes", () => {
  const result = stockFlowDays([], [stock("2026-09-01", 5)])[0];
  assert.equal(result.inbound, null); assert.equal(result.outbound, null); assert.equal(result.closing, 5);
});
it("non-finite inputs do not generate invalid SVG coordinates", () => {
  const result = stockFlowDays([flow("2026-09-01", NaN, Infinity)], [stock("2026-09-01", NaN)]);
  assert.equal(result[0].inbound, null); assert.equal(result[0].outbound, null);
  assert.equal(result[0].closing, null);
  assert.doesNotMatch(snapshotPlotGeometry(result, 940).path, /NaN|Infinity/);
});
it("does not confuse a flow maximum of 485 with stock of 10000", () => {
  const result = stockFlowDays([flow("2026-09-01", 485, 100)], [stock("2026-09-01", 10000)]);
  const geometry = snapshotPlotGeometry(result, 940);
  assert.ok(geometry.flowAxis.max < 1000); assert.ok(geometry.stockAxis.max > 10000);
  assert.ok(geometry.stockAxis.ticks.some(value => value >= 10000));
});
it("leaves headroom above stock and bars instead of pinning maxima to the edge", () => {
  const geometry = snapshotPlotGeometry(days([100, 150]), 940);
  assert.ok(geometry.points[1]!.y > geometry.pad.top);
  assert.ok(axisY(10, geometry.flowAxis, geometry.pad.top, geometry.plotHeight) > geometry.pad.top);
});
it("zero-only and empty data have finite nondegenerate axes", () => {
  for (const values of [[], [0], [null], [NaN]]) {
    const axis = plotAxis(values); assert.equal(axis.min, 0); assert.equal(axis.max, 1);
    assert.ok(Number.isFinite(axisY(0, axis, 0, 200)));
  }
});
it("signed axes contain zero and preserve linear differences", () => {
  const axis = plotAxis([-20, 40]); assert.ok(axis.ticks.includes(0));
  const difference = axisY(0, axis, 0, 240) - axisY(10, axis, 0, 240);
  assert.ok(Math.abs(difference - (axisY(10, axis, 0, 240) - axisY(20, axis, 0, 240))) < 1e-10);
});
it("fractional stock is retained, not rounded before plotting", () => {
  const result = days([10.5, 10.25]); assert.equal(result[1].change, -0.25);
  assert.ok(snapshotPlotGeometry(result, 940).points[1]!.y > snapshotPlotGeometry(result, 940).points[0]!.y);
});
it("a small real decline remains a decline at a large stock level", () => {
  const geometry = snapshotPlotGeometry(days([10000, 9999]), 940);
  assert.ok(geometry.points[1]!.y > geometry.points[0]!.y);
});
it("correctly recognizes month/year and leap-day boundaries", () => {
  assert.ok(consecutiveDays("2026-08-31", "2026-09-01"));
  assert.ok(consecutiveDays("2026-12-31", "2027-01-01"));
  assert.ok(consecutiveDays("2024-02-28", "2024-02-29"));
  assert.equal(consecutiveDays("2026-09-01", "2026-09-03"), false);
});
it("first-day change is unknown without a previous day", () => { assert.equal(days([400])[0].change, null); });
it("desktop pixel geometry follows actual width and has useful vertical space", () => {
  const geometry = snapshotPlotGeometry(days([400, 300]), 1280);
  assert.equal(geometry.width, 1280); assert.equal(geometry.height, 320);
  assert.ok(geometry.plotHeight >= 240);
});
it("long narrow ranges scroll locally rather than compress day slots", () => {
  const geometry = snapshotPlotGeometry(days(Array.from({ length: 30 }, () => 400)), 320);
  assert.ok(geometry.width > 320); assert.ok(geometry.step >= 18); assert.equal(geometry.height, 300);
});
it("date labels keep both endpoints and avoid neighboring labels colliding", () => {
  for (const count of [1, 2, 7, 14, 30, 90]) {
    const plotWidth = Math.max(540, count * 18);
    const labels = [...visibleDateLabels(count, plotWidth)].sort((a, b) => a - b);
    assert.ok(labels.includes(0)); assert.ok(labels.includes(count - 1));
    for (let i = 1; i < labels.length; i++) assert.ok((labels[i] - labels[i - 1]) * plotWidth / count >= 62);
  }
});
it("both columns fit within their day slot at every supported density", () => {
  for (const count of [1, 7, 30, 90]) {
    const g = snapshotPlotGeometry(days(Array.from({ length: count }, () => 400)), 320);
    assert.ok(g.barWidth > 0);
    for (let i = 0; i < count; i++) {
      const left = g.x(i) - g.barWidth - g.barGap / 2;
      const right = g.x(i) + g.barWidth + g.barGap / 2;
      assert.ok(left >= g.pad.left + g.step * i);
      assert.ok(right <= g.pad.left + g.step * (i + 1));
    }
  }
});
