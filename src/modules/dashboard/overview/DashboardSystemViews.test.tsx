import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStockReconcileSnapshot } from "@/modules/reports/stock-reconcile/stock-reconcile-api";
import { DashboardSystemViews } from "./DashboardSystemViews";

vi.mock("@/modules/reports/stock-reconcile/stock-reconcile-api", () => ({
  useStockReconcileSnapshot: vi.fn(),
}));
vi.mock("@/modules/reports/inventory-flow/inventory-flow-api", () => ({
  useInventoryFlowSnapshot: vi.fn(),
}));

const mockedSource = vi.mocked(useStockReconcileSnapshot);
const retry = vi.fn();
const source = (error: unknown = null) => ({
  snapshot: {
    as_of: "2026-11-02T14:30:00+07:00",
    rows: [
      {
        sku_code: "SP-001",
        sku_name: "Máy bơm Hoa Nam",
        item_kind: "PRODUCT",
        available_qty: 3,
      },
      {
        sku_code: "LK-002",
        sku_name: "Bộ điều khiển",
        item_kind: "COMPONENT",
        available_qty: 12,
      },
    ],
  },
  thresholds: new Map([
    ["SP-001", { min_qty: 5, max_qty: null }],
    ["LK-002", { min_qty: null, max_qty: 10 }],
    ["LK-003", { min_qty: null, max_qty: null }],
  ]),
  loading: false,
  fetching: false,
  error,
  refetch: retry,
});

describe("DashboardSystemViews — định mức tồn", () => {
  beforeEach(() => {
    retry.mockReset();
    mockedSource.mockReturnValue(source() as never);
  });

  it("chỉ giữ SKU trong bộ lọc ở cả bảng và chi tiết đang chọn", () => {
    render(
      <DashboardSystemViews
        view="thresholds"
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Lọc trạng thái định mức"), {
      target: { value: "high" },
    });
    const table = screen.getByRole("table");
    expect(within(table).getByText("LK-002")).toBeInTheDocument();
    expect(within(table).queryByText("SP-001")).not.toBeInTheDocument();
    expect(screen.getByText("Vượt 2")).toBeInTheDocument();
  });

  it("giữ dữ liệu cũ và cho thử lại khi cập nhật thất bại", () => {
    mockedSource.mockReturnValue(source(new Error("network")) as never);
    render(
      <DashboardSystemViews
        view="thresholds"
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("có thể đã cũ");
    fireEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("không coi danh mục SKU tải lỗi là 0 cảnh báo", () => {
    mockedSource.mockReturnValue({
      ...source(new Error("catalog")),
      thresholds: new Map(),
    } as never);
    render(
      <DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Không tải được số liệu",
    );
  });
});
