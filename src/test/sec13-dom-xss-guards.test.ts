import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * WWHN-SEC-13 — hàng rào tĩnh chống DOM-XSS.
 *
 * Trạng thái 09/09/2026: toàn bộ `src/` KHÔNG có `dangerouslySetInnerHTML`,
 * không gán `innerHTML`/`outerHTML`, không `insertAdjacentHTML`, không
 * `document.write`, không `eval`/`new Function`. Mọi dữ liệu server đều đi qua
 * text node của React nên XSS "đúng-theo-cấu-trúc" (correct-by-construction).
 *
 * Kết luận đó chỉ đúng tới khi ai đó thêm một chỗ render HTML thô — thường là
 * để hiển thị mô tả có định dạng, hay dán một snippet từ thư viện. Test này
 * biến quy ước thành ràng buộc chạy ở mọi lượt CI, giống hàng rào SheetJS ở
 * `sec07-supply-chain-guards.test.ts`.
 *
 * NẾU THẬT SỰ CẦN RENDER HTML: sanitize bằng DOMPurify (thêm dependency có chủ
 * đích), gom về một tiện ích duy nhất trong `shared/`, rồi cập nhật allow-list
 * dưới đây kèm ngày và người quyết định — đừng xoá test.
 */

const SRC_ROOT = path.resolve(__dirname, "..");

/** Các sink DOM-XSS bị cấm trong mã sản phẩm (không áp cho file test). */
const FORBIDDEN_SINKS: Array<{ label: string; pattern: RegExp }> = [
  { label: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/ },
  // Chỉ bắt GÁN (một dấu =), không bắt ĐỌC innerHTML hay so sánh ==.
  {
    label: "innerHTML/outerHTML assignment",
    pattern: /\.(?:inner|outer)HTML\s*=(?!=)/,
  },
  { label: "insertAdjacentHTML", pattern: /\.insertAdjacentHTML\s*\(/ },
  { label: "document.write", pattern: /document\.write(?:ln)?\s*\(/ },
  { label: "eval()", pattern: /(?<![\w.])eval\s*\(/ },
  { label: "new Function()", pattern: /new\s+Function\s*\(/ },
];

/** File sản phẩm được phép chứa chuỗi khớp mẫu (hiện tại: không có). */
const ALLOWLIST: string[] = [];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__snapshots__") continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    // File test được phép đọc innerHTML để assert — chỉ soi mã sản phẩm.
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    if (full.includes(`${path.sep}test${path.sep}`)) continue;
    acc.push(full);
  }
  return acc;
}

describe("WWHN-SEC-13 — hàng rào DOM-XSS", () => {
  it("mã sản phẩm không chứa sink render HTML thô hay eval", () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
      const rel = path.relative(SRC_ROOT, file).replace(/\\/g, "/");
      if (ALLOWLIST.includes(rel)) continue;
      const content = readFileSync(file, "utf8");
      for (const { label, pattern } of FORBIDDEN_SINKS) {
        if (pattern.test(content)) {
          offenders.push(`${rel} -> ${label}`);
        }
      }
    }

    expect(
      offenders,
      "Phát hiện sink DOM-XSS mới trong mã sản phẩm. Nếu bắt buộc phải render " +
        "HTML, sanitize bằng DOMPurify trong một tiện ích dùng chung rồi khai " +
        "vào ALLOWLIST của test này kèm lý do. Vi phạm:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
