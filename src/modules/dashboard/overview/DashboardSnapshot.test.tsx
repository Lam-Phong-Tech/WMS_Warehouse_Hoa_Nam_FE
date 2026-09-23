import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardSnapshot } from "./DashboardSnapshot";
import { dashboardNow } from "./overview-data";

const now = dashboardNow();
const today = now.format("YYYY-MM-DD");
const from7 = now.subtract(6, "day").format("YYYY-MM-DD");

const baseProps = {
  name: "QA",
  warehouseLabel: "Kho Hoa Nam",
  cards: [
    {
      id: "DASH-KPI-01",
      label: "Tồn kho hiện tại",
      value: 120,
      delta: "+5",
      trend: "up" as const,
      note: "So với kỳ trước",
      icon: "package-search" as const,
      spark: [],
      source: "test",
    },
  ],
  rows: [
    {
      date: today,
      label: today,
      inbound: 10,
      product: 4,
      component: 1,
      reversal: 0,
    },
  ],
  trend: [{ date: today, label: today, closing: 120 }],
  composition: [
    { status: "AVAILABLE", label: "Có thể xuất", value: 120, pct: 100 },
  ],
  issues: [],
  range: { from: from7, to: today },
  period: "last7" as const,
  custom: { from: from7, to: today },
  onPeriodChange: vi.fn(),
  onCustomChange: vi.fn(),
  loading: false,
  failed: false,
  forbidden: false,
  showWarranty: true,
  onRetry: vi.fn(),
  onNavigate: vi.fn(),
};

function renderSnapshot(
  overrides: Partial<ComponentProps<typeof DashboardSnapshot>> = {},
) {
  return render(<DashboardSnapshot {...baseProps} {...overrides} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardSnapshot MAP-01 parity", () => {
  it("khóa filter và dùng skeleton khi chart đang loading", () => {
    renderSnapshot({ chartStateOverride: "loading" });

    expect(
      screen.getByRole("button", { name: /7 ngày gần nhất/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("status", { name: "Đang tải biểu đồ" }),
    ).toBeInTheDocument();
  });

  it("permission denied của chart không làm mất KPI Dashboard", () => {
    renderSnapshot({ chartStateOverride: "forbidden" });

    expect(screen.getByText("Tồn kho hiện tại")).toBeInTheDocument();
    expect(
      screen.getByText("Bạn không có quyền xem biểu đồ"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /7 ngày gần nhất/i }),
    ).toBeDisabled();
  });

  it("chặn custom range vượt quá 90 ngày và cho phép đúng 90 ngày", () => {
    const { container } = renderSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /7 ngày gần nhất/i }));
    fireEvent.click(screen.getByRole("button", { name: "Tùy chỉnh" }));

    const fromInput = screen.getByLabelText("Từ ngày");
    const apply = screen.getByRole("button", { name: "Áp dụng" });

    fireEvent.change(fromInput, {
      target: { value: now.subtract(90, "day").format("YYYY-MM-DD") },
    });

    expect(
      screen.getByText("Khoảng thời gian tối đa 90 ngày."),
    ).toBeInTheDocument();
    expect(apply).toBeDisabled();
    expect(
      container.querySelector(".snapshot-calendar .is-invalid-range"),
    ).not.toBeNull();

    fireEvent.change(fromInput, {
      target: { value: now.subtract(89, "day").format("YYYY-MM-DD") },
    });

    expect(
      screen.queryByText("Khoảng thời gian tối đa 90 ngày."),
    ).not.toBeInTheDocument();
    expect(apply).toBeEnabled();
  });

  it("không sinh trạng thái nghiệp vụ từ tham số trình diễn", () => {
    window.history.replaceState(
      {},
      "",
      "/dashboard?screen=MAP-01&state=overview-urgent",
    );
    const { container } = renderSnapshot();
    expect(container.querySelector(".snapshot-reference-banner")).toBeNull();
    expect(
      screen.queryByRole("status", { name: "Trạng thái tổng quan: Khẩn cấp" }),
    ).not.toBeInTheDocument();
    window.history.replaceState({}, "", "/");
  });
});
