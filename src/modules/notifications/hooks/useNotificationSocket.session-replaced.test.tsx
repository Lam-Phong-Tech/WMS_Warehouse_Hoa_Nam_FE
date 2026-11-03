import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

const { listenMock, subscribedMock, leaveMock, getMock, disconnectMock } =
  vi.hoisted(() => ({
    listenMock: vi.fn(),
    subscribedMock: vi.fn(),
    leaveMock: vi.fn(),
    getMock: vi.fn(),
    disconnectMock: vi.fn(),
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
vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: { user_id: "account-1" },
      isAuthenticated: true,
    }),
}));
vi.mock("@/shared/store/notification.store", () => ({
  useNotificationStore: (selector: (state: unknown) => unknown) =>
    selector({
      increment: vi.fn(),
      setConnected: vi.fn(),
      isConnected: false,
    }),
}));

import { useNotificationSocket } from "./useNotificationSocket";

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
});
