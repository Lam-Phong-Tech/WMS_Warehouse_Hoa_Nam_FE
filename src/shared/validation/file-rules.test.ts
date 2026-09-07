import { describe, expect, it } from "vitest";
import {
  FILE_RULES,
  FILE_SIZE_LIMITS,
  acceptAttribute,
  buildFileRule,
  checkFile,
  describeExtensions,
  fileExtension,
  formatFileSize,
  matchesFileRule,
} from "./file-rules";

/** File giả: chỉ cần `name`, `type`, `size` — ba thứ mà luật đọc tới. */
function fakeFile(name: string, type: string, size = 1024): File {
  return { name, type, size } as File;
}

describe("fileExtension", () => {
  it("trả đuôi viết thường kèm dấu chấm", () => {
    expect(fileExtension("Bao-Cao.XLSX")).toBe(".xlsx");
    expect(fileExtension("anh.jpeg")).toBe(".jpeg");
  });

  it("tệp không đuôi và tệp ẩn kiểu Unix đều không có đuôi", () => {
    expect(fileExtension("khong-duoi")).toBe("");
    expect(fileExtension(".gitignore")).toBe("");
  });

  it("chỉ lấy đuôi CUỐI CÙNG — chặn kiểu 'anh.jpg.exe'", () => {
    expect(fileExtension("anh.jpg.exe")).toBe(".exe");
  });
});

describe("checkFile — bug gốc 06/09/2026 (kéo-thả không kiểm loại tệp)", () => {
  it("từ chối .exe thả vào ô đính kèm chứng từ", () => {
    const result = checkFile(
      fakeFile("virus.exe", "application/x-msdownload"),
      FILE_RULES.documentAttachment,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("type");
      expect(result.message).toContain("virus.exe");
    }
  });

  it("từ chối .exe đội lốt bằng cách thêm đuôi ảnh phía trước", () => {
    const result = checkFile(
      fakeFile("hoa-don.pdf.exe", ""),
      FILE_RULES.documentAttachment,
    );
    expect(result.ok).toBe(false);
  });

  it("nhận ảnh và PDF hợp lệ", () => {
    expect(
      checkFile(fakeFile("a.jpg", "image/jpeg"), FILE_RULES.documentAttachment)
        .ok,
    ).toBe(true);
    expect(
      checkFile(
        fakeFile("hoa-don.pdf", "application/pdf"),
        FILE_RULES.documentAttachment,
      ).ok,
    ).toBe(true);
  });

  it("MIME rỗng vẫn cho qua khi đuôi hợp lệ (trình duyệt hay trả rỗng)", () => {
    expect(
      checkFile(fakeFile("bang-ke.xls", ""), FILE_RULES.excelImport).ok,
    ).toBe(true);
  });

  it("đuôi hợp lệ nhưng MIME lệch hẳn thì vẫn từ chối", () => {
    const result = checkFile(
      fakeFile("anh.jpg", "application/x-msdownload"),
      FILE_RULES.warrantyImage,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("type");
  });

  it("vượt trần dung lượng thì báo lỗi size, không phải type", () => {
    const result = checkFile(
      fakeFile("to.jpg", "image/jpeg", FILE_SIZE_LIMITS.image + 1),
      FILE_RULES.warrantyImage,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("size");
      expect(result.message).toContain("10 MB");
    }
  });

  it("đúng bằng trần thì vẫn nhận (biên bao gồm)", () => {
    expect(
      checkFile(
        fakeFile("vua.jpg", "image/jpeg", FILE_SIZE_LIMITS.image),
        FILE_RULES.warrantyImage,
      ).ok,
    ).toBe(true);
  });
});

describe("matchesFileRule — phân loại ảnh/video ở màn chi tiết bảo hành", () => {
  it("tách đúng ảnh và video, kể cả khi MIME rỗng", () => {
    const image = fakeFile("a.png", "");
    const video = fakeFile("b.mp4", "");
    expect(matchesFileRule(image, FILE_RULES.warrantyImage)).toBe(true);
    expect(matchesFileRule(image, FILE_RULES.warrantyVideo)).toBe(false);
    expect(matchesFileRule(video, FILE_RULES.warrantyVideo)).toBe(true);
    expect(matchesFileRule(video, FILE_RULES.warrantyImage)).toBe(false);
  });

  it("tệp lạ không thuộc nhóm nào", () => {
    const other = fakeFile("script.js", "text/javascript");
    expect(matchesFileRule(other, FILE_RULES.warrantyImage)).toBe(false);
    expect(matchesFileRule(other, FILE_RULES.warrantyVideo)).toBe(false);
  });
});

describe("buildFileRule — luật động từ cấu hình BE (nhập SKU)", () => {
  it("chuẩn hoá 'xlsx' và '.CSV' về '.xlsx' / '.csv'", () => {
    const rule = buildFileRule({
      extensions: ["xlsx", ".CSV"],
      maxBytes: 5 * 1024 * 1024,
      fallback: FILE_RULES.excelImport,
    });
    expect(rule.extensions).toEqual([".xlsx", ".csv"]);
    expect(rule.maxBytes).toBe(5 * 1024 * 1024);
    // Danh sách đuôi khác luật gốc ⇒ bỏ vòng MIME để không từ chối oan.
    expect(rule.mimes).toEqual([]);
  });

  it("BE chưa trả cấu hình thì rơi về luật Excel dùng chung", () => {
    const rule = buildFileRule({
      extensions: null,
      maxBytes: null,
      fallback: FILE_RULES.excelImport,
    });
    expect(rule).toEqual(FILE_RULES.excelImport);
  });

  it("maxFileSizeMb = 0 của BE không được biến trần thành 0", () => {
    const rule = buildFileRule({
      extensions: [],
      maxBytes: 0,
      fallback: FILE_RULES.excelImport,
    });
    expect(rule.maxBytes).toBe(FILE_SIZE_LIMITS.excel);
  });
});

describe("hiển thị", () => {
  it("accept dùng đúng danh sách đuôi của luật", () => {
    expect(acceptAttribute(FILE_RULES.warrantyImage)).toBe(
      ".jpg,.jpeg,.png,.webp",
    );
    expect(describeExtensions(FILE_RULES.excelImport)).toBe(".xlsx, .xls");
  });

  it("trần MB tròn không hiện phần thập phân", () => {
    expect(formatFileSize(FILE_SIZE_LIMITS.document)).toBe("15 MB");
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
  });
});
