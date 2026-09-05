import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  birthDateBounds,
  checkDate,
  checkDateRange,
  clampDateRange,
  defaultDateBounds,
  pastDateBounds,
} from "./date-rules";

const now = dayjs("2026-09-05T10:00:00");

describe("date bounds", () => {
  it("cửa sổ mặc định 2000-01-01 → hôm nay + 10 năm", () => {
    const b = defaultDateBounds(now);
    expect(b.minDate.format("YYYY-MM-DD")).toBe("2000-01-01");
    expect(b.maxDate.format("YYYY-MM-DD")).toBe("2036-09-05");
  });

  it("ngày đã xảy ra không vượt hôm nay; ngày sinh phải đủ 18 tuổi", () => {
    expect(pastDateBounds(now).maxDate.format("YYYY-MM-DD")).toBe("2026-09-05");
    const birth = birthDateBounds(now);
    expect(birth.minDate.year()).toBe(1900);
    expect(birth.maxDate.format("YYYY-MM-DD")).toBe("2008-09-05");
  });
});

describe("checkDate", () => {
  it("từ chối năm 9999 và năm 0001 với cửa sổ mặc định", () => {
    expect(checkDate(dayjs("9999-12-31")).ok).toBe(false);
    expect(checkDate("0001-01-01").ok).toBe(false);
  });

  it("từ chối chuỗi ngày không hợp lệ (tháng 22, ngày 31/02) thay vì cuộn tháng", () => {
    expect(checkDate("2026-22-01").ok).toBe(false);
    expect(checkDate("2026-02-31").ok).toBe(false);
    expect(checkDate("2026-2-1").ok).toBe(false);
    expect(checkDate("2026-02-28").ok).toBe(true);
  });

  it("rỗng hợp lệ trừ khi required", () => {
    expect(checkDate(null)).toEqual({ ok: true, value: null });
    expect(checkDate(null, { required: true }).ok).toBe(false);
  });

  it("áp mốc truyền vào và nêu mốc trong thông báo", () => {
    const result = checkDate(dayjs("2026-09-06"), pastDateBounds(now));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("05/09/2026");
    expect(checkDate(dayjs("2026-09-05"), pastDateBounds(now)).ok).toBe(true);
  });
});

describe("checkDateRange / clampDateRange", () => {
  it("từ sau đến là lỗi", () => {
    expect(checkDateRange(dayjs("2026-02-01"), dayjs("2026-01-01")).ok).toBe(
      false,
    );
    expect(checkDateRange(dayjs("2026-01-01"), dayjs("2026-01-01")).ok).toBe(
      true,
    );
  });

  it("kẹp khoảng lệch về trong mốc và đảo lại đúng thứ tự", () => {
    const [f, t] = clampDateRange(
      dayjs("9999-01-01"),
      dayjs("1990-01-01"),
      defaultDateBounds(now),
    );
    expect(f?.format("YYYY-MM-DD")).toBe("2000-01-01");
    expect(t?.format("YYYY-MM-DD")).toBe("2036-09-05");
  });
});
