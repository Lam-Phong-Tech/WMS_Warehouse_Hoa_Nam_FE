import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense, lazy, type ReactNode } from "react";
import { CoordinatedLoadingBoundary } from "./CoordinatedLoadingBoundary";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";
import { usePageVisible, PageVisibilityContext } from "@/shared/ui/page-visibility";

let frames = new Map<number, FrameRequestCallback>();
let nextId = 0;
const clients: QueryClient[] = [];
function client() {
  const value = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(value);
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function commitFrames() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const work = [...frames.values()]; frames.clear();
      for (const callback of work) callback(0);
    });
  }
}
function Value({ name, read, enabled = true }: { name: string; read: () => Promise<string>; enabled?: boolean }) {
  const visible = usePageVisible();
  const query = useQuery({ queryKey: [name], queryFn: read, enabled: enabled && visible });
  if (query.isError) return <p role="alert">Read failed: {name}</p>;
  return <p data-testid={`value-${name}`}>{query.data ?? "pending"}</p>;
}
beforeEach(() => {
  frames = new Map(); nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { const id = ++nextId; frames.set(id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});
afterEach(() => { cleanup(); for (const value of clients.splice(0)) value.clear(); vi.unstubAllGlobals(); });

describe("coordinated page loading", () => {
  it("does not reveal KPI before a slower table; keeps one visible status", async () => {
    const kpi = deferred<string>(), table = deferred<string>();
    const { container } = render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary>
      <Value name="kpi" read={() => kpi.promise} /><Value name="table" read={() => table.promise} />
    </CoordinatedLoadingBoundary></QueryClientProvider>);
    const surface = container.querySelector(".hn-loading-boundary")!;
    await act(async () => { kpi.resolve("kpi-ready"); }); await commitFrames();
    expect(surface).toHaveAttribute("data-loading-phase", "loading");
    expect(screen.getByTestId("value-kpi")).not.toBeVisible();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    await act(async () => { table.resolve("table-ready"); }); await commitFrames();
    await waitFor(() => expect(surface).toHaveAttribute("data-loading-phase", "ready"));
    expect(screen.getByText("kpi-ready")).toBeVisible(); expect(screen.getByText("table-ready")).toBeVisible();
  });
  it("waits for a dependent query to mount, not just its first response", async () => {
    const first = deferred<string>(), second = deferred<string>();
    function Dependent() {
      const parent = useQuery({ queryKey: ["parent"], queryFn: () => first.promise });
      return parent.data ? <Value name="dependent" read={() => second.promise} /> : <p>Waiting</p>;
    }
    const { container } = render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary><Dependent /></CoordinatedLoadingBoundary></QueryClientProvider>);
    await act(async () => { first.resolve("parent-ready"); }); await commitFrames();
    expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "loading");
    await act(async () => { second.resolve("dependent-ready"); }); await commitFrames();
    expect(screen.getByText("dependent-ready")).toBeVisible();
  });
  it("keeps final errors available rather than hanging or inventing an empty result", async () => {
    const read = deferred<string>();
    render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary><Value name="failed" read={() => read.promise} /></CoordinatedLoadingBoundary></QueryClientProvider>);
    await act(async () => { read.reject(new Error("read unavailable")); }); await commitFrames();
    expect(screen.getByRole("alert")).toHaveTextContent("Read failed");
    expect(screen.getByRole("alert")).toBeVisible();
  });
  it("never invokes or waits for a disabled query", async () => {
    const read = vi.fn(() => new Promise<string>(() => {}));
    const { container } = render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary><Value name="disabled" read={read} enabled={false} /></CoordinatedLoadingBoundary></QueryClientProvider>);
    await commitFrames(); expect(read).not.toHaveBeenCalled();
    expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready");
  });
  it("does not remask cached data during a background refetch", async () => {
    const queryClient = client(); const read = deferred<string>();
    queryClient.setQueryData(["cached"], "existing-data");
    const { container } = render(<QueryClientProvider client={queryClient}><CoordinatedLoadingBoundary><Value name="cached" read={() => read.promise} /></CoordinatedLoadingBoundary></QueryClientProvider>);
    await act(async () => { read.resolve("first-data"); }); await commitFrames();
    const next = deferred<string>();
    await act(async () => { void queryClient.fetchQuery({ queryKey: ["cached"], queryFn: () => next.promise, staleTime: 0 }); });
    expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready");
    expect(screen.getByText("first-data")).toBeVisible();
    await act(async () => { next.resolve("next-data"); }); await commitFrames();
  });
  it("uses the same gate for a lazy module and subsequent API data", async () => {
    const module = deferred<{ default: () => ReactNode }>(), read = deferred<string>();
    const Lazy = lazy(() => module.promise);
    const { container } = render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary><Suspense fallback={<PageSkeleton />}><Lazy /></Suspense></CoordinatedLoadingBoundary></QueryClientProvider>);
    await act(async () => { module.resolve({ default: () => <Value name="lazy-api" read={() => read.promise} /> }); });
    await screen.findByTestId("value-lazy-api");
    await commitFrames(); expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "loading");
    await act(async () => { read.resolve("all-ready"); });
    await screen.findByText("all-ready"); await commitFrames(); expect(screen.getByText("all-ready")).toBeVisible();
  });
  it("unsubscribes a hidden keep-alive surface", async () => {
    const queryClient = client(); const read = vi.fn(async () => "cached-page");
    const ui = (visible: boolean) => <QueryClientProvider client={queryClient}><PageVisibilityContext.Provider value={visible}><CoordinatedLoadingBoundary><Value name="kept" read={read} /></CoordinatedLoadingBoundary></PageVisibilityContext.Provider></QueryClientProvider>;
    const { container, rerender } = render(ui(true)); await commitFrames(); rerender(ui(false)); await commitFrames();
    expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "inactive");
  });
});
