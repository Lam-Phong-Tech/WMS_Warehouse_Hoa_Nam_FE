import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardSnapshot } from "./DashboardSnapshot";
import { dashboardNow } from "./overview-data";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";

const now = dashboardNow();
const today = now.format("YYYY-MM-DD");
const from7 = now.subtract(6, "day").format("YYYY-MM-DD");

const baseProps = {
  name: "QA",
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
      receiptProduct: 6,
      receiptComponent: 4,
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
  useLanguageStore.getState().setLanguage("vi");
});

describe("DashboardSnapshot MAP-01 parity", () => {
  it("updates priority row actions in both languages without changing the selected route", async () => {
    renderSnapshot({
      issues: [
        {
          id: "issue",
          severity: "P1",
          title: "Pending evidence",
          detail: "2 documents",
          count: 2,
          technical: "PENDING",
          route: "/reports/pending-evidence?screen=RPT-08",
        },
      ],
    });
    const row = screen.getByRole("button", { name: /Pending evidence/ });
    expect(within(row).getByText("Xem")).toBeInTheDocument();
    await act(async () => {
      useLanguageStore.getState().setLanguage("en");
      await ensureEnglishMessages();
    });
    expect(within(row).getByText("View")).toBeInTheDocument();
    fireEvent.click(row);
    expect(baseProps.onNavigate).toHaveBeenCalledWith(
      "/reports/pending-evidence?screen=RPT-08",
    );
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(within(row).getByText("Xem")).toBeInTheDocument();
  });

  it("returns the daily table to page one when the reporting period changes", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      ...baseProps.rows[0],
      date: now.subtract(30 - index, "day").format("YYYY-MM-DD"),
    }));
    const trend = rows.map((row) => ({
      ...baseProps.trend[0],
      date: row.date,
    }));
    const { rerender } = renderSnapshot({ rows, trend });
    fireEvent.click(screen.getByRole("button", { name: "Bảng số liệu" }));
    fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
    expect(screen.getByText("Hiển thị 6–10 / 12 bản ghi")).toBeInTheDocument();

    rerender(
      <DashboardSnapshot
        {...baseProps}
        rows={rows}
        trend={trend}
        range={{ from: rows[0].date, to: rows[11].date }}
      />,
    );
    expect(screen.getByText("Hiển thị 1–5 / 12 bản ghi")).toBeInTheDocument();
  });

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
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Tùy chỉnh" }));

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
