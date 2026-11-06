import { saveStyledReportWorkbook } from "@/shared/utils/report-excel-style";
import { BUSINESS_TIMEZONE, parseDateTime } from "@/shared/utils/date-time";
import { ReportExportDrawer } from "../components/ReportExportAction";
import {
  safeExportFilename,
  type ReportExportChoice,
} from "../components/report-export-workbook";
import { useT } from "@/shared/i18n/useT";
import * as XLSX from "xlsx";

type ExportRow = {
  skuCode: string;
  skuName: string;
  warehouse: string;
  kind: string;
  opening: number;
  inbound: number;
  productOutbound: number;
  componentOutbound: number;
  reversal: number;
  closing: number;
  ledgerStock: number;
  actual: number;
  delta: number;
  mismatch: boolean;
};

type Props = {
  rows: ExportRow[];
  pageRows?: ExportRow[];
  from: string;
  to: string;
  asOf: string;
  onClose: () => void;
};

const qty = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

function appendSheet(
  workbook: XLSX.WorkBook,
  name: string,
  data: (string | number)[][],
) {
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const maxColumns = Math.max(...data.map((row) => row.length));
  sheet["!cols"] = Array.from({ length: maxColumns }, (_, index) => ({
    wch: Math.min(
      42,
      Math.max(14, ...data.map((row) => String(row[index] ?? "").length + 2)),
    ),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function StockReconcileExportDialog({
  rows,
  pageRows,
  from,
  to,
  asOf,
  onClose,
}: Props) {
  const t = useT();
  const parsedAsOf = asOf ? parseDateTime(asOf, BUSINESS_TIMEZONE) : null;
  const displayedAsOf = parsedAsOf?.isValid()
    ? parsedAsOf.format("DD/MM/YYYY HH:mm:ss [(UTC+7)]")
    : to;
  const submit = async (choice: ReportExportChoice) => {
    const scope = choice.scope;
    const selected =
      scope === "review"
        ? rows.filter((row) => row.mismatch)
        : scope === "page"
          ? (pageRows ?? [])
          : rows;
    const filename = choice.filename;
    const sheets = Object.fromEntries(
      choice.sectionIds.map((id) => [id, true]),
    );
    const ledger = selected.reduce((sum, row) => sum + row.ledgerStock, 0);
    const recorded = selected.reduce((sum, row) => sum + row.actual, 0);
    const workbook = XLSX.utils.book_new();
    const metadata: (string | number)[][] = [
      ["Báo cáo tồn kho & đối soát"],
      ["Kỳ báo cáo", `${from} – ${to}`],
      ["Mốc dữ liệu", asOf || to],
      ["Phạm vi", scope === "review" ? "SKU cần kiểm tra" : "Toàn bộ kết quả"],
    ];
    if (sheets.summary)
      appendSheet(workbook, "Tổng hợp tồn", [
        ...metadata,
        [],
        [
          "Số mặt hàng",
          "Tồn sổ",
          "Tồn ghi nhận",
          "Chênh lệch",
          "SKU cần kiểm tra",
        ],
        [
          selected.length,
          ledger,
          recorded,
          recorded - ledger,
          selected.filter((row) => row.mismatch).length,
        ],
      ]);
    if (sheets.flow)
      appendSheet(workbook, "Nhập Xuất Tồn", [
        ...metadata,
        [],
        [
          "SKU",
          "Tên hàng",
          "Kho",
          "Tồn đầu",
          "Nhập",
          "Xuất SP",
          "Xuất LK BH",
          "Hoàn tác",
          "Tồn cuối",
        ],
        ...selected.map((row) => [
          row.skuCode,
          row.skuName,
          row.warehouse,
          row.opening,
          row.inbound,
          row.productOutbound,
          row.componentOutbound,
          row.reversal,
          row.closing,
        ]),
      ]);
    if (sheets.reconcile)
      appendSheet(workbook, "Chi tiết đối soát", [
        ...metadata,
        [],
        [
          "SKU",
          "Tên hàng",
          "Kho",
          "Tồn sổ",
          "Tồn ghi nhận",
          "Chênh lệch",
          "Đối soát",
        ],
        ...selected.map((row) => [
          row.skuCode,
          row.skuName,
          row.warehouse,
          row.ledgerStock,
          row.actual,
          row.delta,
          row.mismatch ? "Cần kiểm tra" : "Khớp",
        ]),
      ]);
    if (sheets.sku)
      appendSheet(workbook, "Mã hàng", [
        ...metadata,
        [],
        ["SKU", "Tên hàng", "Loại hàng", "Kho"],
        ...selected.map((row) => [
          row.skuCode,
          row.skuName,
          row.kind === "PRODUCT"
            ? "Sản phẩm"
            : row.kind === "COMPONENT"
              ? "Linh kiện"
              : "—",
          row.warehouse,
        ]),
      ]);
    const safeName = filename
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\.xlsx$/i, "");
    await saveStyledReportWorkbook(
      workbook,
      safeExportFilename(safeName, "xlsx"),
      { title: "HOA NAM — BÁO CÁO TỒN KHO & ĐỐI SOÁT" },
    );
  };

  return (
    <ReportExportDrawer
      title={t("reportExport.stock")}
      fileStem={"BaoCaoTonDoiSoat_" + from + "-" + to}
      onClose={onClose}
      onExport={submit}
      context={[
        [t("reportExport.period"), from + " – " + to],
        [t("reportExport.filters"), displayedAsOf],
      ]}
      scopes={[
        {
          id: "all",
          label: t("reportExport.all", { count: rows.length }),
          description: t("reportExport.allHint"),
          count: rows.length,
        },
        ...(pageRows
          ? [
              {
                id: "page" as const,
                label: t("reportExport.page", { count: pageRows.length }),
                description: t("reportExport.pageHint"),
                count: pageRows.length,
              },
            ]
          : []),
        {
          id: "review",
          label: t("reportExport.review", {
            count: rows.filter((row) => row.mismatch).length,
          }),
          description: t("reportExport.reviewHint"),
          count: rows.filter((row) => row.mismatch).length,
        },
      ]}
      sections={[
        {
          id: "summary",
          label: t("reportExport.stockSummary"),
          selected: true,
        },
        { id: "flow", label: t("reportExport.stockFlow"), selected: true },
        {
          id: "reconcile",
          label: t("reportExport.stockReconcile"),
          selected: true,
        },
        { id: "sku", label: t("reportExport.stockCodes"), selected: false },
      ]}
      summaries={(scope) => {
        const selected =
          scope === "review"
            ? rows.filter((row) => row.mismatch)
            : scope === "page"
              ? (pageRows ?? [])
              : rows;
        return [
          {
            label: t("reportExport.stockSummary"),
            value: qty(selected.reduce((sum, row) => sum + row.ledgerStock, 0)),
          },
        ];
      }}
    />
  );
}
