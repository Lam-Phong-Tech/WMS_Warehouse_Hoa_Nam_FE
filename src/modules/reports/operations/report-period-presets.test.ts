/**
 * Luật tính kỳ là thứ dễ sai một ngày mà không ai thấy — sai đúng một ngày thì
 * báo cáo vẫn ra số, chỉ là số khác. Khoá từng luật ở đây, trên một "hôm nay"
 * cố định để test không đổi kết quả theo ngày chạy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dayjs from "dayjs";
import {
  CALENDAR_PRESETS,
  PERIOD_PRESETS,
  ROLLING_PRESETS,
  presetRange,
} from "./report-format";
import { reportRangePresets } from "./report-range-presets";
import { MESSAGES_VI } from "@/shared/i18n/messages";

/** Thứ sáu 04/09/2026 — giữa tháng, giữa quý III, để mọi luật đều lộ ra. */
const NOW = new Date("2026-09-04T10:30:00+07:00");

const iso = (value: ReturnType<typeof dayjs>) => value.format("YYYY-MM-DD");
const span = (preset: Parameters<typeof presetRange>[0]) => {
  const [from, to] = presetRange(preset);
  return [iso(from), iso(to)] as const;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("presetRange", () => {
  it("Hôm nay / Hôm qua là đúng MỘT ngày", () => {
    expect(span("today")).toEqual(["2026-09-04", "2026-09-04"]);
    expect(span("yesterday")).toEqual(["2026-09-03", "2026-09-03"]);
  });

  it("'7 ngày qua' đúng 7 mốc và có tính cả hôm nay", () => {
    const [from, to] = span("last-7");
    expect([from, to]).toEqual(["2026-08-29", "2026-09-04"]);
    expect(dayjs(to).diff(dayjs(from), "day") + 1).toBe(7);
  });

  it("'30 ngày qua' đúng 30 mốc", () => {
    const [from, to] = span("last-30");
    expect([from, to]).toEqual(["2026-08-06", "2026-09-04"]);
    expect(dayjs(to).diff(dayjs(from), "day") + 1).toBe(30);
  });

  it("kỳ theo lịch 'đến nay' dừng ở hôm nay, không chạy hết kỳ", () => {
    expect(span("this-month")).toEqual(["2026-09-01", "2026-09-04"]);
    expect(span("this-quarter")).toEqual(["2026-07-01", "2026-09-04"]);
    expect(span("this-year")).toEqual(["2026-01-01", "2026-09-04"]);
  });

  it("'Tháng trước' là kỳ ĐÃ ĐÓNG — trọn tháng, không dính ngày nào của tháng này", () => {
    expect(span("last-month")).toEqual(["2026-08-01", "2026-08-31"]);
  });

  it("'Tháng trước' bắc qua năm vẫn đúng", () => {
    vi.setSystemTime(new Date("2026-01-15T08:00:00+07:00"));
    expect(span("last-month")).toEqual(["2025-12-01", "2025-12-31"]);
  });

  it("mọi kỳ đều hợp lệ: từ ngày không bao giờ sau đến ngày, và không có mốc tương lai", () => {
    for (const preset of PERIOD_PRESETS) {
      const [from, to] = presetRange(preset);
      expect(from.valueOf(), preset).toBeLessThanOrEqual(to.valueOf());
      expect(to.valueOf(), preset).toBeLessThanOrEqual(
        dayjs(NOW).endOf("day").valueOf(),
      );
    }
  });
});

describe("reportRangePresets", () => {
  const t = ((key: string) => {
    const parts = key.split(".");
    let node: unknown = MESSAGES_VI;
    for (const part of parts) {
      node = (node as Record<string, unknown>)?.[part];
    }
    return typeof node === "string" ? node : key;
  }) as Parameters<typeof reportRangePresets>[0];

  it("liệt kê đủ mọi kỳ bấm được, KHÔNG có mục 'Tùy chọn'", () => {
    const presets = reportRangePresets(t);
    expect(presets.map((preset) => preset.key)).toEqual([...PERIOD_PRESETS]);
    // "Tùy chọn" là TRẠNG THÁI rơi vào khi tự đặt ngày, không phải một mục bấm
    // được — bấm vào nó sẽ không đổi khoảng ngày nào cả.
    expect(presets.some((preset) => preset.key === "custom")).toBe(false);
  });

  it("chia đúng hai nhóm: cuộn lùi và theo lịch", () => {
    const presets = reportRangePresets(t);
    const groupOf = (key: string) =>
      presets.find((preset) => preset.key === key)?.group;
    for (const key of ROLLING_PRESETS) {
      expect(groupOf(key)).toBe(MESSAGES_VI.reports.period.groupRolling);
    }
    for (const key of CALENDAR_PRESETS) {
      expect(groupOf(key)).toBe(MESSAGES_VI.reports.period.groupCalendar);
    }
  });

  it("`range` tính lúc bấm, không đóng băng lúc dựng danh sách", () => {
    const presets = reportRangePresets(t);
    const today = presets.find((preset) => preset.key === "today");
    expect(iso(today!.range()[0])).toBe("2026-09-04");

    // Tab mở qua nửa đêm: cùng object preset, gọi lại phải ra ngày mới.
    vi.setSystemTime(new Date("2026-09-05T00:05:00+07:00"));
    expect(iso(today!.range()[0])).toBe("2026-09-05");
  });

  it("nhãn nói rõ kỳ theo lịch là 'đến nay' — không để người đọc tưởng trọn kỳ", () => {
    const presets = reportRangePresets(t);
    const label = (key: string) =>
      presets.find((preset) => preset.key === key)?.label ?? "";
    expect(label("this-month")).toContain("đến nay");
    expect(label("this-quarter")).toContain("đến nay");
    expect(label("this-year")).toContain("đến nay");
    // Kỳ đã đóng thì KHÔNG được gắn "đến nay".
    expect(label("last-month")).not.toContain("đến nay");
  });
});
