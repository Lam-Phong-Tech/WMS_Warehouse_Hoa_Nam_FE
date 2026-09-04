/**
 * Chốt chặn cho lỗi "chọn khoảng thời gian dài thì nhãn trục X đè lên nhau".
 *
 * Kiểm tra ở mức HÌNH HỌC chứ không phải ảnh chụp: đọc toạ độ `x` của các nhãn
 * trục X thật sự được render rồi đòi hai nhãn cạnh nhau phải cách nhau đủ bề
 * rộng chữ. Ràng buộc này đúng với mọi độ dài kỳ nên không màn nào "lọt lưới".
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import dayjs from "dayjs";
import { InventoryFlowChart, type ChartSeries } from "./inventory-flow-chart";

/** Toạ độ y của hàng nhãn trục X trong viewBox (hằng `X_AXIS_LABEL_Y`). */
const X_AXIS_LABEL_Y = "219";
/** Cỡ chữ nhãn trục theo CSS bản port. */
const AXIS_FONT_SIZE = 10;

function makeLabels(days: number): string[] {
  const start = dayjs("2026-01-01");
  return Array.from({ length: days }, (_, index) =>
    start.add(index, "day").format("DD-MM"),
  );
}

function makeSeries(days: number, count: number): ChartSeries[] {
  return Array.from({ length: count }, (_, seriesIndex) => ({
    key: `s${seriesIndex}`,
    label: `Chuỗi ${seriesIndex + 1}`,
    color: "#000",
    values: Array.from({ length: days }, (_, index) => (index * 7) % 90),
  }));
}

function axisLabelPositions(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll("text.chart-axis-label"))
    .filter((node) => node.getAttribute("y") === X_AXIS_LABEL_Y)
    .map((node) => Number(node.getAttribute("x")));
}

describe("InventoryFlowChart · mật độ nhãn trục X", () => {
  it("kỳ ngắn vẫn vẽ đủ từng mốc như mockup", () => {
    const { container } = render(
      <InventoryFlowChart
        labels={makeLabels(7)}
        series={makeSeries(7, 4)}
        ariaLabel="test"
      />,
    );
    expect(axisLabelPositions(container)).toHaveLength(7);
  });

  it.each([14, 31, 90, 180, 366])(
    "kỳ %i ngày: không có hai nhãn nào đè lên nhau",
    (days) => {
      const { container } = render(
        <InventoryFlowChart
          labels={makeLabels(days)}
          series={makeSeries(days, 4)}
          ariaLabel="test"
        />,
      );
      const positions = axisLabelPositions(container);
      expect(positions.length).toBeGreaterThanOrEqual(2);

      // Nhãn "DD-MM" = 5 ký tự; bề rộng ước lượng cùng công thức của
      // `fitAxisDensity` (0.62 × cỡ chữ mỗi ký tự).
      const labelWidth = 5 * AXIS_FONT_SIZE * 0.62;
      for (let i = 1; i < positions.length; i += 1) {
        expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(
          labelWidth,
        );
      }
    },
  );

  it("luôn giữ nhãn ở mốc cuối kỳ, và nhãn nằm trong khung vẽ", () => {
    const days = 90;
    const { container } = render(
      <InventoryFlowChart
        labels={makeLabels(days)}
        series={makeSeries(days, 4)}
        ariaLabel="test"
      />,
    );
    const positions = axisLabelPositions(container);
    // PLOT_LEFT = 38, PLOT_RIGHT = 626.
    expect(positions[0]).toBeGreaterThanOrEqual(38);
    expect(positions.at(-1)).toBe(626);
  });

  it("kỳ dài thì bỏ chấm điểm để đường xu hướng không bị lấp", () => {
    const dense = render(
      <InventoryFlowChart
        labels={makeLabels(200)}
        series={makeSeries(200, 4)}
        ariaLabel="test"
      />,
    );
    // Chỉ còn chấm ở mốc cuối của mỗi chuỗi.
    expect(dense.container.querySelectorAll("circle.chart-point")).toHaveLength(
      4,
    );

    const sparse = render(
      <InventoryFlowChart
        labels={makeLabels(7)}
        series={makeSeries(7, 4)}
        ariaLabel="test"
      />,
    );
    expect(
      sparse.container.querySelectorAll("circle.chart-point"),
    ).toHaveLength(28);
  });

  it("nhãn giá trị cuối kỳ của các chuỗi không chồng lên nhau", () => {
    // Bốn chuỗi cùng kết thúc ở giá trị gần nhau — đúng ca sinh ra lỗi "5" đè
    // lên "0" ở mép phải biểu đồ.
    const flat: ChartSeries[] = Array.from({ length: 4 }, (_, index) => ({
      key: `s${index}`,
      label: `Chuỗi ${index + 1}`,
      color: "#000",
      values: [10, 8, index],
    }));
    const { container } = render(
      <InventoryFlowChart
        labels={makeLabels(3)}
        series={flat}
        ariaLabel="test"
      />,
    );
    const ys = Array.from(container.querySelectorAll("text.chart-point-label"))
      .map((node) => Number(node.getAttribute("y")))
      .sort((left, right) => left - right);
    expect(ys).toHaveLength(4);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(AXIS_FONT_SIZE);
    }
  });

  it("không vỡ khi không có mốc nào (kỳ rỗng)", () => {
    const { container } = render(
      <InventoryFlowChart labels={[]} series={[]} ariaLabel="test" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(axisLabelPositions(container)).toHaveLength(0);
  });
});
