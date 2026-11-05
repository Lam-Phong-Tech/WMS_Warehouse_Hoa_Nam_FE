import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  selectExportWorkbook,
  safeExportFilename,
} from "./report-export-workbook";
function source() {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Mã phiếu", "Mã SKU", "Tên SKU", "Đã post"],
      ["PX1", "A", "Pin", 2],
      ["PX1", "B", "Máy", 3],
      ["PX2", "A", "Pin", 8],
    ]),
    "Source",
  );
  return b;
}
describe("export workbook choices", () => {
  it("keeps every line of selected documents and selected sheets only", () => {
    const b = selectExportWorkbook(source(), {
      filename: "x",
      sectionIds: ["detail"],
      match: { columns: ["Mã phiếu"], values: ["PX1"] },
    });
    expect(b.SheetNames).toHaveLength(1);
    const rows = XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]], {
      header: 1,
    });
    expect(rows).toEqual([
      ["Mã phiếu", "Mã SKU", "Tên SKU", "Đã post"],
      ["PX1", "A", "Pin", 2],
      ["PX1", "B", "Máy", 3],
    ]);
  });
  it("aggregates quantities by SKU without summing unrelated numeric columns", () => {
    const b = selectExportWorkbook(source(), {
      filename: "x",
      sectionIds: ["sku"],
    });
    expect(XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]])).toEqual([
      { "Mã SKU": "A", "Tên SKU": "Pin", "Đã post": 10 },
      { "Mã SKU": "B", "Tên SKU": "Máy", "Đã post": 3 },
    ]);
  });
  it("fails closed when the server cannot identify the selected scope", () => {
    expect(() =>
      selectExportWorkbook(source(), {
        filename: "x",
        sectionIds: ["detail"],
        match: { columns: ["Case"], values: ["PX1"] },
      }),
    ).toThrow();
  });
  it("normalizes filename and only one extension", () => {
    expect(safeExportFilename(" ../Báo:cáo.XLSX.xlsx ", "xlsx")).toBe(
      "..-Báo-cáo.xlsx",
    );
  });
});

it("counts import totals once per batch even when each error repeats the totals", () => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Import ID", "Tổng dòng", "Dòng hợp lệ", "Dòng lỗi", "Mã lỗi"],
      ["I1", 100, 97, 3, "E1"],
      ["I1", 100, 97, 3, "E2"],
      ["I1", 100, 97, 3, "E3"],
    ]),
    "Source",
  );
  const selected = selectExportWorkbook(b, {
    filename: "x",
    sectionIds: ["summary"],
  });
  const rows = XLSX.utils.sheet_to_json(
    selected.Sheets[selected.SheetNames[0]],
    { header: 1 },
  );
  expect(rows).toContainEqual(["Tổng dòng", 100]);
  expect(rows).toContainEqual(["Dòng hợp lệ", 97]);
  expect(rows).toContainEqual(["Dòng lỗi", 3]);
  expect(rows).toContainEqual(["Mục trong phạm vi", 1]);
});
it("includes actual issued quantities in recipient SKU summaries", () => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Mã SKU", "Tên SKU", "Yêu cầu", "Đã xuất"],
      ["A", "Pin", 5, 3],
      ["A", "Pin", 7, 4],
    ]),
    "Source",
  );
  const selected = selectExportWorkbook(b, {
    filename: "x",
    sectionIds: ["sku"],
  });
  expect(
    XLSX.utils.sheet_to_json(selected.Sheets[selected.SheetNames[0]]),
  ).toEqual([{ "Mã SKU": "A", "Tên SKU": "Pin", "Yêu cầu": 12, "Đã xuất": 7 }]);
});
