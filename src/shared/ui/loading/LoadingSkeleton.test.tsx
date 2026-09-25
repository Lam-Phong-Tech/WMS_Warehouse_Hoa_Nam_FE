import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { CoordinatedLoadingBoundary } from "./CoordinatedLoadingBoundary";
import { useLoadingParticipant } from "./loading-context";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";

let frames = new Map<number, FrameRequestCallback>();
let sequence = 0;
const clients: QueryClient[] = [];
function makeClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return client;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const work = [...frames.values()];
      frames.clear();
      work.forEach((callback) => callback(0));
    });
  }
}
function Value({ name, read }: { name: string; read: () => Promise<string> }) {
  const query = useQuery({ queryKey: [name], queryFn: read });
  return <p data-testid={name}>{query.data ?? "pending"}</p>;
}
function Drawing({ pending }: { pending: boolean }) {
  useLoadingParticipant(pending);
  return <div data-testid="chart">Chart content</div>;
}
beforeEach(() => {
  frames = new Map();
  sequence = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++sequence;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});

it("shows every placeholder immediately while the route module is unresolved", async () => {
  const module = deferred<{ default: () => ReactNode }>();
  const Lazy = lazy(() => module.promise);
  const view = render(
    <CoordinatedLoadingBoundary fallback={<LoadingSkeleton layout="report" />}>
      <Suspense fallback={<PageSkeleton />}><Lazy /></Suspense>
    </CoordinatedLoadingBoundary>,
  );
  const cover = view.container.querySelector(".hn-loading-boundary__cover")!;
  expect(cover.querySelectorAll(".hn-skeleton__kpi")).toHaveLength(4);
  expect(cover.querySelectorAll(".hn-skeleton__chart")).toHaveLength(2);
  expect(cover.querySelector(".hn-skeleton__table")).toBeVisible();
  expect(cover.querySelector(".hn-spinner")).toBeNull();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  await settle();
  expect(view.container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "loading");
  await act(async () => { module.resolve({ default: () => <p>Page ready</p> }); });
  await screen.findByText("Page ready");
  await settle();
  expect(screen.getByText("Page ready")).toBeVisible();
});

it("keeps ALL boxes until both reads and the chart finish, then swaps once", async () => {
  const kpi = deferred<string>();
  const table = deferred<string>();
  const client = makeClient();
  const ui = (drawing: boolean) => (
    <QueryClientProvider client={client}>
      <CoordinatedLoadingBoundary fallback={<LoadingSkeleton layout="report" />}>
        <Value name="kpi" read={() => kpi.promise} />
        <Value name="table" read={() => table.promise} />
        <Drawing pending={drawing} />
      </CoordinatedLoadingBoundary>
    </QueryClientProvider>
  );
  const view = render(ui(true));
  const originalSkeleton = screen.getByTestId("loading-skeleton");
  await act(async () => { kpi.resolve("KPI ready"); });
  await settle();
  expect(screen.getByTestId("kpi")).not.toBeVisible();
  expect(screen.getByTestId("loading-skeleton")).toBe(originalSkeleton);
  await act(async () => { table.resolve("Table ready"); });
  await settle();
  expect(screen.getByTestId("table")).not.toBeVisible();
  expect(screen.getByTestId("loading-skeleton")).toBe(originalSkeleton);
  view.rerender(ui(false));
  await settle();
  expect(screen.queryByTestId("loading-skeleton")).toBeNull();
  for (const id of ["kpi", "table", "chart"]) expect(screen.getByTestId(id)).toBeVisible();
});

it("keeps the real subtree mounted and inert while showing skeletons", async () => {
  const mount = vi.fn();
  function Content() {
    useEffect(() => { mount(); }, []);
    return <button>Real action</button>;
  }
  const ui = (pending: boolean) => (
    <CoordinatedLoadingBoundary><Content /><Drawing pending={pending} /></CoordinatedLoadingBoundary>
  );
  const view = render(ui(true));
  const content = view.container.querySelector(".hn-loading-boundary__content")!;
  expect(content).toHaveAttribute("inert");
  expect(content).toHaveStyle({ visibility: "hidden" });
  expect(mount).toHaveBeenCalledTimes(1);
  view.rerender(ui(false));
  await settle();
  expect(content).not.toHaveAttribute("inert");
  expect(screen.getByRole("button", { name: "Real action" })).toBeVisible();
  expect(mount).toHaveBeenCalledTimes(1);
});

it("the skeleton is presentation-only, not a self-blocking participant", async () => {
  render(<CoordinatedLoadingBoundary><p>Cached content</p></CoordinatedLoadingBoundary>);
  await settle();
  expect(screen.getByText("Cached content")).toBeVisible();
  expect(screen.queryByTestId("loading-skeleton")).toBeNull();
});

it("a standalone route fallback is boxes, not a full-page spinner", () => {
  const view = render(<PageSkeleton />);
  expect(screen.getByTestId("ui-state-loading-skeleton")).toBeVisible();
  expect(view.container.querySelectorAll(".hn-skeleton__shape").length).toBeGreaterThan(10);
  expect(view.container.querySelector(".hn-spinner")).toBeNull();
  expect(view.container.querySelectorAll("button,input,select")).toHaveLength(0);
});

it("dialog loading uses a compact field skeleton instead of a report layout", () => {
  const view = render(
    <CoordinatedLoadingBoundary mode="dialog"><Drawing pending /></CoordinatedLoadingBoundary>,
  );
  const cover = view.container.querySelector(".hn-loading-boundary__cover")!;
  expect(cover.querySelector('[data-skeleton-layout="detail"]')).toBeVisible();
  expect(cover.querySelector(".hn-skeleton__chart")).toBeNull();
});
