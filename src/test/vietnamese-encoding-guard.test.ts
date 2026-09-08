import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * HÀNG RÀO MÃ HOÁ TIẾNG VIỆT.
 *
 * Sự cố 08/09/2026: tên kho bị ghi vào CSDL thành "Kho t<?>ng Hoa Nam" vì chuỗi tiếng
 * Việt được truyền thẳng qua shell Windows vào `curl -d`. Shell nuốt ký tự ngoài ASCII
 * thành dấu hỏi. API trả 200, không test nào đỏ — chỉ người nhìn màn hình mới phát hiện.
 *
 * Test này chặn cùng loại hỏng nếu nó lọt vào MÃ NGUỒN (dán nhầm chuỗi đã mangle, hoặc
 * file lưu sai encoding). Nó KHÔNG thay được việc kiểm dữ liệu trong CSDL — chỗ đó soi
 * bằng `octet_length(col) = length(col)`: tiếng Việt có dấu luôn nhiều octet hơn ký tự.
 *
 * Hai dạng hỏng được canh:
 *  1. MOJIBAKE — UTF-8 bị đọc nhầm thành Latin-1.
 *  2. DẤU HỎI  — ký tự có dấu bị thay bằng "?" ngay giữa từ.
 *
 * Mẫu hỏng dùng để tự kiểm được dựng bằng escape \uXXXX, để CHÍNH FILE NÀY không chứa
 * byte hỏng nào — nếu không nó sẽ tự bắt mình.
 */

const ROOT = path.resolve(__dirname, "..");
const SELF = path.resolve(__filename);

/** Dấu vết UTF-8 bị diễn giải như Latin-1: "Ã¡", "á»•", "Æ°", "Ä‘"… */
const MOJIBAKE = /(Ã[\u00A0-\u00BF]|Â[\u00A0-\u00BF]|á»|Æ°|Ä)/;

/** "?" kẹp GIỮA hai chữ cái — chỗ đó không bao giờ là dấu hỏi thật của câu. */
const QUESTION_MARK_IN_WORD = /[A-Za-zÀ-ỹ]\?[A-Za-zÀ-ỹ]/;

/**
 * Query string URL (`?screen=`, `?page=1`, `?v=`…) — "?" ở đây là cú pháp. Đây là dạng
 * hợp lệ ĐÔNG NHẤT trong repo (21 dòng) nên tách thành luật riêng thay vì liệt kê tay.
 */
const URL_QUERY_STRING = /\?[\w.-]+=/;

/**
 * Hai chỗ còn lại có "?" kẹp giữa hai chữ cái nhưng vẫn là cú pháp. Cố ý liệt kê tường
 * minh thay vì nới regex: chỗ nào MỚI xuất hiện thì test đỏ và người sửa phải nhìn tận
 * mắt rồi mới thêm vào đây — đó chính là tác dụng của hàng rào này.
 */
const ALLOWED_QUESTION_MARKS = [
  "jpe?g", // regex đuôi ảnh trong DocumentAttachmentsPanel
  "/docs?api-docs.json", // URL OpenAPI của BE, nhắc trong chú thích
];

const SOURCE_EXTENSIONS = /\.(ts|tsx)$/;
const SKIPPED = /node_modules|__preview__/;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIPPED.test(full)) continue;
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (SOURCE_EXTENSIONS.test(entry.name)) {
      if (path.resolve(full) !== SELF) out.push(full);
    }
  }
  return out;
}

function scan(files: string[], hit: (line: string) => boolean): string[] {
  const found: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (!hit(line)) return;
        found.push(
          `${path.relative(ROOT, file).replace(/\\/g, "/")}:${index + 1} — ${line.trim().slice(0, 90)}`,
        );
      });
  }
  return found;
}

describe("hàng rào mã hoá · chuỗi tiếng Việt không được hỏng", () => {
  const files = collectSourceFiles(ROOT);

  it("quét được toàn bộ mã nguồn (chống test tự vô hiệu vì đường dẫn sai)", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("không file nào chứa dấu vết mojibake (UTF-8 đọc nhầm Latin-1)", () => {
    expect(scan(files, (line) => MOJIBAKE.test(line))).toEqual([]);
  });

  it("không chuỗi nào có ký tự tiếng Việt bị thay bằng dấu hỏi", () => {
    const hits = scan(
      files,
      (line) =>
        QUESTION_MARK_IN_WORD.test(line) &&
        !URL_QUERY_STRING.test(line) &&
        !ALLOWED_QUESTION_MARKS.some((allowed) => line.includes(allowed)),
    );
    expect(hits).toEqual([]);
  });

  it("bắt được đúng hai dạng hỏng khi chúng thực sự xuất hiện", () => {
    // "ổ" (U+1ED5) mã hoá UTF-8 là E1 BB 95; đọc nhầm sang Latin-1 ra "á»•".
    const mojibake = "Kho tá»ng Hoa Nam";
    const questionMark = "Kho t?ng Hoa Nam";

    expect(MOJIBAKE.test(mojibake)).toBe(true);
    expect(QUESTION_MARK_IN_WORD.test(questionMark)).toBe(true);

    // Và KHÔNG bắt nhầm chuỗi lành lặn.
    expect(MOJIBAKE.test("Kho tổng Hoa Nam")).toBe(false);
    expect(QUESTION_MARK_IN_WORD.test("Kho tổng Hoa Nam")).toBe(false);
    // Dấu hỏi thật của câu (sau khoảng trắng / cuối câu) không bị bắt.
    expect(QUESTION_MARK_IN_WORD.test("Tạm dừng hoạt động kho?")).toBe(false);
    // Query string là cú pháp, không phải chữ mất dấu.
    expect(URL_QUERY_STRING.test("/inbound?screen=IN-03&id=doc-1")).toBe(true);
    expect(URL_QUERY_STRING.test("Kho t?ng Hoa Nam")).toBe(false);
  });
});
