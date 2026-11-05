import * as XLSX from "xlsx";
import type { Workbook, CellValue, Fill, Borders } from "exceljs";

/** Exported documents always use the light Hoa Nam print palette. */
export const REPORT_EXCEL_COLORS = {
  primary: "FF004E74",
  text: "FF12344B",
  muted: "FF627C8E",
  line: "FFD9E8EF",
  stripe: "FFEAF5F8",
  white: "FFFFFFFF",
  success: "FFE7F4ED",
  successText: "FF106B48",
  warning: "FFFFF4DC",
  warningText: "FF8F5B00",
  danger: "FFFBEDEA",
  dangerText: "FFA9322C",
  info: "FFE7F4FD",
  neutral: "FFEEF2F5",
} as const;
export type ReportExcelOptions = {
  title?: string;
  subtitle?: string;
  reportCode?: string;
};
const TITLES: Record<string, string> = {
  "warranty-defects": "BÁO CÁO BẢO HÀNH & LINH KIỆN",
  "label-log": "BÁO CÁO ĐÓNG GÓI & IN NHÃN",
  "document-history": "BÁO CÁO LỊCH SỬ NHẬP – XUẤT",
  "movement-trace": "BÁO CÁO TRUY VẾT HÀNG HÓA",
  "outbound-by-agency": "BÁO CÁO NGƯỜI NHẬN & ĐẠI LÝ",
  "import-match": "BÁO CÁO CHẤT LƯỢNG NHẬP LIỆU",
  "inventory-xnt": "BÁO CÁO NHẬP – XUẤT – TỒN",
  "inventory-balance": "BÁO CÁO TỒN KHO",
  "inventory-ledger": "BÁO CÁO SỔ KHO",
};
const HEADERS: Record<string, string> = {
  Case: "Mã phiếu bảo hành",
  "Turnaround (ngày)": "Thời gian xử lý (ngày)",
  "SKU/Model": "SKU / Model",
  Outbound: "Phiếu xuất",
  "Packing Label": "Mã nhãn",
  "Label Snapshot": "Bản lưu nhãn",
  Date: "Ngày phiếu",
  Recipient: "Nơi nhận",
  Phone: "SĐT",
  "Label count": "Số nhãn",
  "Item count": "Số sản phẩm",
  "SKU count": "Số SKU",
  "SKU summary": "Chi tiết SKU",
  Status: "Trạng thái",
  Applied: "Đã áp dụng",
  "Printer code": "Mã máy in",
  Printer: "Máy in",
  "Printed by": "Người in",
  Attempts: "Số lần in",
  Failed: "Lần in lỗi",
  Reprint: "Lần in lại",
  "Last attempt": "Lần in gần nhất",
  "Created at": "Ngày tạo",
  "Import ID": "Mã lần nhập",
  "Movement ID": "Mã biến động",
  Movement: "Loại biến động",
  "Stock status": "Trạng thái tồn",
  "Qty delta": "Biến động số lượng",
  Item: "Mã sản phẩm",
  Container: "Mã thùng",
  "Physical code": "Mã vật lý",
  "Source type": "Loại chứng từ nguồn",
  "Source id": "Định danh nguồn",
  "Original movement": "Biến động gốc",
  "Correction chain": "Chuỗi điều chỉnh",
  "Posted at": "Ngày ghi sổ",
  "Cancelled at": "Ngày hủy",
};
const C = REPORT_EXCEL_COLORS;
const fill = (argb: string): Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});
const border: Partial<Borders> = {
  top: { style: "thin", color: { argb: C.line } },
  bottom: { style: "thin", color: { argb: C.line } },
  left: { style: "thin", color: { argb: C.line } },
  right: { style: "thin", color: { argb: C.line } },
};
const dateColumn = (header: string) =>
  !/(turnaround|xử lý|số ngày)/i.test(header) &&
  /(ngày|thời gian|thời điểm|date|posted at|cancelled at|last attempt|created at|timestamp)/i.test(
    header,
  );

/** Excel dates are timezone-free; offset timestamps are shown in UTC+7. */
function reportDate(value: unknown): { value: Date; format: string } | null {
  if (typeof value !== "string") return null;
  const m = value
    .trim()
    .match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/,
    );
  if (!m) return null;
  const [, year, month, day, hour, minute, second, fraction, zone] = m;
  const time = Date.UTC(
    +year,
    +month - 1,
    +day,
    +(hour ?? 0),
    +(minute ?? 0),
    +(second ?? 0),
    Number((fraction ?? "").padEnd(3, "0").slice(0, 3)),
  );
  let adjusted = time;
  if (zone) {
    const sign = zone.startsWith("-") ? -1 : 1;
    const offset =
      zone === "Z"
        ? 0
        : sign *
          (Number(zone.slice(1, 3)) * 60 +
            Number(zone.replace(":", "").slice(3, 5) || 0));
    adjusted = time - offset * 60000 + 7 * 3600000;
  }
  const check = new Date(time);
  if (
    !Number.isFinite(adjusted) ||
    check.getUTCFullYear() !== +year ||
    check.getUTCMonth() !== +month - 1 ||
    check.getUTCDate() !== +day ||
    check.getUTCHours() !== +(hour ?? 0) ||
    check.getUTCMinutes() !== +(minute ?? 0) ||
    check.getUTCSeconds() !== +(second ?? 0) ||
    (zone !== undefined &&
      zone !== "Z" &&
      (Number(zone.slice(1, 3)) > 23 ||
        Number(zone.replace(":", "").slice(3, 5) || 0) > 59))
  )
    return null;
  return {
    value: new Date(adjusted),
    format: hour ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy",
  };
}
function statusStyle(value: unknown) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();
  if (
    /^(COMPLETED|COMPLETE|RETURNED|POSTED|PRINTED|SUCCESS|VALIDATED|ACTIVE|KHỚP|HOÀN TẤT|ĐÃ GHI SỔ)$/.test(
      key,
    )
  )
    return { bg: C.success, fg: C.successText };
  if (/^(ERROR|FAILED|PRINT_FAILED|REJECTED|CẦN KIỂM TRA|LỖI)$/.test(key))
    return { bg: C.danger, fg: C.dangerText };
  if (/^(CANCELLED|CANCELED|INACTIVE|ĐÃ HỦY)$/.test(key))
    return { bg: C.neutral, fg: C.muted };
  if (
    /^(PENDING|PENDING_PRINT|CHECKING|REPAIRING|SCANNING|DRAFT|CHỜ XỬ LÝ)$/.test(
      key,
    )
  )
    return { bg: C.warning, fg: C.warningText };
  if (/^(RECEIVED|PROCESSING|IDENTIFIED|TEMP_ONLY)$/.test(key))
    return { bg: C.info, fg: C.primary };
  return null;
}
function widthFor(header: string, values: unknown[]) {
  if (dateColumn(header)) return 23;
  if (
    /^(Case|Import ID|Movement ID)$|mã phiếu|chứng từ|phiếu xuất/i.test(header)
  )
    return Math.min(
      44,
      Math.max(34, ...values.map((v) => String(v ?? "").length + 2)),
    );
  if (
    /địa chỉ|address|ghi chú|mô tả|tên hàng|tên sku|linh kiện|bệnh|sku summary/i.test(
      header,
    )
  )
    return Math.min(
      52,
      Math.max(
        30,
        ...values.map((v) => Math.min(50, String(v ?? "").length) + 2),
      ),
    );
  return Math.min(
    36,
    Math.max(
      16,
      (HEADERS[header] ?? header).length + 2,
      ...values.map((v) => Math.min(34, String(v ?? "").length) + 2),
    ),
  );
}
function valuesOf(sheet: XLSX.WorkSheet) {
  if (!sheet["!ref"]) return [];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  return Array.from({ length: range.e.r + 1 }, (_, r) =>
    Array.from(
      { length: range.e.c + 1 },
      (_, c) => sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? null,
    ),
  );
}

export async function createStyledReportWorkbook(
  source: XLSX.WorkBook,
  options: ReportExcelOptions = {},
): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  book.creator = "Hoa Nam WMS";
  book.title =
    options.title ?? TITLES[options.reportCode ?? ""] ?? "Báo cáo Hoa Nam";
  book.properties.date1904 = Boolean(source.Workbook?.WBProps?.date1904);
  const preserveLayout = Object.values(source.Sheets).some((sheet) =>
    Object.entries(sheet).some(
      ([address, cell]) =>
        !address.startsWith("!") && Boolean((cell as XLSX.CellObject).f),
    ),
  );
  for (const name of source.SheetNames) {
    const input = source.Sheets[name];
    const matrix = valuesOf(input);
    if (!matrix.length) continue;
    const columns = Math.max(1, ...matrix.map((row) => row.length));
    const summary =
      columns === 2 &&
      matrix[0]?.filter((v) => v !== null && v !== "").length === 1;
    const headerIndex = summary
      ? 0
      : Math.max(
          0,
          matrix.findIndex(
            (row) =>
              row.filter((v) => v !== null && v !== "").length >=
              Math.max(2, Math.ceil(columns * 0.75)),
          ),
        );
    const headers = summary
      ? ["Chỉ tiêu", "Giá trị"]
      : matrix[headerIndex].map((v) => String(v ?? ""));
    const recordRows = matrix
      .slice(headerIndex + 1)
      .map((values, index) => ({ values, sourceRow: headerIndex + 1 + index }))
      .filter(
        ({ values }) =>
          preserveLayout || values.some((v) => v !== null && v !== ""),
      );
    const records = recordRows.map(({ values }) => values);
    const ws = book.addWorksheet(name, {
      properties: { defaultRowHeight: 30, tabColor: { argb: C.primary } },
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.4,
          bottom: 0.4,
          header: 0.15,
          footer: 0.15,
        },
      },
    });
    const headerRow = preserveLayout ? headerIndex + 1 : 4;
    const title =
      options.title ??
      (TITLES[options.reportCode ?? ""]
        ? "HOA NAM — " + TITLES[options.reportCode ?? ""]
        : undefined) ??
      (headers.includes("Case")
        ? "HOA NAM — BÁO CÁO BẢO HÀNH"
        : name === "Source" || name === "Sheet1"
          ? "HOA NAM — BÁO CÁO"
          : "HOA NAM — " + name.toUpperCase());
    const context = matrix
      .slice(0, headerIndex)
      .filter((row) => row.filter((v) => v !== null && v !== "").length > 1)
      .map((row) => row.filter((v) => v !== null && v !== "").join(": "));
    const subtitle = [
      name,
      options.subtitle,
      ...context,
      records.length + " dòng",
      "Thời gian Việt Nam (UTC+7)",
    ]
      .filter(Boolean)
      .join(" · ");
    for (let c = 0; c < columns; c++)
      ws.getColumn(c + 1).width = widthFor(
        headers[c] ?? "",
        records.slice(0, 200).map((row) => row[c]),
      );
    if (!preserveLayout) {
      if (columns > 1) {
        ws.mergeCells(1, 1, 1, columns);
        ws.mergeCells(2, 1, 2, columns);
      }
      ws.getCell("A1").value = title;
      ws.getCell("A1").font = {
        name: "Calibri",
        size: 18,
        bold: true,
        color: { argb: C.white },
      };
      ws.getCell("A1").fill = fill(C.primary);
      ws.getCell("A1").alignment = { vertical: "middle", wrapText: true };
      ws.getRow(1).height = Math.max(
        36,
        Math.ceil(
          (title.length * 18) /
            11 /
            Math.max(
              20,
              ws.columns.reduce(
                (sum, column) => sum + (column.width ?? 16),
                0,
              ) - 4,
            ),
        ) *
          22 +
          10,
      );
      ws.getCell("A2").value = subtitle;
      ws.getCell("A2").font = {
        name: "Calibri",
        size: 10,
        color: { argb: C.muted },
      };
      ws.getCell("A2").fill = fill(C.stripe);
      ws.getCell("A2").alignment = { vertical: "middle", wrapText: true };
      ws.getRow(2).height = Math.max(
        32,
        Math.ceil(
          subtitle.length /
            Math.max(
              20,
              ws.columns.reduce(
                (sum, column) => sum + (column.width ?? 16),
                0,
              ) - 4,
            ),
        ) *
          14 +
          8,
      );
      ws.getRow(3).height = 9;
    }
    if (preserveLayout) {
      for (const [address, inputCell] of Object.entries(input)) {
        if (address.startsWith("!")) continue;
        const cell = inputCell as XLSX.CellObject;
        const target = ws.getCell(address);
        target.value = cell.f
          ? { formula: cell.f, result: cell.v as number }
          : (cell.v as CellValue);
        if (cell.z)
          target.numFmt =
            typeof cell.z === "string"
              ? cell.z
              : ((XLSX.SSF.get_table() as Record<number, string>)[cell.z] ??
                "General");
      }
      for (const merge of input["!merges"] ?? [])
        ws.mergeCells(
          merge.s.r + 1,
          merge.s.c + 1,
          merge.e.r + 1,
          merge.e.c + 1,
        );
    }
    headers.forEach((header, c) => {
      const cell = ws.getCell(headerRow, c + 1);
      cell.value = preserveLayout ? header : (HEADERS[header] ?? header);
      cell.fill = fill(C.primary);
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: C.white },
      };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: "left",
      };
      cell.border = border;
    });
    ws.getRow(headerRow).height = 42;
    records.forEach((record, r) => {
      const rowNumber = preserveLayout
        ? headerIndex + 2 + r
        : headerRow + 1 + r;
      let lines = 1;
      record.forEach((value, c) => {
        const cell = ws.getCell(rowNumber, c + 1);
        const original = input[
          XLSX.utils.encode_cell({ r: recordRows[r].sourceRow, c })
        ] as XLSX.CellObject | undefined;
        if (!preserveLayout) {
          const parsed = dateColumn(headers[c] ?? "")
            ? reportDate(value)
            : null;
          cell.value = parsed ? parsed.value : (value as CellValue);
          if (parsed) cell.numFmt = parsed.format;
          else if (original?.z && original.z !== "General")
            cell.numFmt =
              typeof original.z === "string"
                ? original.z
                : ((XLSX.SSF.get_table() as Record<number, string>)[
                    original.z
                  ] ?? "General");
          else if (typeof value === "number" && dateColumn(headers[c] ?? ""))
            cell.numFmt = Number.isInteger(value)
              ? "dd/mm/yyyy"
              : "dd/mm/yyyy hh:mm";
          else if (typeof value === "number")
            cell.numFmt = Number.isInteger(value) ? "#,##0" : "#,##0.00";
          else if (typeof value === "string") cell.numFmt = "@";
        }
        cell.font = {
          name: "Calibri",
          size: 11,
          color: { argb: C.text },
          bold: c === 0,
        };
        cell.fill = fill(r % 2 ? C.stripe : C.white);
        cell.border = border;
        cell.alignment = {
          vertical: "middle",
          wrapText: true,
          horizontal: typeof value === "number" ? "right" : "left",
        };
        if (
          /trạng thái|status|đối soát|result|kết quả/i.test(headers[c] ?? "")
        ) {
          const status = statusStyle(value);
          if (status) {
            cell.fill = fill(status.bg);
            cell.font = {
              name: "Calibri",
              size: 10,
              bold: true,
              color: { argb: status.fg },
            };
            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
              wrapText: true,
            };
          }
        }
        const width = ws.getColumn(c + 1).width ?? 20;
        lines = Math.max(
          lines,
          ...String(value ?? "")
            .split("\n")
            .map((text) => Math.ceil(text.length / Math.max(8, width - 3))),
        );
      });
      ws.getRow(rowNumber).height = Math.max(
        30,
        Math.min(409, lines * 15 + 10),
      );
    });
    ws.views = [
      {
        state: "frozen",
        xSplit: columns > 1 ? 1 : 0,
        ySplit: headerRow,
        topLeftCell:
          columns > 1 ? "B" + (headerRow + 1) : "A" + (headerRow + 1),
        showGridLines: false,
        zoomScale: 90,
      },
    ];
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + records.length, column: columns },
    };
    ws.pageSetup.printTitlesRow = headerRow + ":" + headerRow;
    ws.pageSetup.printArea =
      "A1:" +
      XLSX.utils.encode_cell({
        r: headerRow + records.length - 1,
        c: columns - 1,
      });
    ws.headerFooter.oddFooter = "&LHOA NAM WMS&RTrang &P / &N";
  }
  if (!book.worksheets.length)
    throw new Error("Không có dữ liệu để xuất báo cáo.");
  return book;
}
export async function serializeStyledReportWorkbook(
  source: XLSX.WorkBook,
  options: ReportExcelOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const book = await createStyledReportWorkbook(source, options);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
export async function saveStyledReportWorkbook(
  source: XLSX.WorkBook,
  filename: string,
  options: ReportExcelOptions = {},
): Promise<void> {
  const data = await serializeStyledReportWorkbook(source, options);
  const url = URL.createObjectURL(
    new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = /\.xlsx$/i.test(filename) ? filename : filename + ".xlsx";
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export async function downloadStyledReportBlob(
  blob: Blob,
  filename: string,
  options: ReportExcelOptions = {},
): Promise<void> {
  const source = XLSX.read(await blob.arrayBuffer(), {
    type: "array",
    cellDates: false,
    cellNF: true,
  });
  await saveStyledReportWorkbook(source, filename, options);
}
