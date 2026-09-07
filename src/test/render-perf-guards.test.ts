/**
 * HÀNG RÀO HIỆU NĂNG RENDER — chống tái diễn đúng sự cố ngày 06/09/2026.
 *
 * Sự cố: người dùng báo INP 14.696 ms trên `/reports/traceability`. Tái hiện
 * được: MỘT long task 14.666 ms khi gõ một ký tự vào ô lọc. Ba nguyên nhân cộng
 * dồn (xem `docs/perf/FE_PERF_AUDIT_2026-09-06.md`):
 *
 *   1. cột STT gọi `rows.indexOf(row)` bên trong `render` → O(n²), ~35 triệu
 *      phép so sánh với 5.956 dòng;
 *   2. đổ TRỌN tập đã lọc vào DOM → 293.514 node;
 *   3. mỗi phím gõ dựng lại cả màn ở mức ưu tiên GẤP.
 *
 * Hai luật dưới đây chặn (1) và (3) quay lại. Luật (2) đã được chặn bằng thiết
 * kế: `ResponsiveDataTable` tự cắt cửa sổ vẽ cho mọi bảng.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SCAN_ROOTS = [
  join(process.cwd(), "src", "modules"),
  join(process.cwd(), "src", "shared"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      out.push(full);
  }
  return out;
}

const rel = (file: string) =>
  relative(process.cwd(), file).split(sep).join("/");

/** File tự ĐỊNH NGHĨA lớp thay thế — được phép nhắc tới `indexOf` để giải thích. */
const HELPER_FILES = new Set([
  "src/shared/components/data-display/row-index.ts",
  "src/shared/components/data-display/useClientSort.ts",
  "src/shared/components/data-display/useRenderWindow.ts",
]);

/**
 * Ngoại lệ ĐÃ RÀ SOÁT: những chỗ này KHÔNG nằm trong đường render.
 *
 * Lớp lỗi mà luật này chặn là "quét lại cả mảng CHO TỪNG DÒNG khi vẽ" — tức
 * O(n²) mỗi lần render. Một lời gọi trong trình xử lý sự kiện chạy đúng MỘT lần
 * cho MỘT cú bấm, còn trong service thì chạy một lần cho một lần quét mã. Cả hai
 * đều là O(n) một lần, không thuộc lớp lỗi này.
 *
 * Thêm vào đây chỉ khi đã kiểm rằng lời gọi nằm ngoài thân render.
 */
const REVIEWED_NON_RENDER = new Set([
  // onClick mở modal chi tiết — một lần cho một cú bấm.
  "src/modules/reports/operations/TabInventoryFlow.tsx",
  // Vòng lặp xử lý kết quả quét mã, không phải render.
  "src/modules/shipping/services/shippingService.ts",
]);

describe("Hàng rào hiệu năng render", () => {
  const files = SCAN_ROOTS.flatMap((root) => walk(root));

  it("không màn nào đánh số dòng bằng indexOf/findIndex trong render", () => {
    /**
     * Bắt đúng khuôn mẫu đã gây sự cố: gọi `<mảng>.indexOf(<biến dòng>)` hoặc
     * `<mảng>.findIndex(r => r.id === row.id)`. Dùng `rowIndexOf(rows, row)` —
     * tra bằng Map nên O(1) mỗi dòng.
     *
     * CHỈ soi lời gọi trên MỘT BIẾN DÒNG (row/record/item/entry/line/r). Tìm
     * kiếm vị trí của một giá trị vô hướng (`codes.indexOf(value)`) không thuộc
     * lớp lỗi này và không bị chặn.
     */
    const offenders: string[] = [];
    for (const file of files) {
      const path = rel(file);
      if (HELPER_FILES.has(path) || REVIEWED_NON_RENDER.has(path)) continue;
      const source = readFileSync(file, "utf8");
      const hits = [
        ...source.matchAll(
          /\.\s*indexOf\(\s*(row|record|item|entry|line|r)\s*\)/g,
        ),
        ...source.matchAll(
          /\.\s*findIndex\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.id\s*===\s*\w+\.id\s*\)/g,
        ),
      ];
      if (hits.length) offenders.push(`${path} (${hits.length})`);
    }
    expect(offenders).toEqual([]);
  });

  it("bộ lọc trong khối báo cáo đổi từ khoá qua transition, và ô nhập giữ bản nháp", () => {
    /**
     * Hai mảnh PHẢI đi cùng nhau. Có transition mà không có bản nháp thì chính ô
     * nhập trở thành thứ bị chậm (ký tự chờ cả màn dựng xong mới hiện); có bản
     * nháp mà không có transition thì màn vẫn dựng lại ở mức gấp.
     */
    const hook = readFileSync(
      join(
        process.cwd(),
        "src/modules/reports/operations/report-section-filter.ts",
      ),
      "utf8",
    );
    expect(hook).toContain("startTransition");

    const bar = readFileSync(
      join(
        process.cwd(),
        "src/modules/reports/operations/SectionFilterBar.tsx",
      ),
      "utf8",
    );
    expect(bar).toContain("value={draft}");
  });

  it("bảng dùng chung luôn cắt cửa sổ vẽ", () => {
    const table = readFileSync(
      join(
        process.cwd(),
        "src/shared/components/data-display/ResponsiveDataTable.tsx",
      ),
      "utf8",
    );
    expect(table).toContain("useRenderWindow");
    // Thân bảng phải vẽ phần ĐANG TRONG CỬA SỔ, không phải cả tập.
    expect(table).toContain("visibleRows.map");
    expect(table).not.toContain("sortedRows.map");
  });
});
