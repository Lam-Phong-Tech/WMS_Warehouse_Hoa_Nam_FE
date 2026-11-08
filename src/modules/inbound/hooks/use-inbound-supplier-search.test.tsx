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
      }),
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
      }),
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
    });
  });
});
