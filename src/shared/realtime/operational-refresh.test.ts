import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationalRefreshController } from "./operational-refresh";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("operational refresh scheduling", () => {
  let client: QueryClient;
  let current: boolean;
  let available: boolean;
  const cleanups: (() => void)[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    current = available = true;
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      },
    });
  });
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    client.clear();
    vi.useRealTimers();
  });
  function controller() {
    const controller = createOperationalRefreshController({
      queryClient: client,
      isCurrent: () => current,
      canFetch: () => available,
    });
    cleanups.push(controller.dispose);
    return controller;
  }
  function observe(
    key: readonly unknown[],
    queryFn: () => Promise<string>,
    initialData?: string,
  ) {
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn,
      initialData,
    });
    cleanups.push(observer.subscribe(() => {}));
    return observer;
  }

  it("coalesces bursts, preserves filtered page keys and defers inactive/editor reads", async () => {
    const key = ["inbound", "list", { page: 3, status: "POSTED" }] as const;
    const read = vi.fn(async () => "new rows");
    observe(key, read, "old rows");
    const inactiveKey = ["inbound", "list", { page: 1 }];
    client.setQueryData(inactiveKey, "cached page");
    const editor = vi.fn(async () => "remote draft");
    observe(["inbound", "detail", "draft-1"], editor, "typed draft snapshot");
    const refresh = controller();
    for (let index = 0; index < 10; index++) refresh.schedule();
    expect(client.getQueryState(inactiveKey)?.isInvalidated).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(read).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(key)).toBe("new rows");
    expect(client.getQueryData(inactiveKey)).toBe("cached page");
    expect(editor).not.toHaveBeenCalled();
    expect(client.getQueryData(["inbound", "detail", "draft-1"])).toBe(
      "typed draft snapshot",
    );
  });

  it("obtains a fresh response after an initial request that predates the signal", async () => {
    const pending = deferred<string>();
    const read = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue("post-commit rows");
    const key = ["mvp-outbound", "list"];
    observe(key, read);
    controller().schedule();
    await vi.advanceTimersByTimeAsync(200);
    expect(read).toHaveBeenCalledTimes(1);
    pending.resolve("pre-commit rows");
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(key)).toBe("post-commit rows");
  });

  it("runs one trailing batch when more signals arrive during refresh", async () => {
    const pending = deferred<string>();
    const read = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue("latest rows");
    const key = ["inventory", "balances"];
    observe(key, read, "old rows");
    const refresh = controller();
    refresh.schedule();
    await vi.advanceTimersByTimeAsync(200);
    for (let index = 0; index < 10; index++) refresh.schedule();
    pending.resolve("first update");
    await vi.advanceTimersByTimeAsync(201);
    expect(read).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(key)).toBe("latest rows");
  });

  it("does not let a slow query block other tables", async () => {
    const pending = deferred<string>();
    observe(["inbound", "list"], () => pending.promise);
    const stockRead = vi.fn(async () => "new stock");
    observe(["inventory", "balances"], stockRead, "old stock");
    controller().schedule();
    await vi.advanceTimersByTimeAsync(200);
    expect(stockRead).toHaveBeenCalledTimes(1);
    pending.resolve("old list");
    await vi.advanceTimersByTimeAsync(1);
  });

  it("marks data stale while hidden/offline and catches up on resume", async () => {
    const read = vi.fn(async () => "latest rows");
    const key = ["warranty", "list"];
    observe(key, read, "old rows");
    const refresh = controller();
    available = false;
    refresh.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).not.toHaveBeenCalled();
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    available = true;
    refresh.schedule();
    await vi.advanceTimersByTimeAsync(200);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it.each(["dispose", "owner change"])(
    "guards pending reads after %s",
    async (reason) => {
      const pending = deferred<string>();
      const read = vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue("other account");
      observe(["inbound", "list"], read);
      const refresh = controller();
      refresh.schedule();
      await vi.advanceTimersByTimeAsync(200);
      if (reason === "dispose") refresh.dispose();
      else current = false;
      pending.resolve("old account");
      await vi.advanceTimersByTimeAsync(1000);
      expect(read).toHaveBeenCalledTimes(1);
    },
  );

  it("cancels a queued batch when disposed and never fetches disabled queries", async () => {
    const read = vi.fn(async () => "new rows");
    const observer = new QueryObserver(client, {
      queryKey: ["inbound", "list"],
      queryFn: read,
      initialData: "old rows",
      enabled: false,
    });
    cleanups.push(observer.subscribe(() => {}));
    const refresh = controller();
    refresh.schedule();
    await vi.advanceTimersByTimeAsync(200);
    expect(read).not.toHaveBeenCalled();
    observer.setOptions({
      queryKey: ["inbound", "list"],
      queryFn: read,
      initialData: "old rows",
      enabled: false,
    });
    refresh.schedule();
    refresh.dispose();
    await vi.advanceTimersByTimeAsync(200);
    expect(read).not.toHaveBeenCalled();
  });
});
