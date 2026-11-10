import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/modules/master-data/services/supplier.service", () => ({
  listSuppliers: vi.fn(),
}));

import { listSuppliers } from "@/modules/master-data/services/supplier.service";
import { useInboundSupplierSearch } from "./use-inbound-supplier-search";

const rows = [
  {
    id: "SUP-1",
    code: "NCC-001",
    name: "Honda",
    display_name: "NCC-001 - Honda",
    code_status: "ASSIGNED" as const,
    status: "ACTIVE" as const,
    version: 1,
    updated_at: "2026-11-08T08:30:00+07:00",
    description: null,
  },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useInboundSupplierSearch", () => {
  beforeEach(() => {
    vi.mocked(listSuppliers).mockReset().mockResolvedValue({
      rows,
      page: 1,
      perPage: 20,
      total: 1,
      lastPage: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the first active page on mount and maps display names", async () => {
    const { result } = renderHook(() => useInboundSupplierSearch(true), {
      wrapper,
    });

    await waitFor(() =>
      expect(listSuppliers).toHaveBeenCalledWith({
        q: undefined,
        status: "ACTIVE",
        page: 1,
        per_page: 20,
      }, expect.anything()),
    );
    await waitFor(() =>
      expect(result.current.options).toEqual([
        { value: "SUP-1", label: "NCC-001 - Honda" },
      ]),
    );
  });

  it("debounces typing by 300ms", async () => {
    const { result } = renderHook(() => useInboundSupplierSearch(true), {
      wrapper,
    });
    await waitFor(() => expect(listSuppliers).toHaveBeenCalledTimes(1));

    act(() => result.current.onSearch("Hon"));
    expect(listSuppliers).toHaveBeenCalledTimes(1);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await waitFor(() =>
      expect(listSuppliers).toHaveBeenCalledWith({
        q: "Hon",
        status: "ACTIVE",
        page: 1,
        per_page: 20,
      }, expect.anything()),
    );
  });

  it("keeps only the final keyword when typing quickly", async () => {
    const { result } = renderHook(() => useInboundSupplierSearch(true), {
      wrapper,
    });
    await waitFor(() => expect(listSuppliers).toHaveBeenCalledTimes(1));
    vi.mocked(listSuppliers).mockClear();

    act(() => {
      result.current.onSearch("H");
      result.current.onSearch("Ho");
      result.current.onSearch("Hon");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await waitFor(() => expect(listSuppliers).toHaveBeenCalledTimes(1));
    expect(listSuppliers).toHaveBeenCalledWith({
      q: "Hon",
      status: "ACTIVE",
      page: 1,
      per_page: 20,
    }, expect.anything());
  });

  it("keeps the latest keyword result when responses arrive out of order", async () => {
    type SupplierPage = Awaited<ReturnType<typeof listSuppliers>>;
    const deferred = <T,>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    };
    const page = (label: string): SupplierPage => ({
      rows: [{ ...rows[0], display_name: label }],
      page: 1,
      perPage: 20,
      total: 1,
      lastPage: 1,
    });
    const hon = deferred<SupplierPage>();
    const honda = deferred<SupplierPage>();
    vi.mocked(listSuppliers).mockImplementation((params) => {
      if (params.q === "Hon") return hon.promise;
      if (params.q === "Honda") return honda.promise;
      return Promise.resolve(page("BASE"));
    });

    const { result } = renderHook(() => useInboundSupplierSearch(true), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.options[0]?.label).toBe("BASE"),
    );

    act(() => result.current.onSearch("Hon"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    act(() => result.current.onSearch("Honda"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await act(async () => {
      honda.resolve(page("HONDA"));
      await honda.promise;
    });
    await waitFor(() =>
      expect(result.current.options[0]?.label).toBe("HONDA"),
    );

    await act(async () => {
      hon.resolve(page("HON"));
      await hon.promise;
    });
    await waitFor(() =>
      expect(result.current.options[0]?.label).toBe("HONDA"),
    );
  });

  it("cancels the previous debounce when typing is staggered", async () => {
    const { result } = renderHook(() => useInboundSupplierSearch(true), {
      wrapper,
    });
    await waitFor(() => expect(listSuppliers).toHaveBeenCalledTimes(1));
    vi.mocked(listSuppliers).mockClear();

    act(() => result.current.onSearch("H"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    act(() => result.current.onSearch("Ho"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    act(() => result.current.onSearch("Hon"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await waitFor(() => expect(listSuppliers).toHaveBeenCalledTimes(1));
    expect(listSuppliers).toHaveBeenCalledWith({
      q: "Hon",
      status: "ACTIVE",
      page: 1,
      per_page: 20,
    }, expect.anything());
  });
});
