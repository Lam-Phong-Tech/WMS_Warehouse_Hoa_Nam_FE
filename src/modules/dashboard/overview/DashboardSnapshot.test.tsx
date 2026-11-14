import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import type { Dayjs } from "dayjs";
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
  onLogout: vi.fn(),
};

function renderSnapshot(
  overrides: Partial<ComponentProps<typeof DashboardSnapshot>> = {},
) {
  return render(<DashboardSnapshot {...baseProps} {...overrides} />);
}

async function pickSnapshotDate(
  field: "Từ ngày" | "Đến ngày",
  panelMonth: Dayjs,
  target: Dayjs,
) {
  fireEvent.click(screen.getByRole("button", { name: field }));
  const panel = await screen.findByRole("dialog", { name: field });
  const monthsBack = panelMonth
    .startOf("month")
    .diff(target.startOf("month"), "month");
  for (let index = 0; index < monthsBack; index += 1) {
    fireEvent.click(within(panel).getByRole("button", { name: "Tháng trước" }));
  }
  fireEvent.click(
    within(panel).getByRole("button", {
      name: target.format("DD/MM/YYYY"),
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useLanguageStore.getState().setLanguage("vi");
});

describe("DashboardSnapshot MAP-01 parity", () => {
  it.each([{ failed: true }, { partial: true }])(
    "retains recovery actions for failed or partial data (%j)",
    (state) => {
      renderSnapshot(state);
      fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
      expect(baseProps.onRetry).toHaveBeenCalledOnce();
      expect(
        screen.queryByRole("button", { name: "Làm mới" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["vi", "en"] as const)(
    "keeps the healthy %s overview focused on greeting, KPIs and period selection",
    async (language) => {
      await act(async () => {
        if (language === "en") await ensureEnglishMessages();
        useLanguageStore.getState().setLanguage(language);
      });
      const { container } = renderSnapshot();
      expect(container.querySelector(".snapshot-data-bar")).toBeNull();
      expect(
        screen.queryByText(/Chỉ số hôm nay|Today's figures/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Xu hướng:|Trend:/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Làm mới|Refresh/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("QA");
      expect(container.querySelector(".snapshot-kpis")).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: language === "vi" ? /7 ngày gần nhất/ : /Last 7 days/,
        }),
      ).toBeInTheDocument();
    },
  );

  it("uses the warning triangle with an exclamation mark for stock reconciliation incidents", () => {
    const { container } = renderSnapshot({
      issues: [
        {
          id: "DASH-KPI-14",
          severity: "P0",
          title: "Sự cố đối soát tồn",
          detail: "Sự cố chưa được đối soát · Chênh lệch chưa đóng",
          count: 3,
          technical: "Distinct incident",
          route: "/inventory",
        },
      ],
    });
    expect(
      container.querySelector(
        '.snapshot-priority-icon path[d="M12 9v4M12 17h.01"]',
      ),
    ).toBeInTheDocument();
  });

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

  it("opens the start-date calendar from the custom preset button", async () => {
    renderSnapshot();
    fireEvent.click(screen.getByRole("button", { name: /7 ngày gần nhất/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Tùy chỉnh" }));
    fireEvent.click(screen.getByRole("button", { name: "Tùy chỉnh" }));
    expect(
      await screen.findByRole("dialog", { name: "Từ ngày" }),
    ).toBeInTheDocument();
  });

  it("chặn custom range vượt quá 90 ngày và cho phép đúng 90 ngày", async () => {
    const { container } = renderSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /7 ngày gần nhất/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Tùy chỉnh" }));

    const fromField = screen.getByRole("button", { name: "Từ ngày" });
    expect(fromField).toHaveAttribute("data-date-field", "snapshot-date-from");
    expect(
      container.querySelector('.snapshot-date-fields input[type="date"]'),
    ).toBeNull();

    const apply = screen.getByRole("button", { name: "Áp dụng" });
    const tooLong = now.subtract(90, "day");
    await pickSnapshotDate("Từ ngày", now.subtract(6, "day"), tooLong);

    expect(
      screen.getByText("Khoảng thời gian tối đa 90 ngày."),
    ).toBeInTheDocument();
    expect(apply).toBeDisabled();
    expect(
      container.querySelector(".snapshot-calendar .is-invalid-range"),
    ).not.toBeNull();

    await pickSnapshotDate("Từ ngày", tooLong, now.subtract(89, "day"));

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
