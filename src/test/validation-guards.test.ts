/**
 * HÀNG RÀO NHẬP LIỆU — chống tái diễn "ô số không trần, ô ngày không mốc"
 * (phản hồi người dùng 05/09/2026: định mức nhập 10000000000000 vẫn được,
 * ngày gõ năm 9999 vẫn được).
 *
 * Hai luật tĩnh, quét toàn bộ src/modules:
 *  1. KHÔNG ô `type="number"` trần. Ô number của trình duyệt không chặn "e",
 *     dấu âm hay độ dài; mọi ô số phải là `UiNumberField` (state chuỗi) hoặc
 *     `UiFormNumber` (RHF) — cả hai lọc ký tự theo `NumberRule` và màn hình
 *     validate bằng `checkNumber()` cùng luật.
 *  2. File nào dùng `<input type="date">`/`datetime-local` gốc (qua UiTextField)
 *     thì PHẢI import từ `@/shared/validation/date-rules` — tức có mốc
 *     min/max và/hoặc `checkDate()`; không có thì năm 0001/9999 đi thẳng lên API.
 *
 * Bộ chọn ngày dùng chung (UiDatePicker/UiFormDate/UiVuexy*) đã tự áp mốc mặc
 * định nên không cần quét.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const MODULES_ROOT = join(process.cwd(), "src", "modules");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(MODULES_ROOT);
const rel = (file: string) =>
  relative(process.cwd(), file).split(sep).join("/");

describe("validation guards", () => {
  it('không còn ô type="number" trần trong src/modules', () => {
    const offenders = files
      .filter((file) => /type=["']number["']/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("file dùng input date gốc phải đi qua date-rules (mốc min/max + checkDate)", () => {
    const offenders = files
      .filter((file) => {
        const content = readFileSync(file, "utf8");
        const usesNativeDate = /type=["'](date|datetime-local)["']/.test(
          content,
        );
        const importsRules = content.includes("@/shared/validation/date-rules");
        return usesNativeDate && !importsRules;
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
