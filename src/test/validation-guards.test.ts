/**
 * HÀNG RÀO NHẬP LIỆU — chống tái diễn các lỗi validate đã từng lọt.
 *
 * Lịch sử (đọc để biết vì sao từng luật tồn tại):
 *  - 05/09/2026: "định mức nhập 10000000000000 vẫn được, ngày gõ năm 9999 vẫn
 *    được" → luật 1 và 2.
 *  - 06/09/2026 (rà soát toàn dự án): kéo-thả một `.exe` vào ô đính kèm chứng
 *    từ là tệp bay thẳng lên API, vì `accept` CHỈ lọc hộp thoại chọn tệp
 *    → luật 4, 5, 6. Cùng đợt: luật 2 chỉ soi cả FILE nên ô ngày thứ tư thêm
 *    vào một file đã import date-rules mà quên mốc vẫn lọt → luật 3.
 *
 * Quét CẢ `src/modules` LẪN `src/shared`: trước đây chỉ quét modules, mà
 * `src/shared` mới là chỗ các component nhập liệu dùng chung nằm.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SCAN_ROOTS = [
  join(process.cwd(), "src", "modules"),
  join(process.cwd(), "src", "shared"),
];

/** Chính các file ĐỊNH NGHĨA luật — được phép chứa hằng số/regex thô. */
const RULE_FILES = new Set([
  "src/shared/validation/file-rules.ts",
  "src/shared/validation/number-rules.ts",
  "src/shared/validation/date-rules.ts",
  "src/shared/validation/text-rules.ts",
]);

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

const rel = (file: string) =>
  relative(process.cwd(), file).split(sep).join("/");

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const COMMENT_LINE = /^\s*(\/\/|\*)/;

/**
 * Bỏ chú thích trước khi quét. Không có bước này thì chính câu giải thích "vì
 * sao KHÔNG dùng ô number của trình duyệt" trong UiNumberField.tsx lại bị đếm
 * là vi phạm — hàng rào đỏ vì tài liệu chứ không phải vì code.
 */
function stripComments(source: string): string {
  return source
    .replace(BLOCK_COMMENT, "")
    .split("\n")
    .filter((line) => !COMMENT_LINE.test(line))
    .join("\n");
}

const sources: Array<{ path: string; content: string }> = SCAN_ROOTS.flatMap(
  (root) => walk(root),
)
  .map((file) => ({
    path: rel(file),
    content: stripComments(readFileSync(file, "utf8")),
  }))
  .filter((entry) => !RULE_FILES.has(entry.path));

/** Số dòng (1-based) của một offset — để câu lỗi chỉ thẳng vào chỗ vi phạm. */
function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/**
 * Cắt ra đoạn JSX của phần tử bao quanh vị trí `at`: lùi về thẻ mở gần nhất,
 * tiến tới `/>` đầu tiên. Đủ cho mọi ô nhập của dự án — tất cả đều tự đóng.
 */
function enclosingElement(content: string, at: number): string {
  const open = content.lastIndexOf("<", at);
  const close = content.indexOf("/>", at);
  if (open < 0) return content.slice(Math.max(0, at - 400), at + 400);
  return content.slice(open, close < 0 ? at + 400 : close + 2);
}

/** Mọi vị trí khớp `pattern` trong `content`. */
function positionsOf(content: string, pattern: RegExp): number[] {
  const out: number[] = [];
  const regex = new RegExp(pattern.source, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) out.push(match.index);
  return out;
}

const NATIVE_DATE = /type=["'](date|datetime-local)["']/;
const NATIVE_NUMBER = /type=["']number["']/;

describe("hàng rào nhập liệu — ô số", () => {
  it('1. không còn ô type="number" trần', () => {
    // Ô number của trình duyệt không chặn "e", dấu âm hay độ dài; mọi ô số
    // phải là UiNumberField (state chuỗi) hoặc UiFormNumber (RHF).
    const offenders = sources
      .filter((entry) => NATIVE_NUMBER.test(entry.content))
      .map((entry) => entry.path);
    expect(offenders).toEqual([]);
  });
});

describe("hàng rào nhập liệu — ô ngày", () => {
  it("2. file dùng ô ngày gốc phải import date-rules", () => {
    const offenders = sources
      .filter(
        (entry) =>
          NATIVE_DATE.test(entry.content) &&
          !entry.content.includes("@/shared/validation/date-rules"),
      )
      .map((entry) => entry.path);
    expect(offenders).toEqual([]);
  });

  it("3. TỪNG ô ngày gốc phải mang mốc min/max, không chỉ file có import", () => {
    const offenders: string[] = [];
    for (const { path, content } of sources) {
      for (const at of positionsOf(content, NATIVE_DATE)) {
        const element = enclosingElement(content, at);
        const hasBounds =
          element.includes("htmlInput") ||
          (/\bmin=/.test(element) && /\bmax=/.test(element));
        if (!hasBounds) offenders.push(`${path}:${lineAt(content, at)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("hàng rào nhập liệu — tệp", () => {
  it("4. file có ô chọn tệp hoặc vùng kéo-thả phải import file-rules", () => {
    // `accept` CHỈ lọc hộp thoại chọn tệp; vùng kéo-thả đi vòng qua nó hoàn
    // toàn. Bắt buộc cả hai đường cùng đi qua checkFile().
    const offenders = sources
      .filter((entry) => {
        const hasFileInput = /type=["']file["']/.test(entry.content);
        const hasDrop = entry.content.includes("dataTransfer.files");
        return (
          (hasFileInput || hasDrop) &&
          !entry.content.includes("@/shared/validation/file-rules")
        );
      })
      .map((entry) => entry.path);
    expect(offenders).toEqual([]);
  });

  it("5. không so sánh dung lượng tệp bằng tay", () => {
    // So sánh byte rải rác là cách bốn màn lệch trần nhau.
    const offenders = sources
      .filter((entry) => /\bfile\.size\s*>=?\s/.test(entry.content))
      .map((entry) => entry.path);
    expect(offenders).toEqual([]);
  });

  it("6. không tự kiểm MIME bằng danh sách chép tay", () => {
    const offenders = sources
      .filter((entry) => /includes\(\s*file\.type\s*\)/.test(entry.content))
      .map((entry) => entry.path);
    expect(offenders).toEqual([]);
  });
});

describe("hàng rào nhập liệu — ô chữ", () => {
  it("7. ô nhiều dòng phải khai maxLength", () => {
    // Lưới an toàn 2000 của UiTextField vẫn chạy, nhưng ô nhiều dòng là ô ghi
    // chú/lý do — trần phải nói rõ ngay chỗ khai báo để người đọc màn thấy.
    const offenders: string[] = [];
    for (const { path, content } of sources) {
      for (const at of positionsOf(content, /<UiTextField\b/)) {
        const element = enclosingElement(content, at + 1);
        if (element.includes("multiline") && !element.includes("maxLength")) {
          offenders.push(`${path}:${lineAt(content, at)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("8. không tự chế regex bộ ký tự mã — dùng CODE_REGEX dùng chung", () => {
    // Nhiều bản chép tay của cùng một bộ ký tự là cách "mã tạo được nhưng quét
    // không được" xuất hiện. login.schema giữ bản riêng vì đó là USERNAME_REGEX
    // của hợp đồng đăng nhập với BE, không phải mã nghiệp vụ.
    const allowed = new Set(["src/modules/auth/schemas/login.schema.ts"]);
    const offenders = sources
      .filter(
        (entry) =>
          !allowed.has(entry.path) && /\[A-Za-z0-9\._-\]\+/.test(entry.content),
      )
      .map((entry) => entry.path);
    expect(offenders).toEqual([]);
  });
});
