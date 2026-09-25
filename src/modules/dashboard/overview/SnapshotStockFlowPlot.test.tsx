import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StockFlowPlotCanvas } from "./SnapshotStockFlowPlot";

vi.mock("./overview-data", () => ({ activeLocale: () => "vi-VN" }));
const disconnect = vi.fn();
beforeEach(() => {
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(940);
  disconnect.mockClear();
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const rows = [
  { date: "2026-09-01", inbound: 100, product: 40, component: 5 },
  { date: "2026-09-02", inbound: 0, product: 150, component: 10 },
];
const trend = [
  { date: "2026-09-01", closing: 10000 },
  { date: "2026-09-02", closing: 9840 },
];
const copy = {
  inbound: "Nhập kho", outbound: "Xuất kho", stock: "Tồn kho",
  closing: "Tồn cuối ngày", legend: "Chú giải", chart: "Nhập xuất tồn",
  variance: "Chênh lệch",
  point: (date: string, inbound: string, outbound: string, stock: string) =>
    `${date}: nhập ${inbound}, xuất ${outbound}, tồn ${stock}`,
};
const draw = (stock = trend) => render(<StockFlowPlotCanvas rows={rows} trend={stock} copy={copy} locale="vi-VN" />);

it("renders independent, explicitly numbered flow and closing axes", () => {
  const { container } = draw();
  const right = [...container.querySelectorAll('[data-axis="stock"]')].map(node => node.textContent);
  const left = [...container.querySelectorAll('[data-axis="flow"]')].map(node => node.textContent);
  expect(right).toContain("12.000");
  expect(left).not.toContain("12.000");
  expect(screen.getByText("→ Tồn cuối ngày")).toBeInTheDocument();
});
it("keeps the SVG viewBox and measured pixel size at the same ratio", () => {
  draw();
  const svg = screen.getByRole("img", { name: copy.chart });
  expect(svg).toHaveAttribute("width", "940");
  expect(svg).toHaveAttribute("height", "320");
  expect(svg).toHaveAttribute("viewBox", "0 0 940 320");
  expect(svg).toHaveAttribute("preserveAspectRatio", "xMinYMin meet");
});
it("draws lower closing stock lower, without modifying the received balances", () => {
  const before = JSON.stringify(trend);
  const { container } = draw();
  const markers = container.querySelectorAll('.hn-stock-flow__point');
  expect(Number(markers[1].getAttribute("cy"))).toBeGreaterThan(Number(markers[0].getAttribute("cy")));
  expect(JSON.stringify(trend)).toBe(before);
});
it("does not draw a fake positive bar for zero inbound", () => {
  const { container } = draw();
  const bar = container.querySelector('[data-flow="inbound"][data-date="2026-09-02"]');
  expect(bar).toHaveAttribute("height", "0");
});
it("the tooltip exposes closing balance and signed day-to-day change", () => {
  const { container } = draw();
  fireEvent.focus(container.querySelector('.hn-stock-flow__target[data-date="2026-09-02"]')!);
  const tooltip = screen.getByRole("status");
  expect(tooltip).toHaveTextContent("9.840");
  expect(tooltip).toHaveTextContent("-160");
  expect(tooltip).toHaveTextContent("01/09 → 02/09");
});
it("omits a missing stock point instead of putting it at zero", () => {
  const { container } = draw([trend[0]]);
  expect(container.querySelectorAll('.hn-stock-flow__point')).toHaveLength(1);
  fireEvent.focus(container.querySelector('.hn-stock-flow__target[data-date="2026-09-02"]')!);
  expect(screen.getByRole("status")).toHaveTextContent("—");
});
it("Escape closes the tooltip", () => {
  const { container } = draw();
  const target = container.querySelector('.hn-stock-flow__target')!;
  fireEvent.focus(target); expect(screen.getByRole("status")).toBeInTheDocument();
  fireEvent.keyDown(target, { key: "Escape" }); expect(screen.queryByRole("status")).toBeNull();
});
it("teardown disconnects the size observer", () => {
  const view = draw(); view.unmount(); expect(disconnect).toHaveBeenCalledTimes(1);
});
