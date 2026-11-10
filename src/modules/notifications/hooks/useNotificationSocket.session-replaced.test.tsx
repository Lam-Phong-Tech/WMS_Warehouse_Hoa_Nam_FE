import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
}));

vi.mock("sonner", () => ({
  toast: {
    info: toastInfoMock,
    warning: toastWarningMock,
    error: toastErrorMock,
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
  const state = {
    user: { user_id: "account-1" },
    isAuthenticated: true,
  };

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
  });

  it("checks the active session immediately when another login is broadcast", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
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
        createElement(QueryClientProvider, { client }, children);
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
      createElement(QueryClientProvider, { client }, children);
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
      createElement(QueryClientProvider, { client }, children);
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
      createElement(QueryClientProvider, { client }, children);
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
