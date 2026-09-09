import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material";
import { muiTheme } from "@/shared/ui/theme";
import { TraySelectionGrid } from "./TraySelectionGrid";
import type { TrayOption } from "@/modules/putaway/services/putawayService";

interface StubCellPoint {
  x: string;
  y: number;
  code: string;
  trayId: string | null;
  statusLabel: string;
  meta: string;
}

interface StubSeries {
  name?: string;
  data: StubCellPoint[];
}

type StubClickHandler = (
  event: unknown,
  chartContext: unknown,
  config: { seriesIndex: number; dataPointIndex: number },
) => void;

// jsdom không đo được kích thước SVG nên ApexCharts thật không vẽ được (xem
// DashboardPage.test.tsx). Stub này giả lập đúng hợp đồng mà TraySelectionGrid
// dựa vào — series/options được truyền cho <Chart>, và
// options.chart.events.click(event, chartContext, {seriesIndex,
// dataPointIndex}) với chartContext.w.config.series trỏ lại đúng series gốc —
// để test hành vi chọn ô mà không cần ApexCharts vẽ thật.
vi.mock("react-apexcharts", () => ({
  default: ({
    series,
    options,
  }: {
    series: StubSeries[];
    options?: { chart?: { events?: { click?: StubClickHandler } } };
  }) => {
    const chartContext = { w: { config: { series } } };
    return (
      <div data-testid="apex-heatmap-stub">
        {series.map((rowSeries, seriesIndex) => (
          <div key={seriesIndex}>
            {rowSeries.name ? <span>{rowSeries.name}</span> : null}
            {rowSeries.data.map((point, dataPointIndex) =>
              point.code ? (
                <button
                  key={dataPointIndex}
                  type="button"
                  role="option"
                  aria-selected={point.statusLabel === "Đang chọn"}
                  onClick={() =>
                    options?.chart?.events?.click?.({}, chartContext, {
                      seriesIndex,
                      dataPointIndex,
                    })
                  }
                >
                  <p>{point.code}</p>
                </button>
              ) : null,
            )}
          </div>
        ))}
      </div>
    );
  },
}));

const TRAYS: TrayOption[] = [
  {
    container_id: "tray-b2",
    container_code: "B02",
    container_type: "TRAY",
    status: "ACTIVE",
    zone_code: "Khu B",
    location_hint: null,
    version: 1,
  },
  {
    container_id: "tray-a10",
    container_code: "A10",
    container_type: "TRAY",
    status: "ACTIVE",
    zone_code: "Khu A",
    location_hint: null,
    version: 1,
  },
  {
    container_id: "tray-a2",
    container_code: "A02",
    container_type: "TRAY",
    status: "ACTIVE",
    zone_code: "Khu A",
    location_hint: null,
    version: 1,
  },
];

function renderGrid(
  overrides: Partial<React.ComponentProps<typeof TraySelectionGrid>> = {},
) {
  const onSelect = vi.fn();
  const onRefresh = vi.fn();
  render(
    <ThemeProvider theme={muiTheme}>
      <TraySelectionGrid
        trays={TRAYS}
        selectedTrayId=""
        onSelect={onSelect}
        onRefresh={onRefresh}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { onSelect, onRefresh };
}

describe("TraySelectionGrid", () => {
  it("sort natural theo tray_code (A02 truoc A10)", async () => {
    renderGrid();
    // Chart vào qua LazyApexChart (lazy() + Suspense) nên lần mount ĐẦU TIÊN
    // trong file là bất đồng bộ; các test sau hưởng module đã nạp.
    const codes = (await screen.findAllByRole("option")).map(
      (el) => el.querySelector("p")?.textContent,
    );
    expect(codes).toEqual(["A02", "A10", "B02"]);
  });

  it("click 1 khay chi cap nhat local selection qua onSelect, khong tu goi API", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGrid();

    await user.click(screen.getByText("A02"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ container_code: "A02" }),
    );
  });

  it("loc theo tray_code khi go vao o tim kiem (PTW-GRID-03)", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.type(screen.getByLabelText("Tìm mã khay"), "B0");

    expect(screen.queryByText("A02")).not.toBeInTheDocument();
    expect(screen.getByText("B02")).toBeInTheDocument();
  });

  it("hien thi khay dang chon trong panel tom tat", () => {
    renderGrid({ selectedTrayId: "tray-a2" });
    expect(screen.getByText("Khay đã chọn")).toBeInTheDocument();
    expect(screen.getAllByText("A02")).toHaveLength(2);
  });

  it("nut lam moi goi onRefresh", async () => {
    const user = userEvent.setup();
    const { onRefresh } = renderGrid();

    await user.click(
      screen.getByRole("button", { name: "Làm mới danh sách khay" }),
    );

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("nhom cac o theo zone_code thanh nhieu hang khi du lieu co zone_code (chi de hien thi)", () => {
    renderGrid();

    expect(screen.getByText("Khu A")).toBeInTheDocument();
    expect(screen.getByText("Khu B")).toBeInTheDocument();
    expect(
      screen.getByText(/chỉ để hiển thị dễ nhìn, không phải sơ đồ vị trí/i),
    ).toBeInTheDocument();
  });

  it("khong hien nhan hang/disclaimer khi tray khong co zone_code (khop du lieu that hien tai)", () => {
    const trays = TRAYS.map((tray) => ({ ...tray, zone_code: null }));
    renderGrid({ trays });

    expect(screen.queryByText("Khu A")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/chỉ để hiển thị dễ nhìn/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("hien thi so luong xep vao khi truyen pendingQuantity", () => {
    renderGrid({ selectedTrayId: "tray-a2", pendingQuantity: 5 });
    expect(screen.getByText("Số lượng xếp vào: 5 PCS")).toBeInTheDocument();
  });

  /**
   * UAT TC_UI_08: trạng thái vật chứa ngoài EMPTY/PARTIAL (STORED, ACTIVE…)
   * từng in THÔ mã enum lên chip "Khay đã chọn". Mọi trạng thái phải qua map
   * nhãn tiếng Việt; mã lạ đi qua enumLabelOrText nên cũng không được lộ
   * SCREAMING_SNAKE.
   */
  it("khay STORED: chip panel dich nhan tieng Viet, khong lo ma enum tho", () => {
    const trays = TRAYS.map((tray) =>
      tray.container_id === "tray-a2" ? { ...tray, status: "STORED" } : tray,
    );
    renderGrid({ trays, selectedTrayId: "tray-a2" });

    expect(screen.getByText("Đang chứa hàng")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("STORED");
  });
});
