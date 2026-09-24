import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import type { ApexOptions } from "apexcharts";
import { CoordinatedLoadingBoundary } from "@/shared/ui/loading/CoordinatedLoadingBoundary";
import { LazyApexChart } from "./LazyApexChart";

const engine = vi.hoisted(() => ({
  draws: [] as Array<{ resolve: () => void; reject: (reason: unknown) => void }>,
  inputs: [] as ApexOptions[],
  destroys: 0,
}));
vi.mock("apexcharts/client", () => ({
  default: class {
    node: HTMLElement;
    options: ApexOptions;
    constructor(node: HTMLElement, options: ApexOptions) {
      this.node = node;
      this.options = options;
      engine.inputs.push(options);
    }
    render() {
      return new Promise<void>((resolve, reject) => {
        engine.draws.push({
          resolve: () => {
            this.node.textContent = `rendered-${String(this.options.chart?.id)}`;
            resolve();
          },
          reject,
        });
      });
    }
    updateOptions(options: ApexOptions) {
      this.options = options;
      engine.inputs.push(options);
      return this.render();
    }
    destroy() { engine.destroys += 1; this.node.textContent = ""; }
  },
}));

beforeEach(() => {
  engine.draws.length = 0;
  engine.inputs.length = 0;
  engine.destroys = 0;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const optionsA: ApexOptions = { chart: { id: "first" } };
const optionsB: ApexOptions = { chart: { id: "second" } };
const series = [{ name: "values", data: [1] }];

it("keeps a page's KPI hidden until every actual chart draw resolves", async () => {
  const { container } = render(<CoordinatedLoadingBoundary>
    <p>KPI ready</p>
    <LazyApexChart options={optionsA} series={series} height={200} />
    <LazyApexChart options={optionsB} series={series} height={200} />
  </CoordinatedLoadingBoundary>);
  await waitFor(() => expect(engine.draws).toHaveLength(2));
  await act(async () => { engine.draws[0].resolve(); });
  expect(screen.getByText("KPI ready")).not.toBeVisible();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  await act(async () => { engine.draws[1].resolve(); });
  await waitFor(() => expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready"));
  expect(screen.getByText("KPI ready")).toBeVisible();
  expect(screen.getByText("rendered-first")).toBeVisible();
  expect(screen.getByText("rendered-second")).toBeVisible();
});

it("a rejected engine promise reveals error UI instead of leaving a permanent loader", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(<CoordinatedLoadingBoundary>
    <p>KPI ready</p><LazyApexChart options={optionsA} series={series} />
  </CoordinatedLoadingBoundary>);
  await waitFor(() => expect(engine.draws).toHaveLength(1));
  await act(async () => { engine.draws[0].reject(new Error("drawing failed")); });
  await waitFor(() => expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready"));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByText("KPI ready")).toBeVisible();
});

it("StrictMode cleanup cannot let the discarded engine release its replacement", async () => {
  const { container } = render(<StrictMode><CoordinatedLoadingBoundary>
    <p>KPI ready</p><LazyApexChart options={optionsA} series={series} />
  </CoordinatedLoadingBoundary></StrictMode>);
  await waitFor(() => expect(engine.draws.length).toBeGreaterThanOrEqual(2));
  const last = engine.draws.length - 1;
  await act(async () => { engine.draws.slice(0, last).forEach((draw) => draw.resolve()); });
  expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "loading");
  await act(async () => { engine.draws[last].resolve(); });
  await waitFor(() => expect(screen.getByText("KPI ready")).toBeVisible());
});
