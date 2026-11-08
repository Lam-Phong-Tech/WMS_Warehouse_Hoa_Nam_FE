import {
  saveStyledReportWorkbook,
  type ReportExcelOptions,
} from "@/shared/utils/report-excel-style";
import * as XLSX from "xlsx";
import { tStatic as t } from "@/shared/i18n/useT";

export type ExportScope = "all" | "page" | "review";
export type ReportExportChoice = {
  filename: string;
  sectionIds: string[];
  scope: ExportScope;
  format: "xlsx" | "pdf";
};
export type ExportWorkbookOptions = {
  filename: string;
  sectionIds: string[];
  match?: { columns: string[]; values: string[] };
  context?: [string, string][];
};
type Cell = string | number | boolean | null;
const quantityHeaders = new Set([
  "Kế hoạch",
  "Đã scan",
  "Đã post",
  "Qty delta",
  "Yêu cầu",
  "Đã quét",
  "Đã xuất",
  "Dòng hợp lệ",
  "Dòng lỗi",
  "Số lượng",
  "Label count",
  "Item count",
  "Attempts",
  "Failed",
  "Reprint",
  "Tổng dòng",
  "Thành công",
  "Lỗi",
  "Trùng",
  "Tồn đầu",
  "Nhập",
  "Xuất",
  "Tồn cuối",
]);
const skuHeaders = ["Mã SKU", "SKU", "SKU/Model", "Model"];
const nameHeaders = ["Tên SKU", "Tên hàng"];
const canonical = (v: unknown) =>
  String(v ?? "")
    .replace(/^'/, "")
    .trim();

export function safeExportFilename(value: string, format: "xlsx" | "pdf") {
  const stem = Array.from(value, (character) =>
    character.charCodeAt(0) < 32 ? "-" : character,
  )
    .join("")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/(?:\.(?:xlsx|pdf))+$/gi, "")
    .replace(/[. ]+$/g, "");
  return (stem || "BaoCao") + "." + format;
}

export function selectExportWorkbook(
  source: XLSX.WorkBook,
  options: ExportWorkbookOptions,
) {
  const sourceSheet = source.Sheets[source.SheetNames[0]];
  if (!sourceSheet) throw new Error(t("reportExport.empty"));
  const table = XLSX.utils.sheet_to_json<Cell[]>(sourceSheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const headers = (table.shift() ?? []).map(String);
  let rows = table.filter((r) => r.some((v) => v !== "" && v !== null));
  if (options.match) {
    const index = headers.findIndex((h) => options.match!.columns.includes(h));
    if (index < 0) throw new Error(t("reportExport.scopeMismatch"));
    const values = new Set(options.match.values.map(canonical));
    rows = rows.filter((r) => values.has(canonical(r[index])));
  }
  if (!rows.length) throw new Error(t("reportExport.empty"));
  const importIndex = headers.indexOf("Import ID");
  const entityIndex =
    importIndex >= 0
      ? importIndex
      : options.match
        ? headers.findIndex((h) => options.match!.columns.includes(h))
        : -1;
  const entityCount =
    entityIndex >= 0
      ? new Set(rows.map((row) => canonical(row[entityIndex]))).size
      : rows.length;
  const summaryRows =
    importIndex >= 0
      ? [
          ...new Map(
            rows.map((row) => [canonical(row[importIndex]), row]),
          ).values(),
        ]
      : rows;
  const book = XLSX.utils.book_new();
  const quantities = headers
    .map((h, i) => (quantityHeaders.has(h) ? i : -1))
    .filter((i) => i >= 0);
  const add = (name: string, data: Cell[][]) => {
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = data[0]?.map((_, i) => ({
      wch: Math.min(
        42,
        Math.max(
          14,
          ...data.slice(0, 200).map((r) => String(r[i] ?? "").length + 2),
        ),
      ),
    }));
    if (data.length > 1)
      sheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: data.length - 1, c: Math.max(0, (data[0]?.length ?? 1) - 1) },
        }),
      };
    XLSX.utils.book_append_sheet(book, sheet, name.slice(0, 31));
  };
  for (const id of options.sectionIds) {
    if (id === "summary") {
      add(t("reportExport.summary"), [
        [t("reportExport.summary"), ""],
        ...(options.context ?? []),
        [t("reportExport.count"), rows.length],
        [t("reportExport.records"), entityCount],
        ...quantities.map(
          (i) =>
            [
              headers[i],
              summaryRows.reduce(
                (s, r) => s + (typeof r[i] === "number" ? (r[i] as number) : 0),
                0,
              ),
            ] as Cell[],
        ),
      ]);
    } else if (id === "detail")
      add(t("reportExport.detail"), [headers, ...rows]);
    else if (id === "sku") {
      const sku = headers.findIndex((h) => skuHeaders.includes(h));
      if (sku < 0) throw new Error(t("reportExport.scopeMismatch"));
      const name = headers.findIndex((h) => nameHeaders.includes(h));
      const groups = new Map<string, Cell[]>();
      for (const row of rows) {
        const key = canonical(row[sku]);
        if (!key) continue;
        const item = groups.get(key) ?? [
          row[sku],
          ...(name >= 0 ? [row[name]] : []),
          ...quantities.map(() => 0),
        ];
        quantities.forEach((i, j) => {
          const c = 1 + (name >= 0 ? 1 : 0) + j;
          item[c] =
            Number(item[c]) +
            (typeof row[i] === "number" ? (row[i] as number) : 0);
        });
        groups.set(key, item);
      }
      add(t("reportExport.sku"), [
        [
          headers[sku],
          ...(name >= 0 ? [headers[name]] : []),
          ...quantities.map((i) => headers[i]),
        ],
        ...groups.values(),
      ]);
    } else if (id === "codes" || id === "components") {
      const wanted =
        id === "components"
          ? ["Case", "SKU/Model", "Linh kiện đã xuất", "Trạng thái"]
          : [
              ...skuHeaders,
              ...nameHeaders,
              "Đối tác/Nơi nhận",
              "Nơi nhận",
              "Mã nơi nhận",
              "Recipient",
            ];
      const indices = headers
        .map((h, i) => (wanted.includes(h) ? i : -1))
        .filter((i) => i >= 0);
      if (!indices.length) throw new Error(t("reportExport.scopeMismatch"));
      const unique = new Map<string, Cell[]>();
      for (const row of rows) {
        const projected = indices.map((i) => row[i]);
        unique.set(JSON.stringify(projected), projected);
      }
      add(
        t(
          id === "components"
            ? "reportExport.components"
            : "reportExport.codes",
        ),
        [indices.map((i) => headers[i]), ...unique.values()],
      );
    } else throw new Error(t("reportExport.scopeMismatch"));
  }
  if (!book.SheetNames.length) throw new Error(t("reportExport.empty"));
  return book;
}

export async function downloadSelectedWorkbook(
  blob: Blob,
  options: ExportWorkbookOptions,
  styleOptions: ReportExcelOptions = {},
) {
  const buffer = await blob.arrayBuffer();
  const source = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    cellNF: true,
  });
  const selected = selectExportWorkbook(source, options);
  await saveStyledReportWorkbook(
    selected,
    safeExportFilename(options.filename, "xlsx"),
    styleOptions,
  );
}

export async function exportLocalReport(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  choice: ReportExportChoice,
) {
  const source = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    source,
    XLSX.utils.aoa_to_sheet([
      headers,
      ...rows.map((row) => row.map((value) => value ?? "")),
    ]),
    "Source",
  );
  await saveStyledReportWorkbook(
    selectExportWorkbook(source, {
      filename: choice.filename,
      sectionIds: choice.sectionIds,
    }),
    safeExportFilename(choice.filename, "xlsx"),
  );
}
