import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CoordinatedLoadingBoundary } from "./CoordinatedLoadingBoundary";

let frames = new Map<number, FrameRequestCallback>();
let sequence = 0;
const clients: QueryClient[] = [];
function client() {
  const value = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } });
  value.setQueryData(["chart"], "old-chart");
  value.setQueryData(["table"], "old-table");
  clients.push(value);
  return value;
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
beforeEach(() => {
  frames = new Map(); sequence = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++sequence; frames.set(id, callback); return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});
afterEach(() => {
  cleanup(); clients.splice(0).forEach((value) => value.clear()); vi.unstubAllGlobals();
});

it("plain refresh buttons keep the page visible while cached keys refresh", async () => {
  const chart = deferred(), table = deferred();
  function Report() {
    const a = useQuery({ queryKey: ["chart"], queryFn: () => chart.promise });
    const b = useQuery({ queryKey: ["table"], queryFn: () => table.promise });
    return <>
      <button onClick={() => { void a.refetch(); void b.refetch(); }}>Refresh</button>
      <p>{a.data}</p><p>{b.data}</p>
    </>;
  }
  const view = render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary><Report /></CoordinatedLoadingBoundary></QueryClientProvider>);
  await settle(); expect(screen.getByText("old-chart")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await settle();
  expect(view.container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "loading");
  expect(view.container.querySelector(".hn-loading-boundary__cover")).toBeNull();
  expect(view.container.querySelector(".hn-loading-boundary__content")).not.toHaveAttribute("inert");
  await act(async () => { chart.resolve("new-chart"); }); await settle();
  expect(screen.getByText("new-chart")).toBeVisible();
  await act(async () => { table.resolve("new-table"); }); await settle();
  expect(screen.getByText("new-chart")).toBeVisible(); expect(screen.getByText("new-table")).toBeVisible();
});

it("Enter-based search keeps controls visible during a same-key refetch", async () => {
  const read = deferred();
  function Search() {
    const query = useQuery({ queryKey: ["chart"], queryFn: () => read.promise });
    return <>
      <input aria-label="Search" onKeyDown={(event) => { if (event.key === "Enter") void query.refetch(); }} />
      <p>{query.data}</p>
    </>;
  }
  render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary><Search /></CoordinatedLoadingBoundary></QueryClientProvider>);
  await settle(); fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" }); await settle();
  expect(screen.getByText("old-chart")).toBeVisible();
  await act(async () => { read.resolve("new-chart"); }); await settle();
  expect(screen.getByText("new-chart")).toBeVisible();
});

it("validation-only clicks do not leave a read intent for later background polling", async () => {
  const queryClient = client(); const background = deferred();
  function Report() {
    const query = useQuery({ queryKey: ["chart"], queryFn: () => background.promise });
    return <><button onClick={() => { /* rejected filter; no read */ }}>Apply</button><p>{query.data}</p></>;
  }
  const view = render(<QueryClientProvider client={queryClient}><CoordinatedLoadingBoundary><Report /></CoordinatedLoadingBoundary></QueryClientProvider>);
  await settle(); fireEvent.click(screen.getByRole("button", { name: "Apply" })); await settle();
  await act(async () => { void queryClient.refetchQueries({ queryKey: ["chart"] }); }); await settle();
  expect(view.container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready");
  expect(screen.getByText("old-chart")).toBeVisible();
  await act(async () => { background.resolve("new-chart"); }); await settle();
});

it("saving does not become a page-level read barrier", async () => {
  const save = deferred();
  function Form() {
    const mutation = useMutation({ mutationFn: () => save.promise });
    return <><button onClick={() => mutation.mutate()}>Save</button><p>{mutation.isPending ? "saving" : "form"}</p></>;
  }
  const view = render(<QueryClientProvider client={client()}><CoordinatedLoadingBoundary><Form /></CoordinatedLoadingBoundary></QueryClientProvider>);
  await settle(); fireEvent.click(screen.getByRole("button", { name: "Save" })); await settle();
  expect(view.container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready");
  expect(screen.getByText("saving")).toBeVisible();
  await act(async () => { save.resolve("saved"); }); await settle();
});
