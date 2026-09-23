import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwitchContext } from "./use-switch-context";

const mocks = vi.hoisted(() => ({
  setToken: vi.fn(),
  switchContext: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (
    select: (state: { setToken: typeof mocks.setToken }) => unknown,
  ) => select({ setToken: mocks.setToken }),
}));
vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { switchContext: mocks.switchContext },
}));
vi.mock("@/shared/cache/query-persister", () => ({
  stopQueryPersistence: mocks.stop,
}));

describe("context cache isolation", () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.switchContext.mockResolvedValue({
      access_token: "<new-context-token>",
    });
  });
  afterEach(() => client.clear());

  it("removes old scope data before new-context UI can read it, retaining independent audit cache", async () => {
    client.setQueryData(["inventory", "balances"], ["old warehouse"]);
    client.setQueryData(["dashboard", "overview"], { count: 10 });
    client.setQueryData(["ref", "warehouses"], ["old allowed warehouse"]);
    client.setQueryData(["audit-logs", { page: 1 }], ["independent"]);
    client.setQueryData(["auth", "me"], { scope: "old" });
    mocks.setToken.mockImplementation(() => {
      expect(client.getQueryData(["inventory", "balances"])).toBeUndefined();
      expect(client.getQueryData(["dashboard", "overview"])).toBeUndefined();
      expect(client.getQueryData(["ref", "warehouses"])).toBeUndefined();
      expect(client.getQueryData(["auth", "me"])).toBeUndefined();
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSwitchContext(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ context_id: "new-warehouse" }),
    );
    expect(mocks.setToken).toHaveBeenCalledWith("<new-context-token>");
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(client.getQueryData(["audit-logs", { page: 1 }])).toEqual([
      "independent",
    ]);
  });

  it("cancels old requests so their late response cannot refill the cache", async () => {
    let resolveOld!: (value: string[]) => void;
    let oldSignal: AbortSignal | undefined;
    const oldRequest = client
      .fetchQuery({
        queryKey: ["inventory", "balances"],
        queryFn: ({ signal }) => {
          oldSignal = signal;
          return new Promise<string[]>((resolve) => {
            resolveOld = resolve;
          });
        },
      })
      .catch(() => undefined);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSwitchContext(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ context_id: "new-warehouse" }),
    );
    expect(oldSignal?.aborted).toBe(true);
    resolveOld(["old warehouse response"]);
    await oldRequest;
    expect(client.getQueryData(["inventory", "balances"])).toBeUndefined();
  });
});
