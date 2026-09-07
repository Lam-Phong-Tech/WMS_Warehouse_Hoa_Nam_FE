/**
 * Test luật hiển thị của màn so sánh.
 *
 * Đây là test của một QUYẾT ĐỊNH NGHIỆP VỤ, không phải của một hàm tiện ích:
 * ranh giới 3 → 4 đối tượng là chỗ màn đổi cách đọc, và nó phải nằm đúng một
 * chỗ để mọi màn so sánh về sau không mỗi nơi chọn một kiểu.
 */
import { describe, expect, it } from "vitest";
import {
  COMPARISON_CHART_SERIES_LIMIT,
  COMPARISON_MIN_OBJECTS,
  COMPARISON_SIDE_BY_SIDE_MAX,
  comparisonChartSeriesCount,
  comparisonDefaultView,
  comparisonHiddenSeriesCount,
  comparisonLayout,
} from "./comparison-display";

describe("comparisonLayout", () => {
  it("dưới 2 đối tượng thì chưa so sánh được", () => {
    expect(comparisonLayout(0)).toBe("insufficient");
    expect(comparisonLayout(1)).toBe("insufficient");
  });

  it("2–3 đối tượng đọc bằng cột nhóm cạnh nhau", () => {
    expect(comparisonLayout(2)).toBe("sideBySide");
    expect(comparisonLayout(3)).toBe("sideBySide");
  });

  it("từ 4 đối tượng đọc bằng ma trận", () => {
    expect(comparisonLayout(4)).toBe("matrix");
    expect(comparisonLayout(12)).toBe("matrix");
  });

  it("hai mốc của luật khớp với hằng số công bố", () => {
    expect(comparisonLayout(COMPARISON_MIN_OBJECTS)).toBe("sideBySide");
    expect(comparisonLayout(COMPARISON_SIDE_BY_SIDE_MAX)).toBe("sideBySide");
    expect(comparisonLayout(COMPARISON_SIDE_BY_SIDE_MAX + 1)).toBe("matrix");
  });
});

/**
 * Mở màn LUÔN là biểu đồ, dù đang so mấy đối tượng: số đối tượng chỉ đổi CÂU
 * GỢI Ý ("từ 4 trở lên nên chuyển sang heatmap"), không tự đổi hình sau lưng
 * người dùng. Test khoá đúng điểm đó — muốn cho số đối tượng chi phối lại thì
 * chỉ sửa `comparisonDefaultView`, không rải điều kiện ra từng màn.
 */
describe("comparisonDefaultView", () => {
  it("mở màn là biểu đồ ở mọi số đối tượng", () => {
    for (const count of [0, 1, 2, 3, 4, 12]) {
      expect(comparisonDefaultView(count)).toBe("chart");
    }
  });
});

describe("trần chuỗi trên một biểu đồ", () => {
  it("không bao giờ vẽ quá trần", () => {
    expect(comparisonChartSeriesCount(3)).toBe(3);
    expect(comparisonChartSeriesCount(COMPARISON_CHART_SERIES_LIMIT + 5)).toBe(
      COMPARISON_CHART_SERIES_LIMIT,
    );
  });

  it("phần dư được đếm để màn nói ra, không im lặng bỏ qua", () => {
    expect(comparisonHiddenSeriesCount(3)).toBe(0);
    expect(comparisonHiddenSeriesCount(COMPARISON_CHART_SERIES_LIMIT + 2)).toBe(
      2,
    );
  });

  it("số âm/rỗng không làm hỏng phép tính", () => {
    expect(comparisonChartSeriesCount(-1)).toBe(0);
    expect(comparisonHiddenSeriesCount(-1)).toBe(0);
  });
});
