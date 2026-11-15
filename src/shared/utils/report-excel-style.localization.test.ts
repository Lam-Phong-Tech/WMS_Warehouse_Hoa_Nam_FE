import { afterEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createStyledReportWorkbook } from "./report-excel-style";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { reportLabel } from "@/shared/i18n/report-labels";

afterEach(() => useLanguageStore.setState({ language: "vi" }));

describe.each([
  {
    language: "en" as const,
    title: "HOA NAM — Warranty report",
    code: "Warranty case code",
    received: "Received at",
    sheet: "Warranty",
    timezone: "Vietnam time (UTC+7)",
    movement: "Movement type",
    ledger: "Ledger stock",
    footer: "&LHOA NAM WMS&RPage &P / &N",
  },
  {
    language: "zh" as const,
    title: "HOA NAM — 保修报表",
    code: "保修工单编码",
    received: "接收时间",
    sheet: "保修",
    timezone: "越南时间（UTC+7）",
    movement: "库存变动类型",
    ledger: "账面库存",
    footer: "&LHOA NAM WMS&R页 &P / &N",
  },
])("report workbook in $language", (labels) => {
  it("localizes fixed captions while preserving identifiers, enums and customer text", async () => {
    useLanguageStore.setState({ language: labels.language });
    const source = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      source,
      XLSX.utils.aoa_to_sheet([
        ["Case", "Tên hàng", "Ngày nhận", "Trạng thái"],
        ["000123", "Đại lý Nguyễn / Tồn đầu", "2026-11-15", "RECEIVED"],
      ]),
      "Bao hanh",
    );
    const workbook = await createStyledReportWorkbook(source);
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe(labels.sheet);
    expect(sheet.getCell("A1").value).toBe(labels.title);
    expect(sheet.getCell("A2").value).toContain(labels.timezone);
    expect(sheet.getCell("A4").value).toBe(labels.code);
    expect(sheet.getCell("C4").value).toBe(labels.received);
    expect(sheet.getCell("A5").value).toBe("000123");
    expect(sheet.getCell("B5").value).toBe("Đại lý Nguyễn / Tồn đầu");
    expect(sheet.getCell("D5").value).toBe("RECEIVED");
    expect(sheet.headerFooter.oddFooter).toBe(labels.footer);
    expect(reportLabel("Loại biến động")).toBe(labels.movement);
    expect(reportLabel("Tồn sổ")).toBe(labels.ledger);
  });

  it("retains timestamp semantics and status styling when caller headers are localized", async () => {
    useLanguageStore.setState({ language: labels.language });
    const source = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      source,
      XLSX.utils.aoa_to_sheet([
        [
          reportLabel("Thời điểm"),
          reportLabel("Thời điểm ghi nhận"),
          reportLabel("Trạng thái"),
        ],
        [
          "2026-11-05T03:00:00Z",
          "2026-11-05 06:40:07.805649+00:00",
          "COMPLETED",
        ],
      ]),
      "Trace",
    );
    const workbook = await createStyledReportWorkbook(source);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell("A5").value).toEqual(
      new Date(Date.UTC(2026, 10, 5, 10)),
    );
    expect(sheet.getCell("B5").value).toEqual(
      new Date(Date.UTC(2026, 10, 5, 13, 40, 7, 805)),
    );
    expect(sheet.getCell("A5").numFmt).toBe("dd/mm/yyyy hh:mm");
    expect(sheet.getCell("B5").numFmt).toBe("dd/mm/yyyy hh:mm");
    expect(sheet.getCell("C5").fill).toMatchObject({
      fgColor: { argb: "FFE7F4ED" },
    });
    expect(sheet.getCell("C5").value).toBe("COMPLETED");
  });

  it("localizes system captions around SUM while retaining formula references and raw data", async () => {
    useLanguageStore.setState({ language: labels.language });
    const source = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["sku_code", "Số lượng", "Trạng thái"],
      ["=literal user data", 2, "COMPLETED"],
      ["Tổng", 2, ""],
    ]);
    sheet.B3 = { t: "n", v: 2, f: "SUM(B2:B2)" };
    XLSX.utils.book_append_sheet(source, sheet, "Source");
    const workbook = await createStyledReportWorkbook(source);
    const output = workbook.worksheets[0];
    expect(output.name).toBe("Source");
    expect(output.getCell("A1").value).toBe("sku_code");
    expect(output.getCell("B1").value).toBe(
      labels.language === "zh" ? "数量" : "Quantity",
    );
    expect(output.getCell("C1").value).toBe(
      labels.language === "zh" ? "状态" : "Status",
    );
    expect(output.getCell("B3").value).toMatchObject({
      formula: "SUM(B2:B2)",
      result: 2,
    });
    expect(output.getCell("A2").value).toBe("=literal user data");
    expect(output.getCell("C2").value).toBe("COMPLETED");
  });
});
