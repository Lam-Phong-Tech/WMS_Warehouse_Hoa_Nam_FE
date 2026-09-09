/**
 * HÀNG RÀO "KHÔNG CÒN MÃ MÁY GIỮA MÀN TIẾNG VIỆT".
 *
 * Người dùng 2026-09-09 báo màn "Báo cáo tồn kho & đối soát": thẻ KPI "Lỗi /
 * cách ly" có dòng mô tả ghi thẳng `DEFECTIVE và QUARANTINE`. Chỗ RENDER dữ
 * liệu thì đã đi qua bảng nhãn từ lâu ([[be-enum-must-pass-label-map]]), nhưng
 * bảng CHUỖI GIAO DIỆN thì chưa ai canh: người viết màn chép mã enum vào câu
 * mô tả là lọt thẳng ra UI mà không test nào đỏ.
 *
 * Hai luật dưới đây đóng đúng lỗ đó — kiểm TĨNH trên `MESSAGES_VI`/`MESSAGES_EN`
 * nên không phụ thuộc màn nào được mount:
 *
 *  1. Không chuỗi giao diện nào được chứa mã dạng `HOA_CÓ_GẠCH_DƯỚI`
 *     (`PENDING_ENRICHMENT`, `NON_SELLABLE`…) — hình dạng đó chắc chắn là mã máy.
 *  2. Không chuỗi TIẾNG VIỆT nào được chứa một mã enum mà chính dự án đã có
 *     nhãn (`DEFECTIVE`, `QUARANTINE`, `ACTIVE`…). Tập mã được thu thập TỰ ĐỘNG
 *     từ khoá của mọi bảng nhãn trong `src`, nên bảng nhãn mới thêm sau này
 *     được canh luôn mà không phải sửa test.
 *
 * Luật 2 cố ý KHÔNG áp cho `MESSAGES_EN`: nhãn nhóm tiếng Anh viết hoa toàn
 * phần ("SNAPSHOT ANALYSIS") trùng hình dạng mã một cách vô hại.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGES_VI } from "@/shared/i18n/messages";
import { MESSAGES_EN } from "@/shared/i18n/messages.en";

const SRC = join(process.cwd(), "src");

/** Mã máy chắc chắn: HOA, có ít nhất một gạch dưới. */
const UNDERSCORE_CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

/** Từ viết HOA liền, đủ dài để có thể là mã enum một từ (`DEFECTIVE`). */
const UPPER_WORD = /\b[A-Z]{4,}\b/g;

/**
 * Chuỗi được phép giữ mã, kèm LÝ DO. Khoá là đường dẫn khoá trong bảng chuỗi.
 * Không thêm mục mới chỉ để test hết đỏ — mã lọt ra UI là lỗi cần sửa, không
 * phải ngoại lệ cần khai báo.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    "iam.role.codePlaceholder",
    "ví dụ ĐỊNH DẠNG mã vai trò mà người dùng phải tự gõ (role_code là mã " +
      "nghiệp vụ hiện thô hợp lệ), không phải nhãn của một giá trị enum",
  ],
]);

/** Viết tắt kỹ thuật đã quen mắt, hiện nguyên là đúng. */
const ALLOWED_WORDS = new Set([
  "HTTPS",
  "WEBP",
  "WEBM",
  "JPEG",
  "TRAY",
]);

type Entry = { path: string; text: string };

function flatten(node: unknown, trail: string[], out: Entry[]): void {
  if (typeof node === "string") {
    out.push({ path: trail.join("."), text: node });
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    flatten(value, [...trail, key], out);
  }
}

function entriesOf(messages: unknown): Entry[] {
  const out: Entry[] = [];
  flatten(messages, [], out);
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(full, out);
      continue;
    }
    if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Mọi mã enum mà dự án ĐÃ có nhãn — lấy từ khoá của các bảng nhãn
 * (`DEFECTIVE: "Lỗi"`). Quét tĩnh thay vì import từng bảng: registry mới thêm
 * ở module bất kỳ cũng được canh mà không phải sửa danh sách import ở đây.
 */
function collectEnumCodes(): Set<string> {
  const codes = new Set<string>();
  for (const file of walk(SRC)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]{3,})\s*:\s*["'`]/);
      if (match) codes.add(match[1]);
    }
  }
  return codes;
}

const ENUM_CODES = collectEnumCodes();

describe("Mã enum của BE không được nằm trong chuỗi giao diện", () => {
  it("thu thập được từ điển mã enum từ các bảng nhãn", () => {
    // Nếu con số này về 0 thì hai bài kiểm dưới đây trở thành vô hiệu mà vẫn xanh.
    expect(ENUM_CODES.size).toBeGreaterThan(50);
    expect(ENUM_CODES.has("DEFECTIVE")).toBe(true);
    expect(ENUM_CODES.has("QUARANTINE")).toBe(true);
  });

  it("không chuỗi nào (VI hoặc EN) chứa mã HOA_CÓ_GẠCH_DƯỚI", () => {
    const offenders: string[] = [];
    for (const [language, messages] of [
      ["VI", MESSAGES_VI],
      ["EN", MESSAGES_EN],
    ] as const) {
      for (const entry of entriesOf(messages)) {
        if (ALLOWED.has(entry.path)) continue;
        const found = entry.text.match(UNDERSCORE_CODE) ?? [];
        if (found.length > 0) {
          offenders.push(
            `${language} · ${entry.path} → ${[...new Set(found)].join(", ")} · "${entry.text}"`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("không chuỗi tiếng Việt nào chứa mã enum đã có nhãn (DEFECTIVE, ACTIVE…)", () => {
    const offenders: string[] = [];
    for (const entry of entriesOf(MESSAGES_VI)) {
      if (ALLOWED.has(entry.path)) continue;
      const found = (entry.text.match(UPPER_WORD) ?? []).filter(
        (word) => ENUM_CODES.has(word) && !ALLOWED_WORDS.has(word),
      );
      if (found.length > 0) {
        offenders.push(
          `${entry.path} → ${[...new Set(found)].join(", ")} · "${entry.text}"`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("Bảng nhãn không được lấy chính mã làm nhãn", () => {
  it("mọi nhãn hiển thị đều là chữ, không phải mã enum", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const relativePath = relative(process.cwd(), file).split(sep).join("/");
      // Bảng nhãn nằm ở constants/labels; nơi khác dùng cùng cú pháp cho map
      // kỹ thuật (mã → mã) nên không soi để tránh báo nhầm.
      if (!/(labels|business-labels)\.ts$/.test(relativePath)) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          const match = line.match(
            /^\s*([A-Z][A-Z0-9_]{2,})\s*:\s*"([^"]+)"/,
          );
          if (!match) return;
          const value = match[2];
          const looksLikeCode =
            /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value) ||
            (/^[A-Z]{4,}$/.test(value) && !ALLOWED_WORDS.has(value));
          if (looksLikeCode) {
            offenders.push(`${relativePath}:${index + 1} ${match[1]} → ${value}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
