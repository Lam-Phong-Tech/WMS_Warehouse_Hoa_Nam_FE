import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageLoadBoundary } from "@/app/router/PageLoadBoundary";
import { cleanupTestState } from "@/test/setup";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

afterEach(() => cleanupTestState());

describe("PageLoadBoundary", () => {
  it("giữ một overlay duy nhất cho tới khi mọi query khởi tạo hoàn tất", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const client = createClient();

    function Page() {
      const firstQuery = useQuery({
        queryKey: ["page-load-boundary", "first"],
        queryFn: () => first.promise,
      });
      const secondQuery = useQuery({
        queryKey: ["page-load-boundary", "second"],
        queryFn: () => second.promise,
      });
      return (
        <div>{`${firstQuery.data ?? "-"}|${secondQuery.data ?? "-"}`}</div>
      );
    }

    render(
      <QueryClientProvider client={client}>
        <PageLoadBoundary>
          <Page />
        </PageLoadBoundary>
      </QueryClientProvider>,
    );

    expect(
      screen.getByTestId("ui-state-loading-fullscreen"),
    ).toBeInTheDocument();

    await act(async () => first.resolve("A"));
    await waitFor(() => expect(screen.getByText("A|-")).toBeInTheDocument());
    expect(
      screen.getByTestId("ui-state-loading-fullscreen"),
    ).toBeInTheDocument();

    await act(async () => second.resolve("B"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("ui-state-loading-fullscreen"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("A|B")).toBeInTheDocument();

    client.clear();
  });

  it("chờ cả dependent query được tạo sau response đầu tiên", async () => {
    const parent = deferred<string>();
    const child = deferred<string>();
    const client = createClient();

    function Page() {
      const parentQuery = useQuery({
        queryKey: ["page-load-boundary", "parent"],
        queryFn: () => parent.promise,
      });
      const childQuery = useQuery({
        queryKey: ["page-load-boundary", "child", parentQuery.data],
        queryFn: () => child.promise,
        enabled: parentQuery.data !== undefined,
      });
      return <div>{childQuery.data ?? "waiting"}</div>;
    }

    render(
      <QueryClientProvider client={client}>
        <PageLoadBoundary>
          <Page />
        </PageLoadBoundary>
      </QueryClientProvider>,
    );

    await act(async () => parent.resolve("parent-ready"));
    expect(
      screen.getByTestId("ui-state-loading-fullscreen"),
    ).toBeInTheDocument();

    await act(async () => child.resolve("all-ready"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("ui-state-loading-fullscreen"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("all-ready")).toBeInTheDocument();

    client.clear();
  });

  it("không khoá lại trang khi refetch sau lần công bố đầu tiên", async () => {
    const initial = deferred<string>();
    const refetch = deferred<string>();
    const client = createClient();
    let calls = 0;

    function Page() {
      const query = useQuery({
        queryKey: ["page-load-boundary", "refetch"],
        queryFn: () => (++calls === 1 ? initial.promise : refetch.promise),
      });
      return <div>{query.data ?? "waiting"}</div>;
    }

    render(
      <QueryClientProvider client={client}>
        <PageLoadBoundary>
          <Page />
        </PageLoadBoundary>
      </QueryClientProvider>,
    );

    await act(async () => initial.resolve("initial-ready"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("ui-state-loading-fullscreen"),
      ).not.toBeInTheDocument(),
    );

    await act(async () => {
      void client.invalidateQueries({
        queryKey: ["page-load-boundary", "refetch"],
      });
    });
    expect(
      screen.queryByTestId("ui-state-loading-fullscreen"),
    ).not.toBeInTheDocument();

    await act(async () => refetch.resolve("refetched"));
    await waitFor(() =>
      expect(screen.getByText("refetched")).toBeInTheDocument(),
    );

    client.clear();
  });
});
