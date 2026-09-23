import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import {
  APP_BUILD_ID,
  buildCacheNamespace,
  type CacheIdentity,
} from "./cache-namespace";
import { idbDelete, idbGet, idbKeys, idbSet } from "./idb";
import { startQueryPersistence, stopQueryPersistence } from "./query-persister";

vi.mock("./idb", () => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
  idbDelete: vi.fn(),
  idbKeys: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function identity(userId: string): CacheIdentity {
  return {
    userId,
    warehouseScopeIds: ["warehouse-a"],
    contextRef: "warehouse-a",
    permissionCodes: ["warehouse.view"],
    isSuperAdmin: false,
  };
}

function record(entries: Array<[readonly unknown[], unknown]>) {
  const source = new QueryClient();
  for (const [key, value] of entries) source.setQueryData(key, value);
  const result = {
    buildId: APP_BUILD_ID,
    savedAt: Date.now(),
    state: dehydrate(source),
  };
  source.clear();
  return result;
}

describe("persisted cache session boundaries", () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    client = new QueryClient();
    vi.mocked(idbGet).mockResolvedValue(null);
    vi.mocked(idbKeys).mockResolvedValue([]);
    vi.mocked(idbSet).mockResolvedValue(true);
    vi.mocked(idbDelete).mockResolvedValue(undefined);
  });
  afterEach(() => {
    stopQueryPersistence();
    client.clear();
    vi.useRealTimers();
  });

  it("does not hydrate or resubscribe when a pending restore finishes after logout", async () => {
    const read = deferred<ReturnType<typeof record> | null>();
    vi.mocked(idbGet).mockReturnValueOnce(read.promise);
    const restoring = startQueryPersistence(client, identity("previous-user"));
    stopQueryPersistence();
    read.resolve(record([[["ref", "old-user"], "private old data"]]));
    await restoring;
    expect(client.getQueryData(["ref", "old-user"])).toBeUndefined();
    client.setQueryData(["ref", "new-data"], "next session");
    await vi.advanceTimersByTimeAsync(2_001);
    expect(idbSet).not.toHaveBeenCalled();
  });

  it("ignores an earlier identity restore that completes after the new identity", async () => {
    const read = deferred<ReturnType<typeof record> | null>();
    vi.mocked(idbGet)
      .mockReturnValueOnce(read.promise)
      .mockResolvedValueOnce(record([[["ref", "current"], "new user"]]));
    const oldRestore = startQueryPersistence(client, identity("old"));
    await startQueryPersistence(client, identity("new"));
    read.resolve(record([[["ref", "previous"], "old user"]]));
    await oldRestore;
    expect(client.getQueryData(["ref", "previous"])).toBeUndefined();
    expect(client.getQueryData(["ref", "current"])).toBe("new user");
  });

  it("coalesces concurrent restores for the same authenticated identity", async () => {
    const read = deferred<ReturnType<typeof record> | null>();
    vi.mocked(idbGet).mockReturnValueOnce(read.promise);
    const first = startQueryPersistence(client, identity("same"));
    const second = startQueryPersistence(client, identity("same"));
    expect(idbGet).toHaveBeenCalledTimes(1);
    read.resolve(null);
    await Promise.all([first, second]);
  });

  it("reapplies denylist and freshness policy before restoring saved data", async () => {
    vi.mocked(idbGet).mockResolvedValueOnce(
      record([
        [["rpt-ops", "user-directory"], ["personal data"]],
        [["rpt-coverage", "outbound-by-recipient"], ["recipient data"]],
        [["inventory", "balances"], [100]],
        [["auth", "me"], { secret: "old profile" }],
        [["ref", "warehouses"], ["allowed"]],
        [["dashboard", "overview-quick"], { total: 4 }],
      ]),
    );
    await startQueryPersistence(client, identity("current"));
    expect(client.getQueryData(["rpt-ops", "user-directory"])).toBeUndefined();
    expect(
      client.getQueryData(["rpt-coverage", "outbound-by-recipient"]),
    ).toBeUndefined();
    expect(client.getQueryData(["inventory", "balances"])).toBeUndefined();
    expect(client.getQueryData(["auth", "me"])).toBeUndefined();
    expect(client.getQueryData(["ref", "warehouses"])).toEqual(["allowed"]);
    expect(
      client.getQueryState(["dashboard", "overview-quick"])?.dataUpdatedAt,
    ).toBe(0);
  });

  it("never retries an old identity snapshot under the new namespace", async () => {
    const write = deferred<boolean>();
    vi.mocked(idbSet).mockReturnValueOnce(write.promise);
    await startQueryPersistence(client, identity("old"));
    client.setQueryData(["ref", "warehouses"], ["old scope"]);
    await vi.advanceTimersByTimeAsync(2_001);
    expect(idbSet).toHaveBeenCalledTimes(1);
    await startQueryPersistence(client, identity("new"));
    write.resolve(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(idbSet).toHaveBeenCalledTimes(1);
    expect(vi.mocked(idbSet).mock.calls[0][0]).toBe(
      buildCacheNamespace(identity("old")),
    );
    expect(idbDelete).toHaveBeenCalledWith(
      buildCacheNamespace(identity("old")),
    );
  });

  it("does not serialize persisted reports when only RAM-only data changes", async () => {
    await startQueryPersistence(client, identity("current"));
    client.setQueryData(["inventory", "balances"], [5]);
    client.setQueryData(["autocomplete", "search", "sku"], ["result"]);
    client.setQueryData(["rpt-coverage", "warranty-defects"], ["private case"]);
    await vi.advanceTimersByTimeAsync(2_001);
    expect(idbSet).not.toHaveBeenCalled();
    client.setQueryData(["ref", "warehouses"], ["updated"]);
    await vi.advanceTimersByTimeAsync(2_001);
    expect(idbSet).toHaveBeenCalledOnce();
  });
});
