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
import dayjs from "dayjs";

vi.mock("@/shared/api/http", () => ({
  http: { get: vi.fn(), getPage: vi.fn(), post: vi.fn() },
}));

import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { OPERATIONS_REPORT_ENDPOINTS } from "@/modules/reports/operations/report-data";
import { useAuthStore } from "@/shared/store/auth.store";
import DashboardPage from "./DashboardPage";

/**
 * Màn "Tổng quan vận hành" dựng theo demo UI/UX, đọc từ BỐN nguồn thật. Test ở
 * đây khoá đúng những điều dễ vỡ khi ai đó sửa layout: KPI phải đổi nhánh theo
 * bộ lọc loại hàng, tổng quá hạn phải là tổng THẬT (không phải độ dài mảng mẫu),
 * đẳng thức đối soát phải cộng từ sổ XNT, và không có quyền thì không rò số nào.
 */

const today = dayjs().format("YYYY-MM-DD");
const mockedGet = vi.mocked(http.get);

const overview = {
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
  top_sku: { best: null, worst: null },
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

const xnt = {
  lines: [
    {
      product_code: "SKU-A",
      product_name: "Máy bơm A",
      opening: 1000,
      receipt_net: 300,
      issue_net: 90,
      component_issue_net: 30,
      reversal_unlinked_net: 0,
      closing: 1180,
    },
    {
      product_code: "SKU-B",
      product_name: "Máy bơm B",
      opening: 54,
      receipt_net: 0,
      issue_net: 0,
      component_issue_net: 0,
      reversal_unlinked_net: 0,
      closing: 54,
    },
  ],
};

const xntDaily = {
  days: [
    {
      date: today,
      inbound_qty: 300,
      outbound_qty: 120,
      reversal_net: 0,
      closing_qty: 1234,
    },
  ],
};

const quick = { below_min_stock_count: 14, above_max_stock_count: 4 };

function routeResponses(url: string) {
  if (url === API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW)
    return Promise.resolve(overview);
  if (url === API_ENDPOINTS.REPORTS_XNT_ENHANCED) return Promise.resolve(xnt);
  if (url === OPERATIONS_REPORT_ENDPOINTS.XNT_DAILY)
    return Promise.resolve(xntDaily);
  if (url === API_ENDPOINTS.DASHBOARD_KPI) return Promise.resolve(quick);
  return Promise.reject(new Error(`unexpected url ${url}`));
}

// Cùng một con số còn xuất hiện ở khối đối soát, biểu đồ và bảng dữ liệu thay
// thế, nên các assertion về KPI đều thu hẹp phạm vi vào #kpi-grid.
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

describe("DashboardPage — Tổng quan vận hành", () => {
  it("đổi bộ lọc Loại hàng thì KPI đọc đúng nhánh và ẩn thẻ không còn nghĩa", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    // Mặc định "Toàn bộ" → dùng total của on_hand.
    expect(await screen.findByText("Xuất sản phẩm đã Post")).toBeInTheDocument();
    const grid = document.querySelector("#kpi-grid") as HTMLElement;
    expect(within(grid).getByText("1.234")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Linh kiện" }));

    // Linh kiện → nhánh component; thẻ xuất sản phẩm biến mất đúng như demo.
    expect(within(grid).getByText("434")).toBeInTheDocument();
    expect(within(grid).queryByText("1.234")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Xuất sản phẩm đã Post"),
    ).not.toBeInTheDocument();
  });

  it("hiển thị tổng thật của ca quá hạn, không lấy độ dài mảng mẫu", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    // overdue_sample chỉ có 1 phần tử nhưng tổng thật là 137.
    expect(await screen.findByText("137 quá hạn")).toBeInTheDocument();
    expect(await screen.findByText("28 ngày")).toBeInTheDocument();
  });

  it("đối soát tồn cộng từ sổ XNT và báo chênh lệch đo được", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    const status = await screen.findByRole("status", {
      name: "Đã khớp · Chênh lệch 0",
    });
    expect(status).toBeInTheDocument();
    // 1000 + 54 = 1054 tồn đầu kỳ; 1180 + 54 = 1234 tồn cuối kỳ.
    const card = document.querySelector("#equation-card") as HTMLElement;
    expect(within(card).getByText("1.054")).toBeInTheDocument();
    expect(within(card).getByText("1.234")).toBeInTheDocument();
  });

  it("thẻ định mức đọc số dưới/vượt ngưỡng từ dashboard-quick", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    expect(
      await screen.findByLabelText("Tồn dưới định mức: 14 SKU"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Tồn vượt định mức: 4 SKU"),
    ).toBeInTheDocument();
  });

  it("không gọi API báo cáo khi profile đã tải mà thiếu report.view", () => {
    useAuthStore.setState({
      isProfileLoaded: true,
      isSuperAdmin: false,
      permissionCodes: ["inventory.view"],
    });

    renderDashboard();

    expect(screen.getByText("Giới hạn quyền")).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
    // Không có widget nào lộ số liệu.
    expect(screen.queryByText("1.234")).not.toBeInTheDocument();
  });

  it("lỗi nguồn đọc chính thì không thay số liệu bằng 0", async () => {
    mockedGet.mockImplementation((url: string) =>
      url === API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW
        ? Promise.reject(new Error("boom"))
        : routeResponses(url),
    );

    renderDashboard();

    expect(await screen.findByText("Lỗi nguồn đọc")).toBeInTheDocument();
    expect(
      screen.getByText("Không thể tải Tổng tồn khả dụng"),
    ).toBeInTheDocument();
    // Lưới KPI không có con số nào — không thay dữ liệu lỗi bằng 0.
    const grid = document.querySelector("#kpi-grid") as HTMLElement;
    expect(within(grid).queryByText("1.234")).not.toBeInTheDocument();
    expect(within(grid).queryByText("0")).not.toBeInTheDocument();
  });

  it("đổi kỳ KPI thì gọi lại các nguồn với khoảng ngày mới", async () => {
    mockedGet.mockImplementation((url: string) => routeResponses(url));
    renderDashboard();

    await screen.findByText("Xuất sản phẩm đã Post");
    expect(mockedGet).toHaveBeenCalledWith(
      API_ENDPOINTS.REPORTS_XNT_ENHANCED,
      expect.objectContaining({
        params: { from_date: today, to_date: today },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "7 ngày gần nhất" }));

    const from = dayjs().subtract(6, "day").format("YYYY-MM-DD");
    expect(mockedGet).toHaveBeenCalledWith(
      API_ENDPOINTS.REPORTS_XNT_ENHANCED,
      expect.objectContaining({ params: { from_date: from, to_date: today } }),
    );
  });
});
