import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStockReconcileSnapshot } from "@/modules/reports/stock-reconcile/stock-reconcile-api";
import { DashboardSystemViews } from "./DashboardSystemViews";
import { SnapshotThresholdSummary } from "./SnapshotThresholdSummary";
import { buildDashboardThresholds } from "./dashboard-threshold-model";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";

vi.mock("@/modules/reports/stock-reconcile/stock-reconcile-api", () => ({
  useStockReconcileSnapshot: vi.fn(),
}));
vi.mock("./use-dashboard-threshold-source", () => ({
  useDashboardThresholdSource: () => {
    const current = useStockReconcileSnapshot({ asOf: "" });
    return {
      summary: buildDashboardThresholds(
        current.snapshot.rows,
        current.thresholds,
      ),
      loading: current.loading,
      error: current.error,
      hasSnapshot:
        Boolean(current.snapshot.as_of) && current.thresholds.size > 0,
      refetch: current.refetch,
    };
  },
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

afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});

describe("snapshot threshold localization", () => {
  it("updates notes, counts and detail links while mounted", async () => {
    mockedSource.mockReturnValue(source() as never);
    const navigate = vi.fn();
    render(<SnapshotThresholdSummary onNavigate={navigate} />);
    expect(screen.getByText("SKU đã cấu hình")).toBeInTheDocument();
    await act(async () => {
      useLanguageStore.getState().setLanguage("en");
      await ensureEnglishMessages();
    });
    for (const label of [
      "Only SKUs with a minimum or maximum are evaluated.",
      "Configured SKUs",
      "Unconfigured SKUs",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const name of [
      /^Below threshold\s*1$/,
      /^Above threshold\s*1$/,
      "View detail",
    ]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(navigate).toHaveBeenLastCalledWith(
        "/reports/stock-reconcile?screen=RPT-02",
      );
    }
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(screen.getByText("SKU đã cấu hình")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Dưới định mức\s*1$/ }),
    ).toBeInTheDocument();
  });

  it.each([
    ["loading", "Đang tải định mức…", "Loading stock thresholds…"],
    ["error", "Không tải được định mức.", "Could not load stock thresholds."],
    ["stale", "Định mức có thể đã cũ.", "Stock thresholds may be out of date."],
  ])(
    "updates the %s message and retry control while mounted",
    async (state, vietnamese, english) => {
      retry.mockReset();
      mockedSource.mockReturnValue({
        ...source(state === "loading" ? null : new Error("offline")),
        loading: state === "loading",
        thresholds: state === "error" ? new Map() : source().thresholds,
      } as never);
      render(<SnapshotThresholdSummary onNavigate={vi.fn()} />);
      expect(screen.getByText(vietnamese)).toBeInTheDocument();
      await act(async () => {
        useLanguageStore.getState().setLanguage("en");
        await ensureEnglishMessages();
      });
      expect(screen.getByText(english)).toBeInTheDocument();
      if (state !== "loading") {
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(retry).toHaveBeenCalledOnce();
      }
      act(() => useLanguageStore.getState().setLanguage("vi"));
      expect(screen.getByText(vietnamese)).toBeInTheDocument();
    },
  );
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
      within(table).getByRole("columnheader", { name: "#" }),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Hiển thị 1–10 / 25 SKU")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /page 2|trang 2/i }));
    expect(screen.getByText("Hiển thị 11–20 / 25 SKU")).toBeInTheDocument();
    expect(
      within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[0],
    ).toHaveTextContent("11");
    expect(within(table).queryByText("SKU-01")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText("Số dòng mỗi trang"));
    fireEvent.click(screen.getByRole("option", { name: "20 / trang" }));
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

describe("dashboard system view English localization", () => {
  it("switches threshold filters, details and hints while mounted and preserves SKU data", async () => {
    mockedSource.mockReturnValue(source() as never);
    render(<DashboardSystemViews view="thresholds" onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "SP-001" }));
    await act(async () => {
      useLanguageStore.getState().setLanguage("en");
      await ensureEnglishMessages();
    });
    expect(
      screen.getByPlaceholderText("Search SKU code or name"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Filter stock threshold status"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Stock threshold details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Below minimum by 2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Check demand and stock before transferring or replenishing.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Máy bơm Hoa Nam").length).toBeGreaterThan(0);
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(
      screen.getByPlaceholderText("Tìm mã hoặc tên SKU"),
    ).toBeInTheDocument();
  });

  it("localizes stale and failure notices with their retry controls", async () => {
    mockedSource.mockReturnValue(source(new Error("offline")) as never);
    render(<DashboardSystemViews view="work" onNavigate={vi.fn()} />);
    await act(async () => {
      useLanguageStore.getState().setLanguage("en");
      await ensureEnglishMessages();
    });
    expect(
      screen.getByRole("heading", { name: "Work to resolve" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Displayed data may be out of date. The latest refresh did not finish.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  });
});
