import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useInventoryFlowSnapshot } from "../inventory-flow/inventory-flow-api";
import { useStockReconcileSnapshot } from "./stock-reconcile-api";
import StockReconcileReport from "./StockReconcileReport";

vi.mock("../inventory-flow/inventory-flow-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useInventoryFlowSnapshot: vi.fn(),
}));
vi.mock("./stock-reconcile-api", () => ({
  useStockReconcileSnapshot: vi.fn(),
}));

function mockRows(withFlow = true, withStock = true) {
  vi.mocked(useInventoryFlowSnapshot).mockReturnValue({
    snapshot: {
      rows: withFlow
        ? [
            {
              warehouse_code: "HN01",
              sku_code: "SKU-01",
              sku_name: "Hàng kiểm tra",
              sku_type: "PRODUCT",
              opening: 5,
              receipt_net: 0,
              issue_net: 0,
              component_issue_net: 0,
              reversal_unlinked_net: 0,
              closing: 5,
              matched: true,
            },
          ]
        : [],
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
      rows: withStock
        ? [
            {
              warehouse_code: "HN01",
              sku_code: "SKU-01",
              sku_name: "Hàng kiểm tra",
              item_kind: "PRODUCT",
              balance_qty: 5,
              ledger_qty: 5,
              delta_qty: 0,
              reconciliation_status: "MATCH",
              mismatch_checks: [],
            },
          ]
        : [],
    },
    loading: false,
    fetching: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

describe("stock report empty-state actions", () => {
  beforeEach(() => mockRows());
  afterEach(cleanupTestState);

  it.each(["empty report", "empty search"])(
    "opens the date picker from %s and applies the chosen range",
    async (state) => {
      if (state === "empty report") mockRows(false, false);
      renderWithProviders(<StockReconcileReport />);
      if (state === "empty search") {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "missing" },
        });
      }
      fireEvent.click(
        screen.getByRole("button", { name: "Đổi khoảng thời gian" }),
      );
      const calendar = await screen.findByRole("dialog");
      fireEvent.click(
        within(calendar).getByRole("button", { name: "Hôm qua" }),
      );
      const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      expect(useInventoryFlowSnapshot).toHaveBeenLastCalledWith({
        from: yesterday,
        to: yesterday,
      });
      expect(useStockReconcileSnapshot).toHaveBeenLastCalledWith({
        asOf: yesterday,
      });
    },
  );

  it("clears search and restores the SKU table", () => {
    renderWithProviders(<StockReconcileReport />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(input).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /Xem bằng chứng SKU-01/ }),
    ).toBeInTheDocument();
  });

  it("clears review filters in both the table and filter controls", () => {
    renderWithProviders(<StockReconcileReport />);
    fireEvent.click(
      screen.getByRole("combobox", { name: "Chọn trạng thái đối soát" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Cần kiểm tra" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Chỉ xem SKU cần kiểm tra" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(
      screen.getByRole("combobox", { name: "Chọn trạng thái đối soát" }),
    ).toHaveTextContent("Tất cả");
    expect(
      screen.getByRole("button", { name: /Xem bằng chứng SKU-01/ }),
    ).toBeInTheDocument();
    // A later date change must not reapply the stale MISMATCH draft.
    fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
    fireEvent.click(screen.getByRole("button", { name: "Hôm qua" }));
    expect(
      screen.getByRole("button", { name: /Xem bằng chứng SKU-01/ }),
    ).toBeInTheDocument();
  });

  it("shows a period empty state without an ineffective clear-search action when only reconciliation has rows", () => {
    mockRows(false);
    renderWithProviders(<StockReconcileReport />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Chỉ xem SKU cần kiểm tra" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Nhập – Xuất – Tồn" }));
    expect(
      screen.getByText("Chưa có dữ liệu Nhập – Xuất – Tồn trong kỳ này"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xóa tìm kiếm" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Đổi khoảng thời gian" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
