import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchDashboardOverview } from "../services/dashboardService";
import type { DashboardOverview } from "../types";
import DashboardPage from "./DashboardPage";

vi.mock("../services/dashboardService", () => ({
  fetchDashboardOverview: vi.fn(),
}));

// jsdom không đo được kích thước SVG (getBBox/getComputedTextLength) nên
// ApexCharts render với width:0 và không data-label nào vào DOM — chart vẫn đúng
// trên trình duyệt thật. Stub tối thiểu render lại series thành text để assertion
// đọc được, và phơi nút giả cho dataPointSelection để test được drilldown.
vi.mock("react-apexcharts", () => ({
  default: ({
    series,
    options,
  }: {
    series: unknown;
    options?: {
      chart?: {
        events?: {
          dataPointSelection?: (
            event: unknown,
            ctx: unknown,
            config: { dataPointIndex: number },
          ) => void;
        };
      };
    };
  }) => {
    const onSelect = options?.chart?.events?.dataPointSelection;
    const values = Array.isArray(series)
      ? series.flatMap((entry) =>
          typeof entry === "number"
            ? [entry]
            : Array.isArray((entry as { data?: unknown[] })?.data)
              ? (entry as { data: unknown[] }).data
              : [],
        )
      : [];
    return (
      <div data-testid="apex-chart-stub">
        {values.map((value, index) => (
          <span key={index}>{String(value)}</span>
        ))}
        {onSelect ? (
          <button
            type="button"
            data-testid="apex-point-0"
            onClick={() => onSelect(null, null, { dataPointIndex: 0 })}
          >
            point-0
          </button>
        ) : null}
      </div>
    );
  },
}));

const mockedFetch = vi.mocked(fetchDashboardOverview);

const today = dayjs().format("YYYY-MM-DD");

const populated: DashboardOverview = {
  period: { from_date: today, to_date: today },
  data_scope: "GLOBAL",
  scope_warehouse_ids: null,
  kpi: {
    on_hand: { product: 800, component: 434, total: 1234 },
    receipt_today: { product: 200, component: 100, total: 300 },
    issue_today: { product: 90, component: 30, total: 120 },
    receipt_month: { product: 1000, component: 500, total: 1500 },
    issue_month: { product: 600, component: 150, total: 750 },
  },
  warranty_received: { today: 3, week: 11, month: 42 },
  top_sku: {
    best: { sku_code: "SKU-A", sku_name: "Máy bơm A", issue_qty: 90 },
    worst: { sku_code: "SKU-Z", sku_name: "Máy bơm Z", issue_qty: 2 },
  },
  flow_daily: [
    {
      date: today,
      receipt_product: 200,
      receipt_component: 100,
      issue_product: 90,
      issue_component: 30,
    },
  ],
  stock_trend: [{ date: today, closing_qty: 1234 }],
  stock_structure: {
    PRODUCT: {
      AVAILABLE: 800,
      NON_SELLABLE: 50,
      DEFECTIVE: 20,
      QUARANTINE: 10,
    },
    COMPONENT: {
      AVAILABLE: 434,
      NON_SELLABLE: 0,
      DEFECTIVE: 0,
      QUARANTINE: 0,
    },
  },
  warranty: {
    by_status: { CHECKING: 3, COMPLETED: 7 },
    overdue_count: 137,
    overdue_sample: [
      {
        warranty_case_code: "WC-001",
        customer_name: "Nguyễn Văn A",
        status: "CHECKING",
        estimated_completion_date: "2026-08-01",
        days_overdue: 28,
      },
    ],
  },
  issues: {
    inventory_mismatch: 5,
    import_error: 2,
    warranty_overdue: 137,
    print_failed: 1,
    sku_pending_info: 4,
  },
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({
    permissionCodes: [],
    isSuperAdmin: false,
    isProfileLoaded: false,
  });
});

describe("DashboardPage — tổng quan", () => {
  it("đổi toggle Sản phẩm/Linh kiện thì KPI đọc đúng nhánh số liệu", async () => {
    mockedFetch.mockResolvedValue(populated);
    renderDashboard();

    const kpi = await screen.findByRole("region", { name: "Chỉ số vận hành" });
    // Mặc định "Sản phẩm & Linh kiện" → dùng total.
    expect(within(kpi).getByText("1.234")).toBeInTheDocument();
    expect(within(kpi).getByText("300")).toBeInTheDocument();

    fireEvent.click(within(kpi).getByRole("button", { name: "Linh kiện" }));

    // Linh kiện → component. 434 và 100 chỉ xuất hiện ở nhánh này.
    expect(within(kpi).getByText("434")).toBeInTheDocument();
    expect(within(kpi).getByText("100")).toBeInTheDocument();
    expect(within(kpi).queryByText("1.234")).not.toBeInTheDocument();
  });

  it("hiển thị tổng thật của ca quá hạn, không lấy độ dài mảng mẫu", async () => {
    mockedFetch.mockResolvedValue(populated);
    renderDashboard();

    // overdue_sample chỉ có 1 phần tử nhưng tổng thật là 137.
    expect(await screen.findByText("137 ca quá hạn")).toBeInTheDocument();
  });

  it("mở được danh sách chi tiết ca bảo hành quá hạn", async () => {
    mockedFetch.mockResolvedValue(populated);
    renderDashboard();

    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("WC-001")).toBeInTheDocument();
    expect(within(dialog).getByText("28 ngày")).toBeInTheDocument();
  });

  it("đổi kỳ biểu đồ nhập-xuất thì gọi lại API với khoảng ngày mới", async () => {
    mockedFetch.mockResolvedValue(populated);
    renderDashboard();

    await screen.findByRole("region", { name: "Chỉ số vận hành" });
    const startOfWeek = dayjs().startOf("week").format("YYYY-MM-DD");
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.objectContaining({ from_date: startOfWeek }),
    );

    const group = screen.getByRole("group", {
      name: "Chọn kỳ xem biểu đồ nhập xuất",
    });
    fireEvent.click(within(group).getByRole("button", { name: "Năm này" }));

    const startOfYear = dayjs().startOf("year").format("YYYY-MM-DD");
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.objectContaining({ from_date: startOfYear }),
    );
  });

  it("không gọi API báo cáo khi profile đã tải mà thiếu report.view", () => {
    useAuthStore.setState({
      isProfileLoaded: true,
      isSuperAdmin: false,
      permissionCodes: ["inventory.view"],
    });

    renderDashboard();

    expect(
      screen.getByText(
        "Vui lòng liên hệ quản trị viên nếu bạn cần quyền truy cập.",
      ),
    ).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("lỗi 403 thì không lộ bất kỳ số liệu nào", async () => {
    // src/test/setup.ts mock axios toàn cục với isAxiosError luôn trả false, nên
    // nhánh phân loại theo HTTP status không bao giờ chạy. Cài lại đúng hành vi
    // thật của axios (nhận diện theo cờ trên chính object lỗi) cho test này.
    vi.mocked(isAxiosError).mockImplementation(
      (payload: unknown): payload is never =>
        Boolean(
          payload &&
          typeof payload === "object" &&
          (payload as { isAxiosError?: boolean }).isAxiosError === true,
        ),
    );
    mockedFetch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
    });

    renderDashboard();

    expect(
      await screen.findByText("Bạn không có quyền xem báo cáo tổng quan."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Chỉ số vận hành" }),
    ).not.toBeInTheDocument();
  });
});
