import { createElement, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

const transport = vi.hoisted(() => ({
  connect: vi.fn(),
  private: vi.fn(),
  subscribed: vi.fn(),
  listen: vi.fn(),
  leave: vi.fn(),
}));
vi.mock("@/shared/lib/echo", () => ({ connectEcho: transport.connect }));
vi.mock("@/shared/store/auth.store", async () => {
  const { create } = await import("zustand");
  return { useAuthStore: create(() => ({})) };
});

import { useAuthStore, type AuthProfile } from "@/shared/store/auth.store";
import { useWarehouseRealtime } from "./use-warehouse-realtime";

describe("warehouse data subscription", () => {
  let client: QueryClient;
  let read: Mock<() => Promise<string>>;
  let unsubscribe: () => void;
  const echo = { private: transport.private, leave: transport.leave };
  const channel = {
    subscribed: transport.subscribed,
    listen: transport.listen,
  };
  const profile = {
    id: "account-1",
    user_id: "account-1",
    warehouse_scope_ids: ["warehouse-1"],
  } as unknown as AuthProfile;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    useAuthStore.setState({
      authEpoch: 1,
      token: "test-token",
      isAuthenticated: true,
      isProfileLoaded: true,
      profile,
      permissionCodes: ["inbound.view"],
      isSuperAdmin: false,
      currentContext: null,
    });
    transport.connect.mockResolvedValue(echo);
    transport.private.mockReturnValue(channel);
    transport.subscribed.mockReturnValue(channel);
    transport.listen.mockReturnValue(channel);
    client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
      },
    });
    read = vi.fn(async () => "fresh rows");
    const observer = new QueryObserver(client, {
      queryKey: ["inbound", "list", { page: 2 }],
      queryFn: read,
      initialData: "old rows",
    });
    unsubscribe = observer.subscribe(() => {});
  });
  afterEach(() => {
    cleanup();
    unsubscribe();
    client.clear();
    vi.useRealTimers();
  });
  function mount() {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    return renderHook(() => useWarehouseRealtime(), { wrapper });
  }
  async function tick(ms = 0) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }
  function emit(payload: unknown = { domain: "warehouse" }) {
    const handler = transport.listen.mock.calls.find(
      ([name]) => name === ".warehouse.data.changed",
    )?.[1];
    expect(handler).toBeTypeOf("function");
    act(() => handler(payload));
  }

  it("refreshes the table from business signals without notification preferences or navigation", async () => {
    mount();
    await tick();
    expect(transport.private).toHaveBeenCalledWith("warehouse-data");
    emit();
    await tick(200);
    expect(read).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["inbound", "list", { page: 2 }])).toBe(
      "fresh rows",
    );
    emit({ domain: "auth" });
    emit(null);
    await tick(200);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("catches up on every subscription/reconnect", async () => {
    mount();
    await tick();
    const subscribed = transport.subscribed.mock.calls[0]?.[0];
    expect(subscribed).toBeTypeOf("function");
    act(() => subscribed());
    await tick(200);
    act(() => subscribed());
    await tick(200);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("uses foreground fallback when the socket is unavailable and pauses hidden/offline", async () => {
    transport.connect.mockResolvedValue(null);
    mount();
    await tick(200);
    expect(read).toHaveBeenCalledTimes(1);
    await tick(30_000);
    expect(read).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await tick(60_000);
    expect(read).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await tick(200);
    expect(read).toHaveBeenCalledTimes(3);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    await tick(60_000);
    expect(read).toHaveBeenCalledTimes(3);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    act(() => window.dispatchEvent(new Event("online")));
    await tick(200);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it.each(["logged out", "profile loading", "no read permissions"])(
    "does not subscribe or poll when %s",
    async (condition) => {
      if (condition === "logged out")
        useAuthStore.setState({ isAuthenticated: false });
      if (condition === "profile loading")
        useAuthStore.setState({ isProfileLoaded: false });
      if (condition === "no read permissions")
        useAuthStore.setState({ permissionCodes: ["profile.view"] });
      mount();
      await tick(60_000);
      expect(transport.connect).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("allows super administrators and master-only readers", async () => {
    useAuthStore.setState({ permissionCodes: ["pv.master.manage"] });
    const { unmount } = mount();
    await tick();
    expect(transport.private).toHaveBeenCalledTimes(1);
    unmount();
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: true });
    mount();
    await tick();
    expect(transport.private).toHaveBeenCalledTimes(2);
  });

  it("ignores late callbacks and queued reads after scope changes", async () => {
    const { unmount } = mount();
    await tick();
    const oldHandler = transport.listen.mock.calls[0][1];
    const oldSubscribed = transport.subscribed.mock.calls[0][0];
    emit();
    act(() =>
      useAuthStore.setState({
        profile: { ...profile, warehouse_scope_ids: ["warehouse-2"] },
      }),
    );
    await tick();
    act(() => {
      oldHandler({ domain: "warehouse" });
      oldSubscribed();
    });
    await tick(200);
    expect(read).not.toHaveBeenCalled();
    expect(transport.leave).toHaveBeenCalledWith("warehouse-data");
    unmount();
    await tick(60_000);
    expect(read).not.toHaveBeenCalled();
  });

  it("does not attach an old connection promise to a newer session", async () => {
    let resolve!: (value: typeof echo) => void;
    transport.connect.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mount();
    await tick();
    act(() => useAuthStore.setState({ authEpoch: 2, isAuthenticated: false }));
    resolve(echo);
    await tick(60_000);
    expect(transport.private).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
