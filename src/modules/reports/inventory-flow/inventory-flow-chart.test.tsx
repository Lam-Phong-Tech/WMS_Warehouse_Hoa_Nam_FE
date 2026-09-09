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
import {
  InventoryFlowChart,
  TEXT_BOX_PER_FONT_UNIT,
  type ChartSeries,
} from "./inventory-flow-chart";

/** Toạ độ y của hàng nhãn trục X trong viewBox (hằng `X_AXIS_LABEL_Y`). */
const X_AXIS_LABEL_Y = "219";
/** Cỡ chữ nhãn trục theo CSS bản port. */
const AXIS_FONT_SIZE = 10;
/**
 * Chiều cao HỘP CHỮ (không phải cỡ chữ) của một nhãn, tính bằng đơn vị viewBox.
 * jsdom không đo được chữ nên lấy hệ số đã đo thật bằng `getBBox()` trong
 * Chrome — dùng chung hằng của component để hai bên không trôi khỏi nhau.
 */
const TEXT_BOX_HEIGHT = AXIS_FONT_SIZE * TEXT_BOX_PER_FONT_UNIT;
/**
 * "Không đè nhau" chưa đủ: WWHN-342 vào đúng trạng thái hở 0,73 đơn vị
 * (≈0,5px) — hình học thì hợp lệ, mà ảnh chụp của tester vẫn thấy ba số dính
 * liền thành một cụm. Nên phép đo đòi khoảng hở NHÌN THẤY ĐƯỢC, và chính mốc
 * này mới phân biệt được bản 14 (đỏ) với bản 16 (xanh).
 */
const MIN_VISIBLE_CLEARANCE = 2;

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

  /*
   * ĐO THEO HỘP CHỮ, KHÔNG THEO CỠ CHỮ.
   *
   * Bản trước của phép đo này đòi khoảng cách ≥ `AXIS_FONT_SIZE` (10) nên nó
   * XANH cả khi hai nhãn thật sự chạm nhau: hộp chữ cỡ 10 cao 13,27 đơn vị
   * viewBox (đo bằng `getBBox()` trong Chrome), không phải 10. jsdom không có
   * bộ đo chữ nên phải tự mang hệ số đó vào — dùng CHUNG hằng của component
   * để hai bên không thể trôi khỏi nhau.
   */
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
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(
        TEXT_BOX_HEIGHT + MIN_VISIBLE_CLEARANCE,
      );
    }
  });

  /*
   * Ca "9/1/0" trong ảnh bằng chứng WWHN-342 (UAT TC_UI_16): ba chuỗi của báo
   * cáo XUẤT cùng tụt sát đáy ở ngày cuối kỳ. Đây là ca xấu nhất vì
   * `spreadEndLabels` phải đẩy cả cụm xuống rồi kéo ngược lên cho khỏi vượt
   * đáy khung — chính chỗ hai nhãn dễ dính lại nhất.
   */
  it("ba chuỗi cùng chạm đáy cuối kỳ vẫn còn khoảng hở thật (WWHN-342)", () => {
    const days = 101;
    const ending = [9, 1, 0];
    const series: ChartSeries[] = ending.map((last, index) => ({
      key: `s${index}`,
      label: `Chuỗi ${index + 1}`,
      color: "#000",
      values: [
        ...Array.from({ length: days - 1 }, (_, day) => (day * 13) % 140),
        last,
      ],
    }));
    const { container } = render(
      <InventoryFlowChart
        labels={makeLabels(days)}
        series={series}
        ariaLabel="test"
      />,
    );
    const nodes = Array.from(
      container.querySelectorAll("text.chart-point-label"),
    );
    expect(nodes).toHaveLength(3);

    const ys = nodes
      .map((node) => Number(node.getAttribute("y")))
      .sort((left, right) => left - right);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(
        TEXT_BOX_HEIGHT + MIN_VISIBLE_CLEARANCE,
      );
    }

    // Neo `end` tại PLOT_RIGHT: nhãn mọc sang TRÁI nên không thể tràn mép phải
    // — đúng cái "số bị cắt cụt ở mép" trong ảnh của tester.
    for (const node of nodes) {
      expect(node.getAttribute("text-anchor")).toBe("end");
      expect(Number(node.getAttribute("x"))).toBeLessThanOrEqual(626);
    }

    // Cả cụm phải nằm trong vùng vẽ (đáy y=196), không rơi xuống hàng nhãn
    // trục X ở y=219.
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(AXIS_FONT_SIZE);
    expect(Math.max(...ys)).toBeLessThanOrEqual(196);
  });

  it("không vỡ khi không có mốc nào (kỳ rỗng)", () => {
    const { container } = render(
      <InventoryFlowChart labels={[]} series={[]} ariaLabel="test" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(axisLabelPositions(container)).toHaveLength(0);
  });
});
