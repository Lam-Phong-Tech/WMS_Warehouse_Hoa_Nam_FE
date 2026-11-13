import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import { profileKeys } from "@/modules/auth/types/profile.types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

const {
  listenMock,
  subscribedMock,
  leaveMock,
  getMock,
  disconnectMock,
  incrementByMock,
  toastInfoMock,
  toastWarningMock,
  toastErrorMock,
  dismissMock,
  authState,
} = vi.hoisted(() => ({
  listenMock: vi.fn(),
  subscribedMock: vi.fn(),
  leaveMock: vi.fn(),
  getMock: vi.fn(),
  disconnectMock: vi.fn(),
  incrementByMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastWarningMock: vi.fn(),
  toastErrorMock: vi.fn(),
  dismissMock: vi.fn(),
  authState: {
    user: { user_id: "account-1" } as { user_id: string } | null,
    isAuthenticated: true,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    info: toastInfoMock,
    warning: toastWarningMock,
    error: toastErrorMock,
    dismiss: dismissMock,
  },
}));
vi.mock("@/shared/lib/echo", () => ({
  connectEcho: () =>
    Promise.resolve({
      private: () => ({ subscribed: subscribedMock, listen: listenMock }),
      leave: leaveMock,
    }),
  disconnectEcho: disconnectMock,
}));
vi.mock("@/shared/api/axios", () => ({ api: { get: getMock } }));
vi.mock("@/shared/store/auth.store", () => {
  const state = authState;

  return {
    useAuthStore: Object.assign(
      (selector: (state: unknown) => unknown) => selector(state),
      { getState: () => state },
    ),
  };
});
vi.mock("@/shared/store/notification.store", () => ({
  useNotificationStore: (selector: (state: unknown) => unknown) =>
    selector({
      incrementBy: incrementByMock,
      setConnected: vi.fn(),
      isConnected: false,
    }),
}));

import { useNotificationSocket } from "./useNotificationSocket";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";

const notification = (id: string): NotificationItem =>
  ({
    id,
    notification_id: id,
    event_key: "stock.adjusted",
    title: "Stock changed",
    body: "Review the document",
    severity: "info",
    source_module: "inventory",
    subject_type: null,
    subject_id: null,
    actor_id: null,
    actor_name: null,
    payload: null,
    read_at: null,
    created_at: "2026-11-10T00:00:00Z",
  }) as NotificationItem;

describe("session replacement realtime listener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({});
    authState.user = { user_id: "account-1" };
    authState.isAuthenticated = true;
  });

  it("checks the active session immediately when another login is broadcast", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        null,
        createElement(QueryClientProvider, { client }, children),
      );
    const { unmount } = renderHook(() => useNotificationSocket(), { wrapper });

    await waitFor(() =>
      expect(listenMock).toHaveBeenCalledWith(
        ".auth.session-replaced",
        expect.any(Function),
      ),
    );
    const listener = listenMock.mock.calls.find(
      ([name]) => name === ".auth.session-replaced",
    )?.[1];
    listener();

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(API_ENDPOINTS.ME));
    expect(disconnectMock).not.toHaveBeenCalled();
    unmount();
  });

  it("checks the session without a click when realtime is unavailable", async () => {
    vi.useFakeTimers();
    try {
      const client = new QueryClient();
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(
          MemoryRouter,
          null,
          createElement(QueryClientProvider, { client }, children),
        );
      const { unmount } = renderHook(() => useNotificationSocket(), {
        wrapper,
      });

      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(getMock).toHaveBeenCalledWith(API_ENDPOINTS.ME);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes notifications after every private-channel subscription", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        null,
        createElement(QueryClientProvider, { client }, children),
      );
    const { unmount } = renderHook(() => useNotificationSocket(), { wrapper });

    await waitFor(() =>
      expect(subscribedMock).toHaveBeenCalledWith(expect.any(Function)),
    );
    const onSubscribed = subscribedMock.mock.calls[0][0];
    act(() => onSubscribed());
    act(() => onSubscribed());

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: ["notifications"],
    });
    expect(invalidate).toHaveBeenNthCalledWith(2, {
      queryKey: ["notifications"],
    });
    unmount();
  });

  it("coalesces a realtime burst into one badge update and one list invalidation", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        null,
        createElement(QueryClientProvider, { client }, children),
      );
    const { unmount } = renderHook(() => useNotificationSocket(), { wrapper });

    await waitFor(() =>
      expect(listenMock).toHaveBeenCalledWith(
        ".notification.created",
        expect.any(Function),
      ),
    );
    const listener = listenMock.mock.calls.find(
      ([name]) => name === ".notification.created",
    )?.[1] as (payload: NotificationItem) => void;

    vi.useFakeTimers();
    try {
      act(() => {
        for (let index = 0; index < 50; index += 1) {
          listener(notification(`burst-${index}`));
        }
        vi.advanceTimersByTime(400);
      });

      expect(incrementByMock).toHaveBeenCalledTimes(1);
      expect(incrementByMock).toHaveBeenCalledWith(50);
      const listInvalidations = invalidate.mock.calls.filter(
        ([argument]) =>
          JSON.stringify(argument?.queryKey) ===
          JSON.stringify(["notifications", "list"]),
      );
      expect(listInvalidations).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }

    unmount();
  });

  it("updates the badge but suppresses toasts while the tab is hidden", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        null,
        createElement(QueryClientProvider, { client }, children),
      );
    const { unmount } = renderHook(() => useNotificationSocket(), { wrapper });

    await waitFor(() =>
      expect(listenMock).toHaveBeenCalledWith(
        ".notification.created",
        expect.any(Function),
      ),
    );
    const listener = listenMock.mock.calls.find(
      ([name]) => name === ".notification.created",
    )?.[1] as (payload: NotificationItem) => void;

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    vi.useFakeTimers();
    try {
      act(() => {
        for (let index = 0; index < 5; index += 1) {
          listener(notification(`hidden-${index}`));
        }
        vi.advanceTimersByTime(400);
      });

      expect(incrementByMock).toHaveBeenCalledWith(5);
      expect(toastInfoMock).not.toHaveBeenCalled();
      expect(toastWarningMock).not.toHaveBeenCalled();
      expect(toastErrorMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
    }

    unmount();
  });
});

describe("notification presentation budget and complete badge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    getMock.mockResolvedValue({});
    authState.user = { user_id: "account-1" };
    authState.isAuthenticated = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  async function mount() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    let navigate!: NavigateFunction;
    function Probe() {
      navigate = useNavigate();
      return null;
    }
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        { initialEntries: ["/dashboard"] },
        createElement(
          QueryClientProvider,
          { client },
          createElement(Probe),
          children,
        ),
      );
    const hook = renderHook(() => useNotificationSocket(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    const incoming = () =>
      listenMock.mock.calls
        .filter(([name]) => name === ".notification.created")
        .at(-1)?.[1] as (item: NotificationItem) => void;
    return {
      ...hook,
      client,
      incoming,
      navigate: (path: string) => act(() => navigate(path)),
    };
  }
  const badgeTotal = () =>
    incrementByMock.mock.calls.reduce((sum, [count]) => sum + count, 0);
  const individuals = () =>
    [
      ...toastInfoMock.mock.calls,
      ...toastWarningMock.mock.calls,
      ...toastErrorMock.mock.calls,
    ].filter(([, options]) => options?.id !== "notification-burst-summary");

  it("keeps all 120 history rows and badge while showing only three individuals", async () => {
    const ctx = await mount();
    const rows = Array.from({ length: 120 }, (_, i) =>
      notification(`complete-${i}`),
    );
    ctx.client.setQueryData(["notifications", "list"], rows);
    act(() => {
      rows.forEach(ctx.incoming());
      vi.advanceTimersByTime(400);
    });
    expect(badgeTotal()).toBe(120);
    expect(individuals()).toHaveLength(3);
    expect(toastInfoMock).toHaveBeenLastCalledWith(
      "117 thông báo mới",
      expect.objectContaining({ id: "notification-burst-summary" }),
    );
    expect(ctx.client.getQueryData(["notifications", "list"])).toEqual(rows);
    ctx.unmount();
  });

  it("limits consecutive batches in a sliding window and expires the old summary", async () => {
    const ctx = await mount();
    act(() => {
      for (let i = 0; i < 10; i++) {
        ctx.incoming()(notification(`stream-${i}`));
        vi.advanceTimersByTime(400);
      }
      vi.advanceTimersByTime(1000);
    });
    expect(badgeTotal()).toBe(10);
    expect(individuals()).toHaveLength(3);
    expect(toastInfoMock).toHaveBeenLastCalledWith(
      "7 thông báo mới",
      expect.objectContaining({ id: "notification-burst-summary" }),
    );
    act(() => vi.advanceTimersByTime(10000));
    expect(dismissMock).toHaveBeenCalledWith("notification-burst-summary");
    act(() => {
      ctx.incoming()(notification("after-window"));
      vi.advanceTimersByTime(400);
    });
    expect(individuals()).toHaveLength(4);
    ctx.unmount();
  });

  it("keeps 1201 events and deduplicates an ID repeated across early flushes", async () => {
    const ctx = await mount();
    act(() => {
      for (let i = 0; i < 1201; i++) ctx.incoming()(notification(`large-${i}`));
      ctx.incoming()(notification("large-0"));
      vi.advanceTimersByTime(1400);
    });
    expect(badgeTotal()).toBe(1201);
    expect(individuals()).toHaveLength(3);
    expect(toastInfoMock).toHaveBeenLastCalledWith(
      "1198 thông báo mới",
      expect.objectContaining({ id: "notification-burst-summary" }),
    );
    ctx.unmount();
  });

  it("does not replay hidden arrivals when visible again before the burst flush", async () => {
    const ctx = await mount();
    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      for (let i = 0; i < 5; i++)
        ctx.incoming()(notification(`hidden-arrival-${i}`));
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(1400);
    });
    expect(badgeTotal()).toBe(5);
    expect(toastInfoMock).not.toHaveBeenCalled();
    ctx.unmount();
  });

  it("cancels a pending summary on entering history and never replays it on return", async () => {
    const ctx = await mount();
    act(() => {
      for (let i = 0; i < 10; i++) ctx.incoming()(notification(`route-${i}`));
      vi.advanceTimersByTime(400);
    });
    act(() => {
      ctx.incoming()(notification("route-later"));
      vi.advanceTimersByTime(400);
    });
    ctx.navigate("/notifications");
    expect(dismissMock).toHaveBeenCalledWith("notification-burst-summary");
    const before = toastInfoMock.mock.calls.length;
    ctx.navigate("/dashboard");
    act(() => vi.advanceTimersByTime(1500));
    expect(toastInfoMock).toHaveBeenCalledTimes(before);
    expect(badgeTotal()).toBe(11);
    ctx.unmount();
  });

  it("keeps badge and list updates for a category whose toast is disabled", async () => {
    const ctx = await mount();
    ctx.client.setQueryData(profileKeys.preferences("account-1"), {
      notifications: { inventory: { in_app: false, email: false } },
    });
    act(() => {
      ctx.incoming()(notification("muted-category"));
      vi.advanceTimersByTime(400);
    });
    expect(badgeTotal()).toBe(1);
    expect(toastInfoMock).not.toHaveBeenCalled();
    ctx.unmount();
  });

  it("isolates claims and timers across accounts and rejects late old-session events", async () => {
    const ctx = await mount();
    const old = ctx.incoming();
    act(() => {
      old(notification("shared-notification"));
      vi.advanceTimersByTime(400);
    });
    act(() => {
      authState.user = { user_id: "account-2" };
      ctx.rerender();
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      old(notification("late-old"));
      ctx.incoming()(notification("shared-notification"));
      vi.advanceTimersByTime(400);
    });
    expect(badgeTotal()).toBe(2);
    expect(individuals()).toHaveLength(2);
    act(() => {
      authState.isAuthenticated = false;
      authState.user = null;
      ctx.rerender();
      vi.advanceTimersByTime(11000);
    });
    ctx.unmount();
  });
});
