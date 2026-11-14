import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { useStockReconcileSnapshot } from "@/modules/reports/stock-reconcile/stock-reconcile-api";
import { buildDashboardThresholds } from "./dashboard-threshold-model";
import {
  buildEquation,
  buildTopSkus,
  countSkusInStock,
  useOverviewSource,
} from "./overview-data";
import { useDashboardThresholdSource } from "./use-dashboard-threshold-source";

vi.mock("@/shared/api/http", () => ({ http: { get: vi.fn() } }));
const get = vi.mocked(http.get);
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const catalog = [
  {
    sku_id: "a",
    sku_code: "A",
    sku_name: "A",
    sku_type: "PRODUCT",
    min_stock: 10,
    max_stock: 20,
  },
  {
    sku_id: "b",
    sku_code: "B",
    sku_name: "B",
    sku_type: "COMPONENT",
    min_stock: 0,
    max_stock: 0,
  },
  {
    sku_id: "c",
    sku_code: "C",
    sku_name: "C",
    sku_type: "PRODUCT",
    min_stock: null,
    max_stock: null,
  },
  {
    sku_id: "d",
    sku_code: "D",
    sku_name: "D",
    sku_type: "PRODUCT",
    min_stock: 2,
    max_stock: null,
  },
];
const rows = [
  {
    product_code: "A",
    product_name: "A",
    sku_type: "PRODUCT",
    available_qty: 3.25,
    warehouse_id: "one",
    on_hand_qty: 8,
    reconciliation_overall: "MISMATCH",
  },
  {
    product_code: "A",
    product_name: "A",
    sku_type: "PRODUCT",
    available_qty: 4.5,
    warehouse_id: "two",
    on_hand_qty: 10,
  },
  {
    product_code: "B",
    product_name: "B",
    sku_type: "COMPONENT",
    available_qty: 1,
    warehouse_id: "one",
    on_hand_qty: 1,
  },
];

describe("dashboard compact data", () => {
  it("preserves threshold counts and detail cache across multiple warehouses, zero/null and no-stock SKUs", async () => {
    get.mockImplementation(async (url, config) => {
      if (url === API_ENDPOINTS.SKU_LOOKUP) return catalog as never;
      if (url === API_ENDPOINTS.INVENTORY_RECONCILIATION) {
        const compact = config?.params?.view === "dashboard-thresholds";
        return {
          rows: compact
            ? rows.map(
                ({ product_code, product_name, sku_type, available_qty }) => ({
                  product_code,
                  product_name,
                  sku_type,
                  available_qty,
                }),
              )
            : rows,
        } as never;
      }
      throw new Error(`Unexpected ${url}`);
    });
    const { result } = renderHook(
      () => ({
        compact: useDashboardThresholdSource(),
        full: useStockReconcileSnapshot({ asOf: "" }),
      }),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(
        result.current.compact.loading || result.current.full.loading,
      ).toBe(false),
    );
    const full = buildDashboardThresholds(
      result.current.full.snapshot.rows,
      result.current.full.thresholds,
    );
    expect(result.current.compact.summary).toEqual(full);
    expect(full).toMatchObject({
      configured: 3,
      unconfigured: 1,
      below: 2,
      above: 1,
    });
    expect(result.current.full.snapshot.rows[0].balance_qty).toBe(8);
    expect(get).toHaveBeenCalledWith(API_ENDPOINTS.INVENTORY_RECONCILIATION, {
      params: { view: "dashboard-thresholds" },
    });
    expect(get).toHaveBeenCalledWith(API_ENDPOINTS.INVENTORY_RECONCILIATION, {
      params: {},
    });

    get.mockRejectedValue(new Error("network unavailable"));
    await act(async () => {
      await result.current.compact.refetch();
    });
    await waitFor(() => expect(result.current.compact.error).toBeTruthy());
    expect(result.current.compact.hasSnapshot).toBe(true);
    expect(result.current.compact.summary).toEqual(full);
  });

  it("accepts an old backend's full response and empty inventory", async () => {
    get.mockImplementation(
      async (url) =>
        (url === API_ENDPOINTS.SKU_LOOKUP
          ? catalog
          : { rows: [], mismatches: [], summary: {} }) as never,
    );
    const { result } = renderHook(() => useDashboardThresholdSource(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary).toMatchObject({
      configured: 3,
      unconfigured: 1,
      below: 2,
      above: 0,
    });
  });

  it("requests compact XNT and retains equation, stock counts and top-SKU results", async () => {
    const lines = [
      {
        product_code: "A",
        product_name: "A",
        opening: 10.5,
        receipt_net: 2,
        issue_net: 3,
        component_issue_net: 0,
        reversal_unlinked_net: -0.5,
        closing: 9,
      },
      {
        product_code: "A",
        product_name: "A",
        opening: -1,
        receipt_net: 0,
        issue_net: 0,
        component_issue_net: 0,
        reversal_unlinked_net: 0,
        closing: -1,
      },
      {
        product_code: "B",
        product_name: "B",
        opening: 0,
        receipt_net: 1,
        issue_net: 0,
        component_issue_net: 1,
        reversal_unlinked_net: 0,
        closing: 0,
      },
    ];
    get.mockImplementation(
      async (url) =>
        (url === API_ENDPOINTS.REPORTS_XNT_ENHANCED ? { lines } : {}) as never,
    );
    const { result } = renderHook(
      () => useOverviewSource({ from: "2026-11-07", to: "2026-11-07" }, true),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.xnt.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith(API_ENDPOINTS.REPORTS_XNT_ENHANCED, {
      params: {
        from_date: "2026-11-07",
        to_date: "2026-11-07",
        view: "dashboard",
      },
    });
    expect(buildEquation(result.current.xnt.data)).toMatchObject({
      opening: 9.5,
      receipt: 3,
      issueProduct: 3,
      issueComponent: 1,
      reversal: -0.5,
      closing: 8,
      difference: 0,
    });
    expect(countSkusInStock(result.current.xnt.data)).toEqual({
      opening: 1,
      closing: 1,
    });
    expect(buildTopSkus(result.current.xnt.data)).toEqual([
      { code: "A", name: "A", value: 3 },
    ]);
  });
});
