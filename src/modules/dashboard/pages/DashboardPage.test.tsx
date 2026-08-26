import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchDashboardKPI } from "../services/dashboardService";
import type { DashboardKPI } from "../types";
import DashboardPage from "./DashboardPage";

vi.mock("../services/dashboardService", () => ({
  fetchDashboardKPI: vi.fn(),
}));

const mockedFetchDashboardKPI = vi.mocked(fetchDashboardKPI);

const populatedDashboard: DashboardKPI = {
  period: { from_date: "2026-07-19", to_date: "2026-08-18" },
  data_scope: "GLOBAL",
  scope_warehouse_ids: null,
  available_qty: 1234,
  receipt_qty: 300,
  issue_qty: 120,
  component_issue_qty: 25,
  reversal_net: -5,
  warranty_cases_by_status: { CHECKING: 3, COMPLETED: 7 },
  reconciliation_warning_count: 1,
  reconciliation_warnings: [{ product_id: "p-1" }],
};

const emptyDashboard: DashboardKPI = {
  period: { from_date: "2026-07-19", to_date: "2026-08-18" },
  data_scope: "GLOBAL",
  scope_warehouse_ids: null,
  available_qty: 0,
  receipt_qty: 0,
  issue_qty: 0,
  component_issue_qty: 0,
  reversal_net: 0,
  warranty_cases_by_status: {},
  reconciliation_warning_count: 0,
  reconciliation_warnings: [],
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
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

describe("DashboardPage / WWHN-327", () => {
  it("renders KPI and optional chart from the real aggregate response", async () => {
    mockedFetchDashboardKPI.mockResolvedValue(populatedDashboard);

    renderDashboard();

    const kpiRegion = await screen.findByRole("region", {
      name: "Chỉ số vận hành",
    });
    expect(within(kpiRegion).getByText("1.234")).toBeInTheDocument();
    expect(within(kpiRegion).getByText("300")).toBeInTheDocument();
    expect(within(kpiRegion).getByText("120")).toBeInTheDocument();
    expect(within(kpiRegion).getByText("25")).toBeInTheDocument();
    expect(within(kpiRegion).getByText("-5")).toBeInTheDocument();

    const chartRegion = screen.getByRole("region", {
      name: "Biểu đồ tổng quan",
    });
    expect(within(chartRegion).getByText("300")).toBeInTheDocument();
    expect(within(chartRegion).getByText("-5")).toBeInTheDocument();

    expect(
      within(chartRegion).getByRole("img", {
        name: "Biểu đồ luồng kho từ 19-7-2026 đến 18-8-2026: Nhập kho 300; Xuất kho 120; Xuất linh kiện 25; Điều chỉnh tồn (ròng) -5",
      }),
    ).toBeInTheDocument();

    expect(within(chartRegion).getByText("3")).toBeInTheDocument();
    expect(within(chartRegion).getByText("7")).toBeInTheDocument();
    expect(within(chartRegion).getByText("1 cảnh báo")).toBeInTheDocument();
    expect(mockedFetchDashboardKPI).toHaveBeenCalledWith({});
  });

  it("renders an explicit empty state instead of fabricated chart data", async () => {
    mockedFetchDashboardKPI.mockResolvedValue(emptyDashboard);

    renderDashboard();

    expect(
      await screen.findByText("Không có số liệu trong kỳ."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /Biểu đồ luồng kho/i }),
    ).not.toBeInTheDocument();
  });

  it("does not expose backend/API implementation language to operators", async () => {
    mockedFetchDashboardKPI.mockResolvedValue(populatedDashboard);

    renderDashboard();
    await screen.findByRole("region", { name: "Chỉ số vận hành" });

    const visibleText = document.body.textContent ?? "";
    for (const forbidden of [
      "Mặc định BE",
      "Kỳ BE",
      "backend authoritative",
      "/reports/dashboard-quick",
      "occurred_at",
      "scope_type",
      "wireframe",
    ]) {
      expect(visibleText).not.toContain(forbidden);
    }
  });

  it("does not call report API when the loaded profile lacks report.view", () => {
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
    expect(mockedFetchDashboardKPI).not.toHaveBeenCalled();
  });

  it("shows the warehouse data scope returned by the aggregate contract", async () => {
    mockedFetchDashboardKPI.mockResolvedValue({
      ...populatedDashboard,
      data_scope: "WAREHOUSE_SCOPED",
      scope_warehouse_ids: ["wh-1", "wh-2"],
    });

    renderDashboard();

    expect(
      await screen.findByText(
        /Phạm vi dữ liệu:\s*Theo 2 kho bạn được phân quyền/,
      ),
    ).toBeInTheDocument();
  });

  it("declares the warranty global exception when the payload is warehouse-scoped", async () => {
    mockedFetchDashboardKPI.mockResolvedValue({
      ...populatedDashboard,
      data_scope: "WAREHOUSE_SCOPED",
      scope_warehouse_ids: ["wh-1"],
    });

    renderDashboard();

    const exception = await screen.findByRole("note");
    expect(exception).toHaveTextContent(/bảo hành được tổng hợp toàn hệ thống/i);
    expect(exception).toHaveTextContent(/không giới hạn theo kho/i);
  });

  it("does not show the warranty scope exception on a global payload", async () => {
    mockedFetchDashboardKPI.mockResolvedValue(populatedDashboard);

    renderDashboard();

    await screen.findByRole("region", { name: "Chỉ số vận hành" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("counts reconciliation warnings from the total, not from the capped sample", async () => {
    mockedFetchDashboardKPI.mockResolvedValue({
      ...populatedDashboard,
      reconciliation_warning_count: 137,
      reconciliation_warnings: [{ product_id: "p-1" }, { product_id: "p-2" }],
    });

    renderDashboard();

    const chartRegion = await screen.findByRole("region", {
      name: "Biểu đồ tổng quan",
    });
    expect(within(chartRegion).getByText("137 cảnh báo")).toBeInTheDocument();
  });
});
