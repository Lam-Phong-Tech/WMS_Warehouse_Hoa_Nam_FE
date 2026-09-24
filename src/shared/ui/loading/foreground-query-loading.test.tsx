import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CoordinatedLoadingBoundary } from "./CoordinatedLoadingBoundary";

let frames = new Map<number, FrameRequestCallback>();
let sequence = 0;
const clients: QueryClient[] = [];
function makeClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return client;
}
function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((yes) => { resolve = yes; });
  return { resolve, promise };
}
async function settle() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach((callback) => callback(0));
    });
  }
}
function Read({ name, read, enabled = true }: { name: string; read: () => Promise<string>; enabled?: boolean }) {
  const query = useQuery({ queryKey: [name], queryFn: read, enabled });
  return <p data-testid={name}>{query.data ?? "pending"}</p>;
}
beforeEach(() => {
  frames = new Map(); sequence = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++sequence; frames.set(id, callback); return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});
afterEach(() => {
  cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.unstubAllGlobals();
});

it("waits for all newly observed cached filter results, not the fastest", async () => {
  const client = makeClient();
  client.setQueryData(["chart"], "old-chart"); client.setQueryData(["table"], "old-table");
  const chart = deferred(), table = deferred();
  const ui = (filtered: boolean) => <QueryClientProvider client={client}><CoordinatedLoadingBoundary>
    {filtered ? <><Read name="chart" read={() => chart.promise} /><Read name="table" read={() => table.promise} /></>
      : <Read name="initial" read={async () => "initial-ready"} />}
  </CoordinatedLoadingBoundary></QueryClientProvider>;
  const view = render(ui(false)); await settle();
  expect(screen.getByTestId("initial")).toBeVisible();
  view.rerender(ui(true)); await settle();
  expect(screen.getByTestId("chart")).not.toBeVisible();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  await act(async () => { chart.resolve("new-chart"); }); await settle();
  expect(screen.getByTestId("chart")).not.toBeVisible();
  await act(async () => { table.resolve("new-table"); }); await settle();
  expect(screen.getByText("new-chart")).toBeVisible(); expect(screen.getByText("new-table")).toBeVisible();
});

it("coordinates a cached disabled query when it becomes enabled", async () => {
  const client = makeClient(); client.setQueryData(["tab"], "cached-tab");
  const read = deferred();
  const ui = (enabled: boolean) => <QueryClientProvider client={client}><CoordinatedLoadingBoundary>
    <Read name="tab" enabled={enabled} read={() => read.promise} />
  </CoordinatedLoadingBoundary></QueryClientProvider>;
  const view = render(ui(false)); await settle(); expect(screen.getByText("cached-tab")).toBeVisible();
  view.rerender(ui(true)); await settle(); expect(screen.getByText("cached-tab")).not.toBeVisible();
  await act(async () => { read.resolve("fresh-tab"); }); await settle(); expect(screen.getByText("fresh-tab")).toBeVisible();
});

it("does not treat an existing active query's background fetch as a new filter", async () => {
  const client = makeClient(); const background = deferred(); let calls = 0;
  const read = () => ++calls === 1 ? Promise.resolve("current-data") : background.promise;
  const view = render(<QueryClientProvider client={client}><CoordinatedLoadingBoundary>
    <Read name="stable" read={read} />
  </CoordinatedLoadingBoundary></QueryClientProvider>);
  await settle();
  await act(async () => { void client.refetchQueries({ queryKey: ["stable"] }); }); await settle();
  expect(view.container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready");
  expect(screen.getByText("current-data")).toBeVisible();
  await act(async () => { background.resolve("updated-data"); }); await settle();
  expect(screen.getByText("updated-data")).toBeVisible();
});
