/**
 * Gợi ý bộ lọc kỳ là thứ dễ trở thành TIẾNG ỒN: nói sai một lần thì người dùng
 * đóng banner mãi mãi và tính năng thành vô dụng. Test ở đây khoá hai chiều —
 * NÓI khi nào, và IM khi nào.
 */
import { describe, expect, it } from "vitest";
import { translate } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import {
  buildRangeAdvice,
  shouldProbeCoverage,
  type RangeCoverage,
} from "./report-range-advice";

const t = (key: MessageKey, vars?: Record<string, string | number>) =>
  translate("vi", key, vars);

/** Ngày liên tiếp [from, to] — dựng nhanh một tập "ngày có phát sinh". */
function days(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

const coverageOf = (list: string[]): RangeCoverage => ({
  days: list,
  ready: true,
  lookbackMonths: 12,
});

/** Chưa dò xong / không dò — mọi kết luận cần dữ liệu ngoài kỳ đều phải im. */
const NOT_READY: RangeCoverage = {
  days: [],
  ready: false,
  lookbackMonths: 12,
};

describe("buildRangeAdvice — kỳ trống", () => {
  it("chỉ ra khoảng có dữ liệu khi kỳ đang chọn trống", () => {
    const advice = buildRangeAdvice({
      from: "2026-09-01",
      to: "2026-09-06",
      dataDays: [],
      coverage: coverageOf(days("2026-06-01", "2026-08-31")),
      t,
    });
    expect(advice?.kind).toBe("empty-with-coverage");
    expect(advice?.suggested).toEqual({
      from: "2026-06-01",
      to: "2026-08-31",
    });
    expect(advice?.message).toContain("01-06-2026 → 31-08-2026");
  });

  it("nói rõ 'không phải lỗi bộ lọc' khi cả cửa sổ dò cũng trống", () => {
    const advice = buildRangeAdvice({
      from: "2026-09-01",
      to: "2026-09-06",
      dataDays: [],
      coverage: coverageOf([]),
      t,
    });
    expect(advice?.kind).toBe("empty-no-coverage");
    expect(advice?.suggested).toBeNull();
    expect(advice?.actionLabel).toBeNull();
  });

  it("IM LẶNG khi chưa dò xong — không đoán dữ liệu nằm ở đâu", () => {
    expect(
      buildRangeAdvice({
        from: "2026-09-01",
        to: "2026-09-06",
        dataDays: [],
        coverage: NOT_READY,
        t,
      }),
    ).toBeNull();
    expect(
      buildRangeAdvice({
        from: "2026-09-01",
        to: "2026-09-06",
        dataDays: [],
        coverage: null,
        t,
      }),
    ).toBeNull();
  });
});

describe("buildRangeAdvice — kỳ có dữ liệu", () => {
  it("khuyên xem theo tuần khi dữ liệu gói trong một tuần mà đang xem cả tháng", () => {
    const advice = buildRangeAdvice({
      from: "2026-08-01",
      to: "2026-08-31",
      dataDays: days("2026-08-24", "2026-08-28"),
      coverage: null,
      t,
    });
    expect(advice?.kind).toBe("narrow-to-data");
    expect(advice?.title).toBe(t("reports.rangeAdvice.weeklyTitle"));
    expect(advice?.suggested).toEqual({
      from: "2026-08-24",
      to: "2026-08-28",
    });
  });

  it("khuyên thu hẹp (không nhắc tuần) khi đoạn dữ liệu dài hơn một tuần", () => {
    const advice = buildRangeAdvice({
      from: "2026-01-01",
      to: "2026-03-31",
      dataDays: days("2026-02-01", "2026-02-20"),
      coverage: null,
      t,
    });
    expect(advice?.kind).toBe("narrow-to-data");
    expect(advice?.title).toBe(t("reports.rangeAdvice.narrowTitle"));
  });

  it("IM LẶNG khi dữ liệu trải đều gần hết kỳ", () => {
    expect(
      buildRangeAdvice({
        from: "2026-08-01",
        to: "2026-08-31",
        dataDays: days("2026-08-02", "2026-08-30"),
        coverage: null,
        t,
      }),
    ).toBeNull();
  });

  it("IM LẶNG với kỳ ngắn — vài ngày trống trong một tuần là bình thường", () => {
    expect(
      buildRangeAdvice({
        from: "2026-09-01",
        to: "2026-09-07",
        dataDays: ["2026-09-01"],
        coverage: null,
        t,
      }),
    ).toBeNull();
  });

  it("chỉ ra nơi dữ liệu tập trung khi kỳ dài mà chỉ lác đác vài ngày", () => {
    const advice = buildRangeAdvice({
      from: "2026-08-20",
      to: "2026-09-06",
      dataDays: ["2026-08-20"],
      coverage: coverageOf([...days("2026-06-01", "2026-06-30"), "2026-08-20"]),
      t,
    });
    expect(advice?.kind).toBe("sparse-outside");
    expect(advice?.suggested).toEqual({
      from: "2026-06-01",
      to: "2026-08-20",
    });
  });

  it("cảnh báo kỳ vượt trần 366 ngày của biểu đồ theo ngày", () => {
    const advice = buildRangeAdvice({
      from: "2024-01-01",
      to: "2026-01-01",
      // Dữ liệu trải đều để không rơi vào nhánh thu hẹp.
      dataDays: ["2024-01-01", "2025-01-01", "2026-01-01"],
      coverage: null,
      t,
    });
    expect(advice?.kind).toBe("range-too-long");
    expect(advice?.suggested).toEqual({ from: "2025-01-01", to: "2026-01-01" });
  });
});

describe("buildRangeAdvice — đầu vào hỏng", () => {
  it("trả null khi kỳ không hợp lệ hoặc rỗng", () => {
    const base = { dataDays: [], coverage: coverageOf([]), t };
    expect(
      buildRangeAdvice({ ...base, from: "2026-09-10", to: "2026-09-01" }),
    ).toBeNull();
    expect(buildRangeAdvice({ ...base, from: "", to: "" })).toBeNull();
  });

  it("bỏ qua ngày rác và ngày nằm ngoài kỳ trong dataDays", () => {
    const advice = buildRangeAdvice({
      from: "2026-09-01",
      to: "2026-09-06",
      // Chuỗi rỗng, mốc thời gian đầy đủ, và một ngày ngoài kỳ.
      dataDays: ["", "not-a-date", "2026-05-01"],
      coverage: coverageOf(days("2026-06-01", "2026-08-31")),
      t,
    });
    expect(advice?.kind).toBe("empty-with-coverage");
  });

  it("đọc được mốc thời gian đầy đủ (ISO datetime) như một ngày", () => {
    const advice = buildRangeAdvice({
      from: "2026-08-01",
      to: "2026-08-31",
      dataDays: ["2026-08-24T08:15:00+07:00", "2026-08-25 09:00:00"],
      coverage: null,
      t,
    });
    expect(advice?.suggested).toEqual({
      from: "2026-08-24",
      to: "2026-08-25",
    });
  });
});

describe("shouldProbeCoverage", () => {
  const base = { from: "2026-09-01", to: "2026-09-06", loading: false };

  it("dò khi kỳ hoàn toàn trống", () => {
    expect(shouldProbeCoverage({ ...base, dataDays: [] })).toBe(true);
  });

  it("KHÔNG dò khi kỳ ngắn mà đã có dữ liệu", () => {
    expect(shouldProbeCoverage({ ...base, dataDays: ["2026-09-02"] })).toBe(
      false,
    );
  });

  it("dò khi kỳ dài mà chỉ lác đác vài ngày", () => {
    expect(
      shouldProbeCoverage({
        from: "2026-06-01",
        to: "2026-09-06",
        dataDays: ["2026-06-02", "2026-06-03"],
        loading: false,
      }),
    ).toBe(true);
  });

  it("KHÔNG dò khi đang tải hoặc kỳ không hợp lệ", () => {
    expect(shouldProbeCoverage({ ...base, dataDays: [], loading: true })).toBe(
      false,
    );
    expect(
      shouldProbeCoverage({
        from: "2026-09-10",
        to: "2026-09-01",
        dataDays: [],
        loading: false,
      }),
    ).toBe(false);
  });
});
