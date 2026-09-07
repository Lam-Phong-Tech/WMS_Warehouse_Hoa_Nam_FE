import { describe, expect, it } from "vitest";
import {
  CODE_REGEX,
  TEXT_LIMITS,
  TEXT_RULES,
  checkText,
  codeFormatError,
  isTextValid,
} from "./text-rules";

describe("checkText — bug gốc 06/09/2026 (đếm độ dài không trim)", () => {
  it("chuỗi toàn khoảng trắng là RỖNG, không phải 'đủ 5 ký tự'", () => {
    const result = checkText("     ", TEXT_RULES.reason);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("required");
  });

  it("khoảng trắng hai đầu không được tính vào độ dài", () => {
    // "  abc  " dài 7 nhưng sau trim chỉ còn 3 → vẫn dưới sàn 5.
    const result = checkText("  abc  ", TEXT_RULES.reason);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("min");
  });

  it("trả về chuỗi ĐÃ TRIM để nơi gọi gửi thẳng lên API", () => {
    const result = checkText("  hàng vỡ khi vận chuyển  ", TEXT_RULES.reason);
    expect(result).toEqual({ ok: true, value: "hàng vỡ khi vận chuyển" });
  });

  it("đúng sàn 5 ký tự thì nhận (biên bao gồm)", () => {
    expect(checkText("abcde", TEXT_RULES.reason).ok).toBe(true);
    expect(checkText("abcd", TEXT_RULES.reason).ok).toBe(false);
  });

  it("vượt trần báo reason 'max'", () => {
    const long = "x".repeat(TEXT_LIMITS.reasonMax + 1);
    const result = checkText(long, TEXT_RULES.reason);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("max");
  });

  it("ô không bắt buộc bỏ trống thì bỏ qua mọi luật còn lại", () => {
    expect(checkText("", TEXT_RULES.note)).toEqual({ ok: true, value: "" });
    expect(checkText(null, { max: 5, min: 3 })).toEqual({
      ok: true,
      value: "",
    });
  });

  it("isTextValid nói cùng một chuyện với checkText", () => {
    for (const raw of ["", "   ", "abc", "abcde", "x".repeat(2000)]) {
      expect(isTextValid(raw, TEXT_RULES.reason)).toBe(
        checkText(raw, TEXT_RULES.reason).ok,
      );
    }
  });
});

describe("CODE_REGEX / codeFormatError", () => {
  it("nhận đúng dạng mã đang dùng trong dự án", () => {
    for (const code of [
      "SKU-001",
      "DCH-DRILL-DJZ10A-220V-V1",
      "SKU_DUPLICATE",
      "SKU-IMPORT-v1.1.0",
      "HN-MAY-001",
    ]) {
      expect(CODE_REGEX.test(code)).toBe(true);
    }
  });

  it("từ chối khoảng trắng, dấu tiếng Việt và ký tự phá luồng quét", () => {
    for (const code of [
      "SKU 001",
      "MÁY-BƠM",
      "SKU|001",
      "SKU/001",
      "SKU#001",
      "",
    ]) {
      expect(CODE_REGEX.test(code)).toBe(false);
    }
  });

  it("mã mới sai định dạng thì báo lỗi", () => {
    expect(codeFormatError("SKU 001")).not.toBeNull();
    expect(codeFormatError("SKU-001")).toBeNull();
  });

  it("mã CŨ sai định dạng nhưng KHÔNG đổi thì bỏ qua — màn Sửa không bị khoá", () => {
    expect(codeFormatError("MÃ CŨ", "MÃ CŨ")).toBeNull();
  });

  it("mã cũ sai và bị đổi thành một mã vẫn sai thì báo lỗi", () => {
    expect(codeFormatError("MÃ MỚI", "MÃ CŨ")).not.toBeNull();
  });
});

describe("TEXT_RULES", () => {
  it("luật mã dùng đúng bộ ký tự chung, không tự chế regex riêng", () => {
    expect(TEXT_RULES.code.pattern).toBe(CODE_REGEX);
  });

  it("sàn lý do là một số duy nhất cho cả dự án", () => {
    expect(TEXT_RULES.reason.min).toBe(TEXT_LIMITS.reasonMin);
  });
});
