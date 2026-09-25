import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { onlineManager, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { CoordinatedLoadingBoundary } from "./CoordinatedLoadingBoundary";
import { useBeginLoadingBatch, useLoadingParticipant } from "./loading-context";

const clients: QueryClient[] = [];
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { resolve, reject, promise };
}
function createClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return client;
}
function assertInteractive(container: HTMLElement) {
  const boundary = container.querySelector(".hn-loading-boundary")!;
  const content = boundary.querySelector(".hn-loading-boundary__content")!;
  expect(boundary).toHaveAttribute("data-loading-blocked", "false");
  expect(boundary).toHaveAttribute("aria-busy", "false");
  expect(boundary.querySelector(":scope > .hn-loading-boundary__cover")).toBeNull();
  expect(content).not.toHaveAttribute("inert");
  expect(content).not.toHaveAttribute("aria-hidden");
  expect(screen.getByRole("textbox", { name: "Search" })).toBeVisible();
}
afterEach(() => {
  cleanup(); clients.splice(0).forEach((client) => client.clear());
  onlineManager.setOnline(true);
});

it.each(["page", "dialog", "drawer"] as const)(
  "%s keeps search, focus and unrelated content when a new filter key loads",
  async (mode) => {
    const initial = deferred(), next = deferred();
    const mounted = vi.fn(), unmounted = vi.fn();
    function FilteredContent() {
      const [search, setSearch] = useSearchParams();
      const [draft, setDraft] = useState("");
      const value = search.get("keyword") ?? "";
      const query = useQuery({
        queryKey: ["nonblocking-list", value],
        queryFn: () => value ? next.promise : initial.promise,
      });
      useEffect(() => { mounted(); return () => { unmounted(); }; }, []);
      return <>
        <h1>Page heading</h1>
        <form onSubmit={(event) => {
          event.preventDefault();
          setSearch((previous) => { const params = new URLSearchParams(previous); params.set("keyword", draft); return params; });
        }}>
          <input aria-label="Search" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button type="submit" data-action-kind="filter">Apply</button>
        </form>
        <p>Unrelated card</p>
        <output data-testid="query-string">{search.toString()}</output>
        <section aria-label="Results" aria-busy={query.isFetching}>
          {query.isError ? <p role="alert">Result read failed</p>
            : query.isPending ? <p role="status">Loading results</p> : <p>{query.data}</p>}
        </section>
      </>;
    }
    const view = render(<QueryClientProvider client={createClient()}>
      <MemoryRouter initialEntries={["/putaway?screen=PTW-00"]}>
        <CoordinatedLoadingBoundary mode={mode}><FilteredContent /></CoordinatedLoadingBoundary>
      </MemoryRouter>
    </QueryClientProvider>);
    // A real first entry still has its coordinated skeleton.
    expect(view.container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-blocked", "true");
    await act(async () => { initial.resolve("Initial rows"); });
    await waitFor(() => expect(screen.getByText("Initial rows")).toBeVisible());
    const input = screen.getByRole("textbox", { name: "Search" });
    const content = view.container.querySelector(".hn-loading-boundary__content");
    fireEvent.change(input, { target: { value: "new filter" } });
    input.focus();
    // Submit an actual form, including the boundary's submit capture path.
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.getByRole("region", { name: "Results" })).toHaveAttribute("aria-busy", "true"));
    assertInteractive(view.container);
    expect(view.container.querySelector(".hn-loading-boundary__content")).toBe(content);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("new filter");
    expect(screen.getByText("Unrelated card")).toBeVisible();
    expect(screen.getByTestId("query-string")).toHaveTextContent("screen=PTW-00");
    expect(mounted).toHaveBeenCalledTimes(1); expect(unmounted).not.toHaveBeenCalled();
    await act(async () => { next.resolve("Filtered rows"); });
    await waitFor(() => expect(screen.getByText("Filtered rows")).toBeVisible());
    assertInteractive(view.container);
  },
);

it.each(["filter", "search", "refresh", "reset", "retry"])(
  "a %s action cannot re-enable the page cover while a read is pending",
  async (kind) => {
    const next = deferred();
    const client = createClient(); client.setQueryData(["marked-read"], "Current rows");
    function Filter() {
      const query = useQuery({ queryKey: ["marked-read"], queryFn: () => next.promise, staleTime: Infinity });
      return <><input aria-label="Search" />
        <button data-action-kind={kind} onClick={() => { void query.refetch(); }}>Read</button>
        <p>{query.data}</p></>;
    }
    const view = render(<QueryClientProvider client={client}>
      <CoordinatedLoadingBoundary><Filter /></CoordinatedLoadingBoundary>
    </QueryClientProvider>);
    await waitFor(() => expect(screen.getByText("Current rows")).toBeVisible());
    fireEvent.click(screen.getByText("Read"));
    await waitFor(() => expect(client.isFetching()).toBe(1));
    assertInteractive(view.container);
    expect(screen.getByText("Current rows")).toBeVisible();
    await act(async () => { next.resolve("New rows"); });
    await waitFor(() => expect(screen.getByText("New rows")).toBeVisible());
  },
);

it("an uncached offline filter and its retry leave controls interactive", async () => {
  const next = deferred();
  function Filter() {
    const [filter, setFilter] = useState(0);
    const query = useQuery({ queryKey: ["offline-filter", filter], queryFn: () => filter ? next.promise : Promise.resolve("First rows") });
    return <><input aria-label="Search" /><button onClick={() => setFilter(1)}>Filter</button>
      <section aria-label="Results" aria-busy={query.isFetching}>
        {query.fetchStatus === "paused" ? <p role="status">Offline results</p>
          : query.isError ? <p role="alert">Read failed</p> : <p>{query.data}</p>}
      </section></>;
  }
  const view = render(<QueryClientProvider client={createClient()}>
    <CoordinatedLoadingBoundary><Filter /></CoordinatedLoadingBoundary>
  </QueryClientProvider>);
  await waitFor(() => expect(screen.getByText("First rows")).toBeVisible());
  act(() => { onlineManager.setOnline(false); });
  fireEvent.click(screen.getByText("Filter"));
  await waitFor(() => expect(screen.getByText("Offline results")).toBeVisible());
  assertInteractive(view.container);
  await act(async () => { onlineManager.setOnline(true); next.reject(new Error("Read failed")); });
  await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
  assertInteractive(view.container);
});

it("client-side sorting and local chart preparation do not reset the page", async () => {
  function Filter() {
    const begin = useBeginLoadingBatch();
    const [pending, setPending] = useState(false);
    const [sort, setSort] = useState("default");
    useLoadingParticipant(pending);
    return <><input aria-label="Search" />
      <button data-loading-batch onClick={() => { begin(); setSort("ascending"); setPending(true); }}>Sort</button>
      <button onClick={() => setPending(false)}>Finish chart</button>
      <p>{sort}</p><section aria-label="Chart" aria-busy={pending}>Chart region</section></>;
  }
  const view = render(<CoordinatedLoadingBoundary><Filter /></CoordinatedLoadingBoundary>);
  await waitFor(() => expect(screen.getByText("default")).toBeVisible());
  fireEvent.click(screen.getByText("Sort"));
  expect(screen.getByText("ascending")).toBeVisible();
  expect(screen.getByRole("region", { name: "Chart" })).toHaveAttribute("aria-busy", "true");
  assertInteractive(view.container);
  fireEvent.click(screen.getByText("Finish chart"));
  await waitFor(() => expect(screen.getByRole("region", { name: "Chart" })).toHaveAttribute("aria-busy", "false"));
});

it("unmarked dropdowns and pagination stay usable across overlapping result reads", async () => {
  const older = deferred(), newer = deferred();
  function Filter() {
    const [category, setCategory] = useState("all");
    const [page, setPage] = useState(1);
    const query = useQuery({
      queryKey: ["paged-filter", category, page],
      queryFn: () => category === "all" ? Promise.resolve("Initial rows")
        : page === 1 ? older.promise : newer.promise,
    });
    return <><input aria-label="Search" />
      <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="all">All</option><option value="selected">Selected</option>
      </select>
      <button onClick={() => setPage(2)}>Next page</button>
      <section aria-label="Results" aria-busy={query.isFetching}>
        {query.isPending ? <p role="status">Loading results</p> : <p>{query.data}</p>}
      </section></>;
  }
  const view = render(<QueryClientProvider client={createClient()}>
    <CoordinatedLoadingBoundary><Filter /></CoordinatedLoadingBoundary>
  </QueryClientProvider>);
  await waitFor(() => expect(screen.getByText("Initial rows")).toBeVisible());
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "selected" } });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Loading results"));
  assertInteractive(view.container);
  fireEvent.click(screen.getByText("Next page"));
  assertInteractive(view.container);
  await act(async () => { newer.resolve("Page two rows"); });
  await waitFor(() => expect(screen.getByText("Page two rows")).toBeVisible());
  await act(async () => { older.resolve("Obsolete page one rows"); });
  expect(screen.queryByText("Obsolete page one rows")).not.toBeInTheDocument();
  expect(screen.getByText("Page two rows")).toBeVisible();
  assertInteractive(view.container);
});
