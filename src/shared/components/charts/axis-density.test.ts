import { describe, expect, it } from "vitest";
import {
  apexTickAmount,
  fitAxisDensity,
  longestLabelChars,
} from "./axis-density";

/**
 * Số nhãn thực sự được vẽ khi áp `showLabel` lên toàn trục — dùng để kiểm tra
 * ràng buộc "không bao giờ vẽ nhiều nhãn hơn sức chứa của khung".
 */
function shownIndexes(count: number, showLabel: (index: number) => boolean) {
  return Array.from({ length: count }, (_, index) => index).filter(showLabel);
}

describe("fitAxisDensity", () => {
  it("kỳ ngắn vừa khung thì vẽ đủ nhãn", () => {
    const density = fitAxisDensity({
      count: 7,
      plotWidth: 588,
      labelChars: 5,
      fontSize: 10,
    });
    expect(density.stride).toBe(1);
    expect(shownIndexes(7, density.showLabel)).toHaveLength(7);
    expect(density.showMarkers).toBe(true);
  });

  it.each([30, 60, 90, 180, 365, 1000])(
    "kỳ %i ngày không bao giờ vẽ quá sức chứa của khung",
    (count) => {
      const plotWidth = 588;
      const fontSize = 10;
      const labelChars = 5;
      const density = fitAxisDensity({
        count,
        plotWidth,
        labelChars,
        fontSize,
      });
      const shown = shownIndexes(count, density.showLabel);

      expect(shown.length).toBeLessThanOrEqual(density.maxLabels);

      // Ràng buộc thật sự cần: hai nhãn cạnh nhau phải cách nhau đủ bề rộng
      // chữ — đây chính là lỗi "dữ liệu bị đè lên nhau" đang sửa.
      const step = plotWidth / (count - 1);
      const minGapNeeded = labelChars * fontSize * 0.62;
      for (let i = 1; i < shown.length; i += 1) {
        expect((shown[i] - shown[i - 1]) * step).toBeGreaterThanOrEqual(
          minGapNeeded,
        );
      }
    },
  );

  it("luôn giữ nhãn ở mốc cuối kỳ", () => {
    for (const count of [13, 30, 91, 365]) {
      const density = fitAxisDensity({
        count,
        plotWidth: 588,
        labelChars: 5,
        fontSize: 10,
      });
      expect(density.showLabel(count - 1)).toBe(true);
    }
  });

  it("khung càng hẹp thì nhãn càng thưa", () => {
    const wide = fitAxisDensity({
      count: 90,
      plotWidth: 1200,
      labelChars: 5,
      fontSize: 10,
    });
    const narrow = fitAxisDensity({
      count: 90,
      plotWidth: 320,
      labelChars: 5,
      fontSize: 10,
    });
    expect(narrow.stride).toBeGreaterThan(wide.stride);
  });

  it("nhãn dài hơn thì thưa hơn ở cùng bề rộng", () => {
    const short = fitAxisDensity({
      count: 40,
      plotWidth: 588,
      labelChars: 5,
      fontSize: 10,
    });
    const long = fitAxisDensity({
      count: 40,
      plotWidth: 588,
      labelChars: 10,
      fontSize: 10,
    });
    expect(long.stride).toBeGreaterThan(short.stride);
  });

  it("nhãn xoay 45° chứa được nhiều mốc hơn nhãn nằm ngang", () => {
    const flat = fitAxisDensity({
      count: 40,
      plotWidth: 588,
      labelChars: 10,
      fontSize: 12,
    });
    const rotated = fitAxisDensity({
      count: 40,
      plotWidth: 588,
      labelChars: 10,
      fontSize: 12,
      rotateDegrees: 45,
    });
    expect(rotated.maxLabels).toBeGreaterThan(flat.maxLabels);
  });

  it("tắt chấm điểm và nhãn giá trị khi các mốc san sát", () => {
    const density = fitAxisDensity({
      count: 365,
      plotWidth: 588,
      labelChars: 5,
      fontSize: 10,
      markerRadius: 3.5,
    });
    expect(density.showMarkers).toBe(false);
    expect(density.markerRadius).toBe(0);
    expect(density.showPointValues).toBe(false);
    expect(density.strokeScale).toBeLessThan(1);
  });

  it("không vỡ ở các ca biên: 0 hoặc 1 điểm", () => {
    for (const count of [0, 1]) {
      const density = fitAxisDensity({
        count,
        plotWidth: 588,
        labelChars: 5,
        fontSize: 10,
      });
      expect(density.stride).toBe(1);
      expect(density.showLabel(0)).toBe(true);
    }
  });

  it("khung rộng 0 (chưa đo được layout) vẫn trả kết quả dùng được", () => {
    const density = fitAxisDensity({
      count: 90,
      plotWidth: 0,
      labelChars: 5,
      fontSize: 10,
    });
    expect(density.maxLabels).toBeGreaterThanOrEqual(2);
    expect(density.stride).toBeGreaterThan(1);
    expect(density.showLabel(89)).toBe(true);
  });
});

describe("apexTickAmount", () => {
  it("để ApexCharts tự lo khi vẫn còn chỗ vẽ hết nhãn", () => {
    expect(
      apexTickAmount({
        count: 7,
        plotWidth: 560,
        labelChars: 5,
        fontSize: 12,
      }),
    ).toBeUndefined();
  });

  it("ép số khoảng về mức vừa khung khi kỳ dài", () => {
    const ticks = apexTickAmount({
      count: 365,
      plotWidth: 560,
      labelChars: 5,
      fontSize: 12,
    });
    expect(ticks).toBeDefined();
    expect(ticks!).toBeLessThan(364);
    expect(ticks!).toBeGreaterThanOrEqual(2);
  });
});

describe("longestLabelChars", () => {
  it("trả về độ dài nhãn dài nhất", () => {
    expect(longestLabelChars(["07-08", "01/09/2026"])).toBe(10);
  });

  it("mảng rỗng vẫn trả 1 để phép chia không ra 0", () => {
    expect(longestLabelChars([])).toBe(1);
  });
});
