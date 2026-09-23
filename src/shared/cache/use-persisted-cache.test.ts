import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePersistedQueryCache } from "./use-persisted-cache";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  state: {
    isProfileLoaded: true,
    token: "session-a",
    profile: {
      user_id: "user-1",
      warehouse_scope_ids: ["warehouse-a", "warehouse-b"],
    },
    permissionCodes: ["warehouse.view"],
    isSuperAdmin: false,
    currentContext: { scope_ref: "warehouse-a" },
  },
}));
vi.mock("./query-persister", () => ({
  startQueryPersistence: mocks.start,
  stopQueryPersistence: mocks.stop,
}));
vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (select: (state: typeof mocks.state) => unknown) =>
    select(mocks.state),
}));
vi.mock("@/app/providers/query-client", () => ({ queryClient: {} }));
vi.mock("@/shared/perf/marks", () => ({ mark: vi.fn() }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("cache readiness follows authenticated context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.isProfileLoaded = true;
    mocks.state.token = "session-a";
    mocks.state.currentContext = { scope_ref: "warehouse-a" };
  });

  it("closes the gate immediately for the next scope until its own restore completes", async () => {
    const first = deferred();
    const second = deferred();
    mocks.start
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(() => usePersistedQueryCache());
    expect(result.current).toBe(false);
    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(result.current).toBe(true);
    mocks.state.currentContext = { scope_ref: "warehouse-b" };
    rerender();
    expect(result.current).toBe(false);
    expect(mocks.stop).toHaveBeenCalled();
    await act(async () => {
      second.resolve();
      await second.promise;
    });
    expect(result.current).toBe(true);
  });

  it("does not open the next scope when a superseded restore completes", async () => {
    const first = deferred();
    const second = deferred();
    mocks.start
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(() => usePersistedQueryCache());
    mocks.state.currentContext = { scope_ref: "warehouse-b" };
    rerender();
    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(result.current).toBe(false);
    await act(async () => {
      second.resolve();
      await second.promise;
    });
    expect(result.current).toBe(true);
  });

  it("requires a new restore for a new session even when its namespace is the same", async () => {
    const first = deferred();
    const nextSession = deferred();
    mocks.start
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(nextSession.promise);
    const { result, rerender } = renderHook(() => usePersistedQueryCache());
    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(result.current).toBe(true);
    mocks.state.isProfileLoaded = false;
    mocks.state.token = "session-b";
    rerender();
    mocks.state.isProfileLoaded = true;
    rerender();
    expect(result.current).toBe(false);
    await act(async () => {
      nextSession.resolve();
      await nextSession.promise;
    });
    expect(result.current).toBe(true);
  });
});
