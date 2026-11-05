import { afterEach, describe, expect, it, vi } from "vitest";
import dayjs from "dayjs";
import { fireEvent, screen, within } from "@testing-library/react";
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

  it("opens quantity detail and SKU movements, then returns to the report", async () => {
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
    const reportPage = screen.getByRole("main");
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
      await screen.findByTestId("stock-reconcile-drilldown"),
    ).toBeInTheDocument();
    const drawer = screen.getByRole("dialog", {
      name: /Chi tiết chênh lệch tồn/,
    });
    expect(drawer.closest(".MuiDrawer-root")).toBeInTheDocument();
    expect(reportPage).toBeInTheDocument();
    expect(
      within(drawer).getByRole("heading", { name: /Chi tiết chênh lệch tồn/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/chưa trả danh sách mã chênh lệch/),
    ).toBeInTheDocument();
    expect(useSkuMovements).toHaveBeenCalledWith("HN-DRV-001", {
      from: dayjs().subtract(6, "day").format("YYYY-MM-DD"),
      to: dayjs().format("YYYY-MM-DD"),
    });
    fireEvent.click(
      await within(drawer).findByRole("button", {
        name: /Xem phát sinh theo SKU/,
      }),
    );
    expect(
      screen.getByRole("heading", { name: /Phát sinh theo SKU/ }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Quay lại báo cáo/ })[0],
    );
    expect(
      screen.getByRole("tab", { name: "Đối soát tồn" }),
    ).toBeInTheDocument();
  });

  it("switches detail tables and collapses the section to its title", () => {
    vi.mocked(useSkuMovements).mockReturnValue({
      events: [],
      loading: false,
    } as never);
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
    fireEvent.click(
      screen.getByRole("button", {
        name: /Mở rộng Chi tiết tồn kho & đối soát/,
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Đối soát tồn" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Xem bằng chứng HN-ONLY-001/ }),
    );
    expect(
      screen.getByRole("heading", { name: /Chi tiết đối soát mã/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SN-SEN-/)).not.toBeInTheDocument();
  });
  it("keeps pagination valid when changing page size and filtering", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      warehouse_code: "HN01",
      sku_code: `PAGE-${String(index + 1).padStart(2, "0")}`,
      sku_name: "Hàng phân trang",
      sku_type: index === 24 ? "COMPONENT" : "PRODUCT",
      opening: 1,
      receipt_net: 0,
      issue_net: 0,
      component_issue_net: 0,
      reversal_unlinked_net: 0,
      closing: 1,
      matched: true,
    }));
    vi.mocked(useInventoryFlowSnapshot).mockReturnValue({
      snapshot: { rows, daily: [], ledger: [], documents: [] },
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useStockReconcileSnapshot).mockReturnValue({
      snapshot: { rows: [] },
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<StockReconcileReport />);
    const pageSize = screen.getByRole("combobox", {
      name: "Số dòng mỗi trang",
    });
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(
      screen.getByRole("button", { name: /Xem bằng chứng PAGE-11/ }),
    ).toBeInTheDocument();
    fireEvent.change(pageSize, { target: { value: "20" } });
    expect(
      screen.getByRole("button", { name: /Xem bằng chứng PAGE-01/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Xem bằng chứng PAGE-20/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    fireEvent.click(
      screen.getByRole("combobox", { name: "Chọn nhóm hàng / SKU" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Linh kiện" }));
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(
      screen.getByRole("button", { name: /Xem bằng chứng PAGE-25/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  });
});
