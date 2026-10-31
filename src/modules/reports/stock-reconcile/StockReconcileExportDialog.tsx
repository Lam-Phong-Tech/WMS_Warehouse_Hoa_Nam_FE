import { useState } from "react";
import * as XLSX from "xlsx";
import { UiDialog } from "@/shared/ui";
import "./stock-reconcile-export.css";

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

type SheetKey = "summary" | "flow" | "reconcile" | "sku";
type Props = {
  rows: ExportRow[];
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
  from,
  to,
  asOf,
  onClose,
}: Props) {
  const [scope, setScope] = useState<"all" | "review">("all");
  const [sheets, setSheets] = useState<Record<SheetKey, boolean>>({
    summary: true,
    flow: true,
    reconcile: true,
    sku: false,
  });
  const [filename, setFilename] = useState(
    `BaoCaoTonDoiSoat_${from.replaceAll("-", "")}-${to.replaceAll("-", "")}`,
  );
  const selected =
    scope === "review" ? rows.filter((row) => row.mismatch) : rows;
  const sheetCount = Object.values(sheets).filter(Boolean).length;
  const ledger = selected.reduce((sum, row) => sum + row.ledgerStock, 0);
  const recorded = selected.reduce((sum, row) => sum + row.actual, 0);

  const toggle = (key: SheetKey) =>
    setSheets((current) => ({ ...current, [key]: !current[key] }));
  const submit = () => {
    if (!filename.trim() || sheetCount === 0 || selected.length === 0) return;
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
    XLSX.writeFile(workbook, `${safeName}.xlsx`);
    onClose();
  };

  return (
    <UiDialog
      open
      onClose={onClose}
      title="Xuất báo cáo tồn & đối soát"
      maxWidth="md"
      fullWidth
      className="rpt02-export-dialog"
      actions={
        <>
          <button
            type="button"
            className="rpt02-button rpt02-button--ghost"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="rpt02-button rpt02-button--primary"
            onClick={submit}
            disabled={
              !filename.trim() || sheetCount === 0 || selected.length === 0
            }
          >
            Xuất Excel
          </button>
        </>
      }
    >
      <div className="rpt02-export-body">
        <dl className="rpt02-export-context">
          <div>
            <dt>Kho</dt>
            <dd>
              {rows.length &&
              rows.every((row) => row.warehouse === rows[0].warehouse)
                ? rows[0].warehouse
                : "Tất cả kho"}
            </dd>
          </div>
          <div>
            <dt>Kỳ báo cáo</dt>
            <dd>
              {from} – {to}
            </dd>
          </div>
          <div>
            <dt>Mốc dữ liệu</dt>
            <dd>{asOf || to}</dd>
          </div>
          <div>
            <dt>Đơn vị</dt>
            <dd>Sản phẩm</dd>
          </div>
        </dl>
        <fieldset>
          <legend>Phạm vi xuất</legend>
          <div className="rpt02-export-options">
            <label>
              <input
                type="radio"
                name="rpt02-export-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              Toàn bộ kết quả ({rows.length} SKU)
            </label>
            <label>
              <input
                type="radio"
                name="rpt02-export-scope"
                checked={scope === "review"}
                onChange={() => setScope("review")}
              />
              Chỉ SKU cần kiểm tra ({rows.filter((row) => row.mismatch).length}{" "}
              SKU)
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Nội dung</legend>
          <div className="rpt02-export-options rpt02-export-options--grid">
            <label>
              <input
                type="checkbox"
                checked={sheets.summary}
                onChange={() => toggle("summary")}
              />
              Tổng hợp tồn
            </label>
            <label>
              <input
                type="checkbox"
                checked={sheets.sku}
                onChange={() => toggle("sku")}
              />
              Mã hàng
            </label>
            <label>
              <input
                type="checkbox"
                checked={sheets.flow}
                onChange={() => toggle("flow")}
              />
              Nhập – Xuất – Tồn
            </label>
            <label title="Phát sinh chứng từ chỉ xuất được từ màn chi tiết từng SKU">
              <input type="checkbox" disabled />
              Phát sinh chứng từ
            </label>
            <label>
              <input
                type="checkbox"
                checked={sheets.reconcile}
                onChange={() => toggle("reconcile")}
              />
              Chi tiết chênh lệch
            </label>
          </div>
        </fieldset>
        <section className="rpt02-export-preview">
          <h3>Xem trước nội dung xuất</h3>
          <div>
            <span>
              <strong>{selected.length}</strong>SKU
            </span>
            <span>
              <strong>{qty(ledger)}</strong>Tồn sổ
            </span>
            <span>
              <strong>{qty(recorded)}</strong>Tồn ghi nhận
            </span>
            <span>
              <strong>{qty(recorded - ledger)}</strong>Chênh lệch
            </span>
          </div>
          <p>Xuất theo bộ lọc và mốc dữ liệu đang áp dụng.</p>
        </section>
        <div className="rpt02-export-fields">
          <label>
            Tên tệp
            <input
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              aria-label="Tên tệp xuất"
            />
          </label>
          <label>
            Định dạng
            <input value="Excel (.xlsx)" readOnly aria-label="Định dạng tệp" />
          </label>
        </div>
      </div>
    </UiDialog>
  );
}
