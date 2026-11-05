import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import {
  createStyledReportWorkbook,
  serializeStyledReportWorkbook,
} from "./report-excel-style";
function source() {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Case", "SKU/Model", "Ngày nhận", "Turnaround (ngày)", "Trạng thái"],
      [
        "WC-20261105134007-VVQM",
        "001234",
        "2026-11-05 06:40:07.805649+00:00",
        7.805649,
        "RECEIVED",
      ],
      ["WC-2", "CLMP-DON-S01", "2026-10-30", 2, "COMPLETED"],
    ]),
    "Bao hanh",
  );
  return b;
}
describe("styled report workbook", () => {
  it("writes a readable brand header, bands, wrapped columns, filters and frozen identifiers", async () => {
    const b = await createStyledReportWorkbook(source(), {
      title: "BÁO CÁO BẢO HÀNH",
    });
    const s = b.worksheets[0];
    expect(s.getCell("A1").value).toBe("BÁO CÁO BẢO HÀNH");
    expect(s.getCell("A4").value).toBe("Mã phiếu bảo hành");
    expect(s.getCell("A4").font).toMatchObject({
      bold: true,
      color: { argb: "FFFFFFFF" },
    });
    expect(s.getCell("A4").fill).toMatchObject({
      fgColor: { argb: "FF004E74" },
    });
    expect(s.getCell("A6").fill).toMatchObject({
      fgColor: { argb: "FFEAF5F8" },
    });
    expect(s.getColumn(1).width).toBeGreaterThanOrEqual(32);
    expect(s.getCell("A5").alignment.wrapText).toBe(true);
    expect(s.views[0]).toMatchObject({
      state: "frozen",
      xSplit: 1,
      ySplit: 4,
      showGridLines: false,
    });
    expect(s.autoFilter).toEqual({
      from: { row: 4, column: 1 },
      to: { row: 6, column: 5 },
    });
  });
  it("keeps IDs and enums and formats UTC timestamps in Vietnam while preserving date-only days", async () => {
    const b = await createStyledReportWorkbook(source());
    const s = b.worksheets[0];
    expect(s.getCell("A5").value).toBe("WC-20261105134007-VVQM");
    expect(s.getCell("B5").value).toBe("001234");
    expect(s.getCell("C5").value).toEqual(
      new Date(Date.UTC(2026, 10, 5, 13, 40, 7, 805)),
    );
    expect(s.getCell("C6").value).toEqual(new Date(Date.UTC(2026, 9, 30)));
    expect(s.getCell("C5").numFmt).toBe("dd/mm/yyyy hh:mm");
    expect(s.getCell("D5").value).toBe(7.805649);
    expect(s.getCell("D5").numFmt).toBe("#,##0.00");
    expect(s.getCell("E5").value).toBe("RECEIVED");
    expect(s.getCell("E6").fill).toMatchObject({
      fgColor: { argb: "FFE7F4ED" },
    });
  });
  it("stores the colors and frozen panes in the actual saved XLSX", async () => {
    const buffer = await serializeStyledReportWorkbook(source());
    const saved = new ExcelJS.Workbook();
    await saved.xlsx.load(buffer as never);
    const s = saved.worksheets[0];
    expect(s.getCell("A4").fill).toMatchObject({
      fgColor: { argb: "FF004E74" },
    });
    expect(s.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });
    expect(s.getCell("B5").value).toBe("001234");
    expect(s.rowCount).toBe(6);
  });
  it("does not shift formulas or mistake literal equals-prefixed text for formulas", async () => {
    const b = XLSX.utils.book_new();
    const s = XLSX.utils.aoa_to_sheet([
      ["SKU", "Số lượng"],
      ["=literal", 2],
      ["Tổng", 2],
    ]);
    s.B3 = { t: "n", v: 2, f: "SUM(B2:B2)" };
    XLSX.utils.book_append_sheet(b, s, "Flow");
    const output = await createStyledReportWorkbook(b);
    expect(output.worksheets[0].getCell("B3").value).toMatchObject({
      formula: "SUM(B2:B2)",
      result: 2,
    });
    expect(output.worksheets[0].getCell("A2").value).toBe("=literal");
  });
});

it("finds table headers below stock metadata and keeps every selected worksheet", async () => {
  const b = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Báo cáo tồn"],
    ["Kỳ báo cáo", "2026-10-30 – 2026-11-05"],
    ["Phạm vi", "SKU cần kiểm tra"],
    [],
    ["SKU", "Tồn sổ", "Tồn ghi nhận"],
    ["001", 12, 10],
  ]);
  XLSX.utils.book_append_sheet(b, sheet, "Đối soát");
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Tổng quan", ""],
      ["Số SKU", 1],
    ]),
    "Tổng quan",
  );
  const result = await createStyledReportWorkbook(b);
  expect(result.worksheets.map((s) => s.name)).toEqual([
    "Đối soát",
    "Tổng quan",
  ]);
  expect(result.worksheets[0].getCell("A4").value).toBe("SKU");
  expect(result.worksheets[0].getCell("A5").value).toBe("001");
  expect(result.worksheets[0].getCell("A2").value).toContain(
    "SKU cần kiểm tra",
  );
  expect(result.worksheets[1].getCell("A4").value).toBe("Chỉ tiêu");
  expect(result.worksheets[1].getCell("B5").value).toBe(1);
});
it("retains native numeric dates after a source sheet has been selected", async () => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Mã phiếu", "Ngày nhận"],
      ["WC", 46331],
    ]),
    "Dates",
  );
  const result = await createStyledReportWorkbook(b);
  expect(result.worksheets[0].getCell("B5").value).toBe(46331);
  expect(result.worksheets[0].getCell("B5").numFmt).toBe("dd/mm/yyyy");
});

it("keeps source number formats aligned after blank separator rows", async () => {
  const b = XLSX.utils.book_new();
  const s = XLSX.utils.aoa_to_sheet([
    ["SKU", "Giá trị"],
    ["A", 1.234],
    [],
    ["B", 2.3456],
  ]);
  s.B2.z = "0.000";
  s.B4.z = "0.0000";
  XLSX.utils.book_append_sheet(b, s, "Formats");
  const result = await createStyledReportWorkbook(b);
  expect(result.worksheets[0].getCell("B6").numFmt).toBe("0.0000");
});

it("formats trace report Thời điểm timestamps in Vietnam time", async () => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Mã", "Thời điểm"],
      ["SN-1", "2026-11-05T03:00:00Z"],
    ]),
    "Trace",
  );
  const output = await createStyledReportWorkbook(b);
  expect(output.worksheets[0].getCell("B5").value).toEqual(
    new Date(Date.UTC(2026, 10, 5, 10)),
  );
});

it.each([
  ["2026-11-05 06:40:07.805649+00", Date.UTC(2026, 10, 5, 13, 40, 7, 805)],
  ["2026-11-05 06:40:07+07", Date.UTC(2026, 10, 5, 6, 40, 7)],
  ["2026-11-05 20:40:00-03", Date.UTC(2026, 10, 6, 6, 40)],
])("accepts server hour-only offset %s", async (value, expected) => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Mã", "Ngày nhận"],
      ["WC", value],
    ]),
    "Dates",
  );
  const output = await createStyledReportWorkbook(b);
  expect(output.worksheets[0].getCell("B5").value).toEqual(new Date(expected));
});
