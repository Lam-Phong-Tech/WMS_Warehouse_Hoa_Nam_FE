import { useT } from "@/shared/i18n/useT";
import { bilingual } from "@/shared/constants/business-labels";
import { parseDateTime } from "@/shared/utils/date-time";
import { useDateTimePreferences } from "@/shared/store/interface-preferences.store";
import { ReportExportAction } from "../components/ReportExportAction";
import { reportExportSections } from "../components/report-export-sections";
import {
  exportLocalReport,
  type ReportExportChoice,
} from "../components/report-export-workbook";
import { tStatic as tExport } from "@/shared/i18n/useT";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CANONICAL_WAREHOUSE_CODE } from "@/modules/master-data/services/warehouse.service";
import {
  useInboundDetail,
  useInboundScanEntries,
} from "@/modules/inbound/hooks/use-inbound";
import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import type { FlowDocument } from "./inventory-flow-api";
import "./inbound-report-detail.css";

type InboundReportDetailProps = {
  document: FlowDocument;
  range: { from: string; to: string };
  canExport: boolean;
  onBack: () => void;
};

const statusNames: Record<string, string> = bilingual(
  {
    DRAFT: "Chờ nhập",
    SCANNING: "Đang nhập",
    POSTED: "Đã nhập kho",
    CANCELLED: "Đã hủy",
  },
  {
    DRAFT: "Awaiting receipt",
    SCANNING: "Receiving",
    POSTED: "Received into stock",
    CANCELLED: "Cancelled",
  },
);

function formatDateTime(value?: string) {
  if (!value) return "—";
  const parsed = parseDateTime(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm") : value;
}

function statusName(value: string) {
  return statusNames[value.toUpperCase()] ?? value;
}

export function InboundReportDetail({
  document,
  range,
  canExport,
  onBack,
}: InboundReportDetailProps) {
  const tUi = useT();
  useDateTimePreferences();
  const detailQuery = useInboundDetail(document.id, { readOnly: true });
  const entriesQuery = useInboundScanEntries(document.id, "ALL");
  const warehousesQuery = useWarehouseDirectory();
  const [tab, setTab] = useState<"codes" | "sku">("codes");
  const [search, setSearch] = useState("");
  const detail = detailQuery.data;
  const receipt = detail?.document;
  // NCC gắn trên phiếu — hiện "MÃ - Tên" như màn IN-03. Tuyệt đối không rơi
  // về source_reference/counterpart khi thiếu NCC: đó là mã chứng từ nguồn
  // (payload quét máy), không phải thông tin đối tác.
  const supplierLabel =
    detail?.supplier?.displayName || detail?.supplier?.name || "";
  const warehouseCode = document.warehouse_code.trim();
  const warehouseId = String(receipt?.warehouseId ?? "").trim();
  const warehouseRow = (warehousesQuery.data ?? []).find(
    (row) =>
      (warehouseCode &&
        String(row.code ?? row.warehouse_code ?? "")
          .trim()
          .toUpperCase() === warehouseCode.toUpperCase()) ||
      (!warehouseCode &&
        warehouseId &&
        String(row.id ?? row.warehouse_id ?? "").trim() === warehouseId),
  );
  const warehouseName =
    String(warehouseRow?.name ?? warehouseRow?.warehouse_name ?? "").trim() ||
    (warehouseCode.toUpperCase() === CANONICAL_WAREHOUSE_CODE
      ? "Kho Hoa Nam"
      : warehouseCode || warehouseId || "—");
  const lines = detail?.lines ?? [];
  const entries = useMemo(
    () =>
      (entriesQuery.data ?? []).filter((entry) => entry.status === "ACTIVE"),
    [entriesQuery.data],
  );
  const skuCount = lines.length;
  const total = lines.reduce((sum, line) => sum + line.scanned, 0);
  const filteredEntries = entries.filter((entry) =>
    [
      entry.serialNumber,
      entry.itemCode,
      entry.candidateSerialNumber,
      entry.candidateItemUnique,
      entry.sku,
      entry.skuName,
    ].some((value) =>
      value
        ?.toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")),
    ),
  );
  const filteredLines = lines.filter((line) =>
    [line.sku, line.skuName].some((value) =>
      value
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")),
    ),
  );
  const history = [...(detail?.statusHistory ?? [])].sort((a, b) =>
    a.changedAt.localeCompare(b.changedAt),
  );

  const exportDetail = (choice: ReportExportChoice) => {
    if (!detail || !canExport) return;
    return exportLocalReport(
      [
        "Mã phiếu nhập",
        "Mã quét / serial",
        "Mã SKU",
        "Tên hàng",
        "Đơn vị tính",
        "Số lượng",
        "Trạng thái",
        "Ngày ghi nhận",
      ],
      entries.length > 0
        ? entries.map((entry) => {
            const line = lines.find(
              (item) => item.id === entry.lineId || item.sku === entry.sku,
            );
            return [
              receipt?.code ?? document.document_no,
              entry.serialNumber ||
                entry.itemCode ||
                entry.candidateSerialNumber ||
                entry.candidateItemUnique ||
                entry.containerCode ||
                "—",
              entry.sku,
              entry.skuName,
              line?.productUnit || "—",
              entry.quantity,
              "Đã ghi nhận",
              formatDateTime(entry.capturedAt),
            ];
          })
        : lines.map((line) => [
            receipt?.code ?? document.document_no,
            "—",
            line.sku,
            line.skuName,
            line.productUnit || "—",
            line.scanned,
            statusName(receipt?.status ?? document.status),
            formatDateTime(document.posted_at),
          ]),
      choice,
    );
  };

  return (
    <div className="inbound-report-detail">
      <header className="inbound-report-detail__header">
        <button
          type="button"
          className="inbound-report-detail__back"
          onClick={onBack}
        >
          ← <span>{tUi("reports.inventoryFlowReport.inboundTitle")}</span>
        </button>
        <div className="inbound-report-detail__heading-row">
          <div>
            <h1>{tUi("uiAudit.text_8e3993e4b2")}</h1>
          </div>
          <div className="inbound-report-detail__actions">
            <small>
              {tUi("uiAudit.text_200f9b114b")} {range.from} – {range.to} ·{" "}
              {warehouseName} {tUi("uiAudit.text_d41c70f5f2")}{" "}
            </small>
            <div>
              <Link
                className="inbound-report-detail__source"
                to={`/inbound?screen=IN-03&id=${encodeURIComponent(document.id)}`}
              >
                {tUi("uiAudit.text_094f0b8a27")}{" "}
              </Link>
              {canExport ? (
                <ReportExportAction
                  title={tExport("reportExport.inbound")}
                  fileStem={
                    "ChiTietNhapKho_" + (receipt?.code ?? document.document_no)
                  }
                  total={entries.length || lines.length}
                  sections={reportExportSections(
                    tExport("reportExport.detail"),
                  )}
                  disabled={!detail || !canExport}
                  onExport={exportDetail}
                />
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {detailQuery.isPending ? (
        <p role="status">{tUi("uiAudit.text_773121aa7a")}</p>
      ) : null}
      {detailQuery.isError ? (
        <div role="alert" className="inbound-report-detail__error">
          {tUi("uiAudit.text_a21bf07a2f")}{" "}
          <button type="button" onClick={() => void detailQuery.refetch()}>
            {tUi("dashboardAudit.retry")}{" "}
          </button>
        </div>
      ) : null}
      {detail ? (
        <>
          <section
            className="inbound-report-detail__info"
            aria-labelledby="inbound-detail-info-title"
          >
            <h2 id="inbound-detail-info-title">
              {tUi("inbound.draft.titleEdit")}
            </h2>
            <dl>
              <div>
                <dt>{tUi("uiAudit.text_c939745d88")}</dt>
                <dd>{receipt?.code || "—"}</dd>
              </div>
              <div>
                <dt>{tExport("inbound.draft.sourceRef")}</dt>
                <dd>{receipt?.sourceReference || "—"}</dd>
              </div>
              <div>
                <dt>{tUi("dashboardAudit.status")}</dt>
                <dd>
                  <span
                    className="inbound-report-detail__status"
                    data-status={receipt?.status}
                  >
                    {statusName(receipt?.status ?? document.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{tUi("inbound.list.colCreated")}</dt>
                <dd>{formatDateTime(receipt?.createdAt)}</dd>
              </div>
              <div>
                <dt>{tUi("updatedUi.text_039d667495cd")}</dt>
                <dd>{supplierLabel || document.counterpart || "—"}</dd>
              </div>
              <div>
                <dt>{tUi("uiAudit.text_26e4121581")}</dt>
                <dd>{warehouseName}</dd>
              </div>
              <div>
                <dt>{tUi("reverse.detail.fieldCreatedBy")}</dt>
                <dd>{receipt?.createdBy || document.created_by_name || "—"}</dd>
              </div>
              <div>
                <dt>{tUi("uiAudit.text_240b7e9225")}</dt>
                <dd>{formatDateTime(document.posted_at)}</dd>
              </div>
            </dl>
          </section>

          <div className="inbound-report-detail__overview">
            <section
              className="inbound-report-detail__panel"
              aria-labelledby="inbound-detail-sku-title"
            >
              <h2 id="inbound-detail-sku-title">
                {tUi("uiAudit.text_0e65ef253a")}
              </h2>
              <div className="inbound-report-detail__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{tUi("inbound.skuInfo.fieldCode")}</th>
                      <th>{tUi("inventory.balance.colName")}</th>
                      <th>{tUi("inbound.skuInfo.fieldUnit")}</th>
                      <th className="is-number">
                        {tUi("dashboardSnapshot.quantity")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={4}>{tUi("uiAudit.text_2cca482a6a")}</td>
                      </tr>
                    ) : (
                      lines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.sku}</td>
                          <td>{line.skuName}</td>
                          <td>{line.productUnit || "—"}</td>
                          <td className="is-number">{line.scanned}</td>
                        </tr>
                      ))
                    )}
                    <tr className="inbound-report-detail__total">
                      <td colSpan={3}>
                        {tUi("reports.stockReconcileReport.totalRow")}
                      </td>
                      <td className="is-number">{total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section
              className="inbound-report-detail__panel"
              aria-labelledby="inbound-detail-history-title"
            >
              <h2 id="inbound-detail-history-title">
                {tUi("warranty.detail.historyTitle")}
              </h2>
              {history.length > 0 ? (
                <ol className="inbound-report-detail__timeline">
                  {history.map((event, index) => (
                    <li key={event.id || index}>
                      <time>{formatDateTime(event.changedAt)}</time>
                      <div>
                        <strong>
                          {statusName(event.toStatus) || event.action}
                        </strong>
                        {event.note ? <span>{event.note}</span> : null}
                        {event.changedBy ? (
                          <small>{event.changedBy}</small>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="inbound-report-detail__muted">
                  {tUi("uiAudit.text_7ce4362136")}{" "}
                </p>
              )}
            </section>
          </div>

          <section
            className="inbound-report-detail__panel inbound-report-detail__records"
            aria-labelledby="inbound-detail-records-title"
          >
            <h2 id="inbound-detail-records-title" className="inbound-sr-only">
              {tUi("uiAudit.text_435e3fb340")}{" "}
            </h2>
            <div
              className="inbound-report-detail__tabs"
              role="tablist"
              aria-label={tUi("uiAudit.text_435e3fb340")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "codes"}
                onClick={() => {
                  setTab("codes");
                  setSearch("");
                }}
              >
                {tUi("uiAudit.text_b3c09fb699")}
                {entries.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "sku"}
                onClick={() => {
                  setTab("sku");
                  setSearch("");
                }}
              >
                {tUi("reportExport.sku")}{" "}
              </button>
            </div>
            <div className="inbound-report-detail__records-bar">
              <label>
                <span className="inbound-sr-only">
                  {tUi("uiAudit.text_8918a38147")}
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tUi("uiAudit.text_891bdcbace")}
                />
              </label>
              <span>
                {entries.length} {tUi("uiAudit.text_74f03a604c")} {skuCount} SKU
                · {total} {tUi("updatedUi.text_9bfcaa70b19e")}{" "}
              </span>
            </div>
            {entriesQuery.isPending && tab === "codes" ? (
              <p role="status">{tUi("uiAudit.text_e9c00d24f5")}</p>
            ) : null}
            {entriesQuery.isError && tab === "codes" ? (
              <div role="alert">
                {tUi("uiAudit.text_6814c60695")}{" "}
                <button
                  type="button"
                  onClick={() => void entriesQuery.refetch()}
                >
                  {tUi("dashboardAudit.retry")}{" "}
                </button>
              </div>
            ) : null}
            <div className="inbound-report-detail__table-wrap">
              <table>
                <thead>
                  {tab === "codes" ? (
                    <tr>
                      <th>#</th>
                      <th>{tUi("uiAudit.text_62b090dd7e")}</th>
                      <th>{tUi("inbound.skuInfo.fieldCode")}</th>
                      <th>{tUi("inventory.balance.colName")}</th>
                      <th>{tUi("inbound.skuInfo.fieldUnit")}</th>
                      <th className="is-number">
                        {tUi("dashboardSnapshot.quantity")}
                      </th>
                      <th>{tUi("dashboardAudit.status")}</th>
                      <th>{tUi("uiAudit.text_9bcd410dfc")}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>#</th>
                      <th>{tUi("inbound.skuInfo.fieldCode")}</th>
                      <th>{tUi("inventory.balance.colName")}</th>
                      <th>{tUi("inbound.skuInfo.fieldUnit")}</th>
                      <th className="is-number">
                        {tUi("dashboardSnapshot.quantity")}
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {tab === "codes" ? (
                    filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8}>{tUi("uiAudit.text_6422313133")}</td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, index) => {
                        const line = lines.find(
                          (item) =>
                            item.id === entry.lineId || item.sku === entry.sku,
                        );
                        return (
                          <tr key={entry.id}>
                            <td>{index + 1}</td>
                            <td>
                              {entry.serialNumber ||
                                entry.itemCode ||
                                entry.candidateSerialNumber ||
                                entry.candidateItemUnique ||
                                entry.containerCode ||
                                "—"}
                            </td>
                            <td>{entry.sku}</td>
                            <td>{entry.skuName}</td>
                            <td>{line?.productUnit || "—"}</td>
                            <td className="is-number">{entry.quantity}</td>
                            <td>
                              <span
                                className="inbound-report-detail__status"
                                data-status={receipt?.status ?? document.status}
                              >
                                {receipt?.status === "POSTED"
                                  ? tUi("uiAudit.recorded")
                                  : tUi("uiAudit.scanned")}
                              </span>
                            </td>
                            <td>{formatDateTime(entry.capturedAt)}</td>
                          </tr>
                        );
                      })
                    )
                  ) : filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={5}>{tUi("uiAudit.text_0e02128daf")}</td>
                    </tr>
                  ) : (
                    filteredLines.map((line, index) => (
                      <tr key={line.id}>
                        <td>{index + 1}</td>
                        <td>{line.sku}</td>
                        <td>{line.skuName}</td>
                        <td>{line.productUnit || "—"}</td>
                        <td className="is-number">{line.scanned}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
