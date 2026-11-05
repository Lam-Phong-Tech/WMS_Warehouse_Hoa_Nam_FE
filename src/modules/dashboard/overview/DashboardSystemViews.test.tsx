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

  it("chỉ mở chi tiết sau khi chọn SKU và bỏ chọn khi đổi bộ lọc", () => {
    render(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);

    expect(
      screen.queryByRole("region", { name: "Chi tiết định mức" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Chi tiết định mức" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Vượt 2")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Lọc trạng thái định mức"), {
      target: { value: "high" },
    });
    const table = screen.getByRole("table");
    expect(within(table).getByText("LK-002")).toBeInTheDocument();
    expect(within(table).queryByText("SP-001")).not.toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button", { name: "LK-002" }));
    expect(screen.getByText("Vượt 2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lọc trạng thái định mức"), {
      target: { value: "low" },
    });
    expect(
      screen.queryByRole("region", { name: "Chi tiết định mức" }),
    ).not.toBeInTheDocument();
  });

  it("phân trang đầy đủ, STT liên tục và đổi cỡ trang về trang đầu", () => {
    const records = Array.from({ length: 25 }, (_, i) => ({
      sku_code: `SKU-${String(i + 1).padStart(2, "0")}`,
      sku_name: `Sản phẩm ${i + 1}`,
      item_kind: "PRODUCT",
      available_qty: 3,
    }));
    mockedSource.mockReturnValue({
      ...source(),
      snapshot: { ...source().snapshot, rows: records },
      thresholds: new Map(
        records.map((row) => [row.sku_code, { min_qty: 5, max_qty: 10 }]),
      ),
    } as never);
    render(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "STT" }),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Hiển thị 1–10 / 25 SKU")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /page 2|trang 2/i }));
    expect(screen.getByText("Hiển thị 11–20 / 25 SKU")).toBeInTheDocument();
    expect(
      within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[0],
    ).toHaveTextContent("11");
    expect(within(table).queryByText("SKU-01")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Số dòng mỗi trang"), {
      target: { value: "20" },
    });
    expect(screen.getByText("Hiển thị 1–20 / 25 SKU")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(21);
  });

  it("tìm kiếm tự lọc và xóa lọc khôi phục danh sách, không tự mở chi tiết", () => {
    render(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "SP-001" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Tìm mã hoặc tên SKU" }),
      { target: { value: "không có SKU" } },
    );
    expect(screen.getByText("Hiển thị 0–0 / 0 SKU")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Chi tiết định mức" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(screen.getByText("Hiển thị 1–2 / 2 SKU")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Chi tiết định mức" }),
    ).not.toBeInTheDocument();
  });

  it("giữ dữ liệu cũ và cho thử lại khi cập nhật thất bại", () => {
    mockedSource.mockReturnValue(source(new Error("network")) as never);
    render(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("có thể đã cũ");
    fireEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("đóng chi tiết trả focus về SKU đã mở và giữ bộ lọc", () => {
    const navigate = vi.fn();
    render(<DashboardSystemViews view="thresholds" onNavigate={navigate} />);
    const opener = screen.getByRole("button", { name: "SP-001" });
    fireEvent.click(opener);
    const detail = screen.getByRole("region", { name: "Chi tiết định mức" });
    expect(within(detail).getByRole("heading")).toHaveFocus();
    fireEvent.click(
      within(detail).getByRole("button", { name: "Xem tồn kho" }),
    );
    expect(navigate).toHaveBeenCalledWith("/inventory");
    fireEvent.click(
      within(detail).getByRole("button", { name: "Đóng chi tiết định mức" }),
    );
    expect(opener).toHaveFocus();
    expect(screen.getByLabelText("Lọc trạng thái định mức")).toHaveValue(
      "alerts",
    );
  });

  it("thu hẹp rồi mở rộng dữ liệu không tự nhảy trang hoặc mở lại chi tiết", () => {
    const records = Array.from({ length: 25 }, (_, i) => ({
      sku_code: `SKU-${String(i + 1).padStart(2, "0")}`,
      sku_name: "Sản phẩm",
      item_kind: "PRODUCT",
      available_qty: 3,
    }));
    const makeSource = (count: number) => ({
      ...source(),
      snapshot: { ...source().snapshot, rows: records.slice(0, count) },
      thresholds: new Map(
        records
          .slice(0, count)
          .map((row) => [row.sku_code, { min_qty: 5, max_qty: 10 }]),
      ),
    });
    mockedSource.mockReturnValue(makeSource(25) as never);
    const { rerender } = render(
      <DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /page 3|trang 3/i }));
    fireEvent.click(screen.getByRole("button", { name: "SKU-21" }));
    mockedSource.mockReturnValue(makeSource(15) as never);
    rerender(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);
    expect(screen.getByText("Hiển thị 11–15 / 15 SKU")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Chi tiết định mức" }),
    ).not.toBeInTheDocument();
    mockedSource.mockReturnValue(makeSource(25) as never);
    rerender(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);
    expect(screen.getByText("Hiển thị 11–20 / 25 SKU")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /page 3|trang 3/i }));
    expect(
      screen.queryByRole("region", { name: "Chi tiết định mức" }),
    ).not.toBeInTheDocument();
  });

  it("không coi danh mục SKU tải lỗi là 0 cảnh báo", () => {
    mockedSource.mockReturnValue({
      ...source(new Error("catalog")),
      thresholds: new Map(),
    } as never);
    render(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Không tải được số liệu",
    );
  });
});
