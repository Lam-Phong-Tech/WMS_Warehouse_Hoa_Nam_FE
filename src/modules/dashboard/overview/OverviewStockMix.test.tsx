import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { buildStockMix } from "./overview-data";
import { OverviewStockMix } from "./OverviewStockMix";
import type { DashboardOverview } from "../types";

/**
 * Donut "Tồn theo loại hàng" thay biểu đồ đường ở ô thứ hai của lưới phân tích.
 * Ba thứ dễ vỡ được khoá ở đây: số cộng đúng cả bốn trạng thái, một loại chiếm
 * trọn thì vẫn vẽ được vành (cung 0→2π suy biến), và viewBox phải trùng biểu đồ
 * luồng bên cạnh — đó là điều kiện để chữ hai thẻ cùng cỡ.
 */
const structure = {
  PRODUCT: { AVAILABLE: 800, NON_SELLABLE: 50, DEFECTIVE: 20, QUARANTINE: 10 },
  COMPONENT: { AVAILABLE: 434, NON_SELLABLE: 0, DEFECTIVE: 0, QUARANTINE: 0 },
};

const overviewWith = (value: unknown) =>
  ({ stock_structure: value }) as unknown as DashboardOverview;

const state = { loading: false, failed: false, forbidden: false };

describe("buildStockMix", () => {
  it("cộng đủ bốn trạng thái của từng loại hàng và tính tỷ trọng", () => {
    const rows = buildStockMix(overviewWith(structure));
    expect(rows).toEqual([
      { key: "PRODUCT", label: "Sản phẩm", value: 880, pct: 67 },
      { key: "COMPONENT", label: "Linh kiện", value: 434, pct: 33 },
    ]);
  });

  it("nguồn trống trả về hai dòng 0 thay vì mảng rỗng", () => {
    expect(buildStockMix(undefined).map((row) => row.value)).toEqual([0, 0]);
  });
});

describe("OverviewStockMix", () => {
  it("vẽ hai miếng donut, tổng ở giữa và chú giải theo loại hàng", () => {
    const rows = buildStockMix(overviewWith(structure));
    const { container } = renderWithProviders(
      <OverviewStockMix rows={rows} {...state} />,
    );

    expect(screen.getByText("Tồn theo loại hàng")).toBeInTheDocument();

    // Hai cung, không cung nào chứa NaN.
    const slices = container.querySelectorAll("path.mix-slice");
    expect(slices).toHaveLength(2);
    slices.forEach((slice) =>
      expect(slice.getAttribute("d")).not.toContain("NaN"),
    );

    // Tổng nằm giữa vành + hai số của chú giải.
    expect(container.querySelector(".mix-center-value")?.textContent).toBe(
      "1.314",
    );
    const legend = Array.from(
      container.querySelectorAll(".chart-legend .legend-button"),
    ).map((node) => node.textContent);
    expect(legend).toEqual(["Sản phẩm88067%", "Linh kiện43433%"]);
  });

  it("một loại chiếm trọn thì vẽ vành bằng circle, không dùng cung suy biến", () => {
    const rows = buildStockMix(
      overviewWith({
        PRODUCT: structure.PRODUCT,
        COMPONENT: {
          AVAILABLE: 0,
          NON_SELLABLE: 0,
          DEFECTIVE: 0,
          QUARANTINE: 0,
        },
      }),
    );
    const { container } = renderWithProviders(
      <OverviewStockMix rows={rows} {...state} />,
    );

    expect(container.querySelectorAll("path.mix-slice")).toHaveLength(0);
    expect(container.querySelector("circle.mix-slice")).toBeInTheDocument();
    // Miếng 0% không được vẽ nhãn tỷ trọng trên vành, nhưng vẫn có mặt ở chú
    // giải để người đọc biết loại đó đang bằng 0 chứ không phải bị bỏ sót.
    expect(
      Array.from(container.querySelectorAll(".mix-slice-pct")).map(
        (node) => node.textContent,
      ),
    ).toEqual(["100%"]);
    expect(
      container.querySelectorAll(".chart-legend .legend-button"),
    ).toHaveLength(2);
  });

  it("tổng bằng 0 thì báo trạng thái rỗng chứ không vẽ vành trắng", () => {
    renderWithProviders(
      <OverviewStockMix rows={buildStockMix(undefined)} {...state} />,
    );
    expect(screen.getByText("Chưa có tồn để chia")).toBeInTheDocument();
  });

  it("dùng chung viewBox với biểu đồ luồng để chữ hai thẻ cùng cỡ", () => {
    const { container } = renderWithProviders(
      <OverviewStockMix
        rows={buildStockMix(overviewWith(structure))}
        {...state}
      />,
    );
    expect(
      container.querySelector("svg.chart-svg")?.getAttribute("viewBox"),
    ).toBe("0 0 580 250");
    // Hàng chú giải là điều kiện thứ hai để hai khung vẽ cao bằng nhau.
    expect(
      container.querySelector(".chart-wrap > .chart-legend"),
    ).not.toBeNull();
  });
});
