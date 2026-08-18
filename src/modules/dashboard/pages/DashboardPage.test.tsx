import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
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
  available_qty: 1234,
  receipt_qty: 300,
  issue_qty: 120,
  component_issue_qty: 25,
  reversal_net: -5,
  warranty_cases_by_status: { CHECKING: 3, COMPLETED: 7 },
  reconciliation_warnings: [{ product_id: "p-1" }],
};

const emptyDashboard: DashboardKPI = {
  period: { from_date: "2026-07-19", to_date: "2026-08-18" },
  available_qty: 0,
  receipt_qty: 0,
  issue_qty: 0,
  component_issue_qty: 0,
  reversal_net: 0,
  warranty_cases_by_status: {},
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

    expect(await screen.findByText("1.234")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Biểu đồ luồng kho từ 2026-07-19 đến 2026-08-18/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("1 cảnh báo")).toBeInTheDocument();
    expect(mockedFetchDashboardKPI).toHaveBeenCalledWith({});
  });

  it("renders an explicit empty state instead of fabricated chart data", async () => {
    mockedFetchDashboardKPI.mockResolvedValue(emptyDashboard);

    renderDashboard();

    expect(await screen.findByText("Không có số liệu trong kỳ.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Biểu đồ luồng kho/i })).not.toBeInTheDocument();
  });

  it("does not call report API when the loaded profile lacks report.view", () => {
    useAuthStore.setState({
      isProfileLoaded: true,
      isSuperAdmin: false,
      permissionCodes: ["inventory.view"],
    });

    renderDashboard();

    expect(
      screen.getByText("Bạn không có quyền report.view trong context hiện hành."),
    ).toBeInTheDocument();
    expect(mockedFetchDashboardKPI).not.toHaveBeenCalled();
  });
});
