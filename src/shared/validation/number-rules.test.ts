import { describe, expect, it } from "vitest";
import {
  NUMBER_LIMITS,
  NUMBER_RULES,
  checkNumber,
  sanitizeNumberTyping,
} from "./number-rules";

describe("checkNumber", () => {
  it("rỗng: hợp lệ (null) trừ khi required", () => {
    expect(checkNumber("", NUMBER_RULES.stockMin)).toEqual({
      ok: true,
      value: null,
    });
    expect(checkNumber(null, NUMBER_RULES.stockMin)).toEqual({
      ok: true,
      value: null,
    });
    const required = checkNumber("  ", {
      ...NUMBER_RULES.quantity,
      required: true,
    });
    expect(required.ok).toBe(false);
  });

  it("từ chối 10000000000000 (vượt trần) — bug gốc 05/09/2026", () => {
    const result = checkNumber("10000000000000", NUMBER_RULES.stockMax);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("1.000.000");
  });

  it("từ chối số âm khi sàn là 0", () => {
    expect(checkNumber("-5", NUMBER_RULES.stockMin).ok).toBe(false);
    expect(checkNumber(-1, NUMBER_RULES.quantityOrZero).ok).toBe(false);
  });

  it("từ chối ký hiệu mũ, hex, chuỗi lạ mà Number() vẫn parse được", () => {
    for (const raw of [
      "1e5",
      "0x10",
      "Infinity",
      "--1",
      "1.2.3",
      "abc",
      "1-",
    ]) {
      expect(checkNumber(raw, NUMBER_RULES.stockMin).ok, raw).toBe(false);
    }
  });

  it("số lượng phải nguyên và ≥ 1", () => {
    expect(checkNumber("1.5", NUMBER_RULES.quantity).ok).toBe(false);
    expect(checkNumber("0", NUMBER_RULES.quantity).ok).toBe(false);
    expect(checkNumber("12", NUMBER_RULES.quantity)).toEqual({
      ok: true,
      value: 12,
    });
    expect(
      checkNumber(NUMBER_LIMITS.quantityMax, NUMBER_RULES.quantity).ok,
    ).toBe(true);
    expect(
      checkNumber(NUMBER_LIMITS.quantityMax + 1, NUMBER_RULES.quantity).ok,
    ).toBe(false);
  });

  it("định mức nhận dấu phẩy thập phân kiểu Việt và tối đa 3 số lẻ", () => {
    expect(checkNumber("12,5", NUMBER_RULES.stockMin)).toEqual({
      ok: true,
      value: 12.5,
    });
    expect(checkNumber("1.2345", NUMBER_RULES.stockMin).ok).toBe(false);
  });

  it("định mức tối đa phải ≥ 1 (khớp BE min:1)", () => {
    expect(checkNumber("0", NUMBER_RULES.stockMax).ok).toBe(false);
    expect(checkNumber("0.5", NUMBER_RULES.stockMax).ok).toBe(false);
    expect(checkNumber("1", NUMBER_RULES.stockMax).ok).toBe(true);
  });
});

describe("sanitizeNumberTyping", () => {
  it("bỏ chữ, e, dấu cộng, khoảng trắng", () => {
    expect(sanitizeNumberTyping("1e5", NUMBER_RULES.quantity)).toBe("15");
    expect(sanitizeNumberTyping("+12 3", NUMBER_RULES.quantity)).toBe("123");
    expect(sanitizeNumberTyping("abc", NUMBER_RULES.quantity)).toBe("");
  });

  it("không cho dấu âm khi sàn ≥ 0, cho khi sàn âm", () => {
    expect(sanitizeNumberTyping("-5", NUMBER_RULES.quantity)).toBe("5");
    expect(sanitizeNumberTyping("-5", { min: -100, max: 100 })).toBe("-5");
    expect(sanitizeNumberTyping("5-", { min: -100, max: 100 })).toBe("5");
  });

  it("không cho thập phân khi nguyên; cho một dấu chấm và đổi phẩy → chấm khi thập phân", () => {
    expect(sanitizeNumberTyping("1.5", NUMBER_RULES.quantity)).toBe("15");
    expect(sanitizeNumberTyping("1,5", NUMBER_RULES.stockMin)).toBe("1.5");
    expect(sanitizeNumberTyping("1.2.3", NUMBER_RULES.stockMin)).toBe("1.23");
  });

  it("cắt chuỗi quá dài so với trần và quá số lẻ cho phép", () => {
    expect(sanitizeNumberTyping("10000000000000", NUMBER_RULES.stockMax)).toBe(
      "10000000",
    );
    expect(sanitizeNumberTyping("1.23456", NUMBER_RULES.stockMin)).toBe(
      "1.234",
    );
  });

  it("giữ chuỗi đang gõ dở", () => {
    expect(sanitizeNumberTyping("1.", NUMBER_RULES.stockMin)).toBe("1.");
    expect(sanitizeNumberTyping("-", { min: -1, max: 1 })).toBe("-");
  });
});
