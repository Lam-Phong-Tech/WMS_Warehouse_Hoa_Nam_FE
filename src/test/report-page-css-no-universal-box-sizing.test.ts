/**
 * Chặn tái phát lỗi "ô Tìm SKU trong khối thấp hơn UiSelect đứng cạnh" (RPT-02,
 * 2026-09-03).
 *
 * Các trang port 1:1 từ mockup mang theo reset của demo:
 *   `.hn-xxx *, .hn-xxx *::before, .hn-xxx *::after { box-sizing: border-box }`
 * Phần `.hn-xxx *` có độ đặc hiệu 0-1-0 — bằng class emotion của MUI — và CSS
 * của trang được nạp SAU (đi theo chunk lazy), nên nó đè `box-sizing:
 * content-box` mà `.MuiInputBase-input` cố ý đặt cho <input>. MUI dựng chiều
 * cao ô nhập bằng `height: 1.4375em` + padding theo content-box; bị ép
 * border-box thì 1.4375em phải chứa luôn padding và ô tìm kiếm co lại ~24px.
 *
 * `* { box-sizing: border-box }` trong src/index.css đã phủ toàn app ở đặc hiệu
 * 0-0-0 — đúng tầng để MUI vẫn thắng ở ngoại lệ của nó — nên CSS trang chỉ
 * được reset pseudo-element (không có trong index.css), không được reset `*`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const MODULES_DIR = join(__dirname, "..", "modules");

function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

/** Selector `.scope *` trần (không phải `*::before`/`*::after`, không phải `* +`). */
const UNIVERSAL_ELEMENT_SELECTOR = /(^|,)\s*\.[\w-]+\s+\*\s*(?=,|\{)/m;

describe("CSS trang port không được reset `.scope *` (đè MUI content-box)", () => {
  const files = walkCss(MODULES_DIR);

  it("có ít nhất một file CSS trang để kiểm", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [relative(MODULES_DIR, file), file]))(
    "%s",
    (_label, file) => {
      const css = readFileSync(file, "utf8");
      // Tách từng rule; chỉ soi rule có khai box-sizing.
      const offenders: string[] = [];
      for (const rule of css.split("}")) {
        const brace = rule.indexOf("{");
        if (brace === -1) continue;
        const selector = rule.slice(0, brace);
        const body = rule.slice(brace + 1);
        if (!/box-sizing/.test(body)) continue;
        if (UNIVERSAL_ELEMENT_SELECTOR.test(selector)) {
          offenders.push(selector.trim().replace(/\s+/g, " "));
        }
      }
      expect(offenders, "reset `.scope *` sẽ bóp ô nhập MUI").toEqual([]);
    },
  );
});
