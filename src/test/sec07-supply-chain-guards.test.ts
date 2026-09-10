import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * WWHN-SEC-07 — hàng rào tĩnh cho rủi ro chuỗi cung ứng đã được đánh giá.
 *
 * BỐI CẢNH (đo 08/09/2026, `yarn audit --level high`): 6 advisory mức High.
 * Sau khi truy vết từng cái tới đường đi thật trong ứng dụng:
 *
 *   browserslist  — chỉ chạy lúc BUILD, kịch bản tấn công cần kẻ tấn công ghi
 *                   được browserslist-stats.json trong repo. Không phải bề mặt
 *                   của sản phẩm đang chạy.
 *   undici        — phụ thuộc bắc cầu của công cụ, không vào bundle trình duyệt.
 *   react-router  — lỗ ở chế độ RSC. Ứng dụng là SPA Vite, không dùng RSC.
 *   xlsx (SheetJS)— Prototype Pollution + ReDoS, và KHÔNG CÓ bản vá trên npm
 *                   (SheetJS đã rời npm; bản vá chỉ có ở cdn.sheetjs.com).
 *
 * Điểm mấu chốt của xlsx: cả hai lỗ đều nằm ở đường ĐỌC/PHÂN TÍCH file. Ứng
 * dụng hiện chỉ GHI file (aoa_to_sheet + writeFile) và không bao giờ đọc một
 * file .xlsx do người dùng cung cấp — nên hai lỗ đó KHÔNG chạm tới được.
 *
 * VÌ SAO CẦN TEST NÀY THAY VÌ MỘT DÒNG GHI CHÚ: kết luận "không chạm tới được"
 * đúng ở hôm nay và im lặng sai vào ngày ai đó thêm chức năng "nhập Excel".
 * Lúc đó không có cảnh báo nào — chỉ có một `XLSX.read(file)` trông rất bình
 * thường trong một PR bình thường. Test này biến kết luận đó thành một ràng
 * buộc được kiểm lại ở mọi lần chạy CI.
 *
 * NẾU THẬT SỰ CẦN NHẬP EXCEL Ở FE: đừng xoá test này. Hoặc chuyển việc phân
 * tích file sang backend (nơi đã có DocumentAttachmentScanner + giới hạn dung
 * lượng + kiểm MIME thật), hoặc đổi sang bản SheetJS từ cdn.sheetjs.com rồi cập
 * nhật ghi chú ở đây kèm ngày và người quyết định.
 */

const SRC_ROOT = path.resolve(__dirname, "..");

/** API của SheetJS nằm trên đường ĐỌC — tức là đường có lỗ bảo mật. */
const FORBIDDEN_XLSX_PARSE_APIS = [
  "XLSX.read",
  "XLSX.readFile",
  "XLSX.utils.sheet_to_json",
  "XLSX.utils.sheet_to_csv",
  "XLSX.utils.sheet_to_html",
];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__snapshots__") continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (
      /\.(ts|tsx)$/.test(entry) &&
      !full.endsWith(path.basename(__filename))
    ) {
      acc.push(full);
    }
  }
  return acc;
}

describe("WWHN-SEC-07 — hàng rào chuỗi cung ứng", () => {
  it("không có chỗ nào phân tích file Excel bằng SheetJS ở phía trình duyệt", () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, "utf8");
      for (const api of FORBIDDEN_XLSX_PARSE_APIS) {
        if (content.includes(api)) {
          offenders.push(`${path.relative(SRC_ROOT, file)} -> ${api}`);
        }
      }
    }

    expect(
      offenders,
      "SheetJS (xlsx) có Prototype Pollution + ReDoS ở đường đọc và KHÔNG có bản vá trên npm. " +
        "Đưa việc phân tích file sang backend, hoặc dùng bản từ cdn.sheetjs.com. " +
        "Vi phạm:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("xlsx chỉ được dùng qua đúng một tiện ích xuất file", () => {
    // Gom về một chỗ thì đánh giá bảo mật ở trên chỉ cần đọc một file, thay vì
    // phải quét lại toàn bộ màn hình mỗi lần có advisory mới.
    const importers = collectSourceFiles(SRC_ROOT).filter((file) => {
      const content = readFileSync(file, "utf8");
      return /from ["']xlsx["']/.test(content);
    });

    expect(
      importers.map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, "/")),
    ).toEqual(["shared/utils/export-xlsx.ts"]);
  });
});
