import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";

describe("formatDate", () => {
  it("định dạng ngày theo quy chuẩn d-m-yyyy (không đệm số 0)", () => {
    expect(formatDate("2026-06-22")).toBe("22-6-2026");
  });

  it("trả về '-' khi rỗng hoặc không hợp lệ", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("not-a-date")).toBe("-");
  });
});

describe("formatDateTime", () => {
  it("định dạng ngày giờ theo quy chuẩn d-m-yyyy HH:mm (giờ/phút đệm số 0)", () => {
    expect(formatDateTime("2026-06-08T04:10:00")).toBe("8-6-2026 04:10");
  });

  it("trả về '-' khi rỗng hoặc không hợp lệ", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
    expect(formatDateTime("not-a-date")).toBe("-");
  });
});
