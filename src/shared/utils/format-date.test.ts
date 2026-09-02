import { describe, expect, it } from "vitest";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";

describe("formatDate", () => {
  it("định dạng ngày theo quy chuẩn dd-mm-yyyy (đệm số 0)", () => {
    expect(formatDate("2026-06-22")).toBe("22-06-2026");
  });

  it("trả về 'Chưa có' khi rỗng hoặc không hợp lệ", () => {
    expect(formatDate(null)).toBe(EMPTY_TEXT);
    expect(formatDate(undefined)).toBe(EMPTY_TEXT);
    expect(formatDate("not-a-date")).toBe(EMPTY_TEXT);
  });
});

describe("formatDateTime", () => {
  it("định dạng ngày giờ theo quy chuẩn dd-mm-yyyy HH:mm (đệm số 0)", () => {
    expect(formatDateTime("2026-06-08T04:10:00")).toBe("08-06-2026 04:10");
  });

  it("trả về 'Chưa có' khi rỗng hoặc không hợp lệ", () => {
    expect(formatDateTime(null)).toBe(EMPTY_TEXT);
    expect(formatDateTime(undefined)).toBe(EMPTY_TEXT);
    expect(formatDateTime("not-a-date")).toBe(EMPTY_TEXT);
  });
});
