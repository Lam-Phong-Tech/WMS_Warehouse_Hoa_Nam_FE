import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock(
  "@/modules/reports/inventory-flow/inventory-flow-api",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useInventoryFlowSnapshot: vi.fn(),
  }),
);
vi.mock("./stock-reconcile-api", () => ({
  useStockReconcileSnapshot: vi.fn(),
  useSkuMovements: vi.fn(),
}));

import { useInventoryFlowSnapshot } from "@/modules/reports/inventory-flow/inventory-flow-api";
import {
  useSkuMovements,
  useStockReconcileSnapshot,
} from "./stock-reconcile-api";
import StockReconcileReport from "./StockReconcileReport";

describe("stock reconciliation evidence navigation", () => {
  afterEach(cleanupTestState);

  it("opens evidence for the chosen SKU without changing the report filter", async () => {
    vi.mocked(useInventoryFlowSnapshot).mockReturnValue({
      snapshot: {
        rows: [
          {
            warehouse_code: "HN01",
            sku_code: "HN-DRV-001",
            sku_name: "Bộ điều khiển động cơ",
            sku_type: "PRODUCT",
            opening: 100,
            receipt_net: 5,
            issue_net: 15,
            component_issue_net: 0,
            reversal_unlinked_net: 2,
            closing: 92,
            matched: false,
          },
        ],
        daily: [],
        ledger: [],
        documents: [],
      },
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useStockReconcileSnapshot).mockReturnValue({
      snapshot: {
        rows: [
          {
            warehouse_code: "HN01",
            sku_code: "HN-DRV-001",
            sku_name: "Bộ điều khiển động cơ",
            item_kind: "PRODUCT",
            balance_qty: 90,
            ledger_qty: 92,
            delta_qty: -2,
            reconciliation_status: "MISMATCH",
            mismatch_checks: ["ledger_to_balance"],
          },
        ],
      },
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useSkuMovements).mockReturnValue({
      events: [],
      loading: false,
    } as never);

    renderWithProviders(<StockReconcileReport />);
    expect(screen.getByRole("tab", { name: "Đối soát tồn" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("columnheader", { name: "Tồn sổ" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lệch số lượng")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: /Xem bằng chứng HN-DRV-001/ }),
    );

    expect(
      await screen.findByRole("dialog", { name: /HN-DRV-001/ }),
    ).toBeInTheDocument();
    expect(useSkuMovements).toHaveBeenCalledWith("HN-DRV-001");
  });

  it("switches detail tables and collapses the section to its title", () => {
    vi.mocked(useInventoryFlowSnapshot).mockReturnValue({
      snapshot: {
        rows: [
          {
            warehouse_code: "HN01",
            sku_code: "HN-ONLY-001",
            sku_name: "Hàng đối soát",
            sku_type: "PRODUCT",
            opening: 5,
            receipt_net: 0,
            issue_net: 0,
            component_issue_net: 0,
            reversal_unlinked_net: 0,
            closing: 5,
            matched: false,
          },
        ],
        daily: [],
        ledger: [],
        documents: [],
      },
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useStockReconcileSnapshot).mockReturnValue({
      snapshot: {
        rows: [
          {
            warehouse_code: "HN01",
            sku_code: "HN-ONLY-001",
            sku_name: "Hàng đối soát",
            item_kind: "PRODUCT",
            balance_qty: 5,
            ledger_qty: 5,
            delta_qty: 0,
            reconciliation_status: "MISMATCH",
            mismatch_checks: ["serial_subledger"],
          },
        ],
      },
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<StockReconcileReport />);

    expect(screen.getAllByRole("button", { name: /^Thu gọn/ })).toHaveLength(3);
    expect(screen.getByText("Lệch mã")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Nhập – Xuất – Tồn" }));
    expect(
      screen.getByRole("columnheader", { name: "Tồn đầu" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Tồn sổ" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Thu gọn Chi tiết tồn kho & đối soát/,
      }),
    );
    expect(
      screen.queryByRole("columnheader", { name: "Tồn đầu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Mở rộng Chi tiết tồn kho & đối soát/,
      }),
    ).toBeInTheDocument();
  });
});
