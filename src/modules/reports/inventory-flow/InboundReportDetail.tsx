import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  useInboundDetail,
  useInboundScanEntries,
} from "@/modules/inbound/hooks/use-inbound";
import { exportXlsx } from "@/shared/utils/export-xlsx";
import type { FlowDocument } from "./inventory-flow-api";
import "./inbound-report-detail.css";

type InboundReportDetailProps = {
  document: FlowDocument;
  range: { from: string; to: string };
  canExport: boolean;
  onBack: () => void;
};

const statusNames: Record<string, string> = {
  DRAFT: "Chờ nhập",
  SCANNING: "Đang nhập",
  POSTED: "Đã nhập kho",
  CANCELLED: "Đã hủy",
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  const parsed = dayjs(value);
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
  const detailQuery = useInboundDetail(document.id);
  const entriesQuery = useInboundScanEntries(document.id, "ALL");
  const [tab, setTab] = useState<"codes" | "sku">("codes");
  const [search, setSearch] = useState("");
  const detail = detailQuery.data;
  const receipt = detail?.document;
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

  const exportDetail = () => {
    if (!detail || !canExport) return;
    exportXlsx(
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
      `chi-tiet-nhap-kho-${receipt?.code ?? document.document_no}`,
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
          ← <span>Báo cáo nhập kho</span>
        </button>
        <div className="inbound-report-detail__heading-row">
          <div>
            <h1>Chi tiết báo cáo nhập kho</h1>
            <p>
              <strong>{receipt?.code ?? document.document_no}</strong>
              <span>
                {" "}
                · {document.counterpart || receipt?.source || "—"} ·{" "}
              </span>
              <span
                className="inbound-report-detail__status"
                data-status={receipt?.status ?? document.status}
              >
                {statusName(receipt?.status ?? document.status)}
              </span>
            </p>
          </div>
          <div className="inbound-report-detail__actions">
            <small>
              Phạm vi báo cáo: {range.from} – {range.to} ·{" "}
              {document.warehouse_code || "—"} · Giờ Việt Nam
            </small>
            <div>
              <Link
                className="inbound-report-detail__source"
                to={`/inbound?screen=IN-03&id=${encodeURIComponent(document.id)}`}
              >
                Mở chứng từ gốc ↗
              </Link>
              {canExport ? (
                <button
                  type="button"
                  className="inbound-report-detail__export"
                  disabled={!detail}
                  onClick={exportDetail}
                >
                  Xuất chi tiết
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {detailQuery.isPending ? (
        <p role="status">Đang tải chi tiết phiếu nhập...</p>
      ) : null}
      {detailQuery.isError ? (
        <div role="alert" className="inbound-report-detail__error">
          Không tải được chi tiết phiếu nhập.{" "}
          <button type="button" onClick={() => void detailQuery.refetch()}>
            Thử lại
          </button>
        </div>
      ) : null}
      {detail ? (
        <>
          <section
            className="inbound-report-detail__info"
            aria-labelledby="inbound-detail-info-title"
          >
            <h2 id="inbound-detail-info-title">Thông tin phiếu nhập</h2>
            <dl>
              <div>
                <dt>Mã phiếu nhập</dt>
                <dd>{receipt?.code || "—"}</dd>
              </div>
              <div>
                <dt>Số chứng từ nguồn</dt>
                <dd>{receipt?.sourceReference || "—"}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
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
                <dt>Ngày tạo</dt>
                <dd>{formatDateTime(receipt?.createdAt)}</dd>
              </div>
              <div>
                <dt>Nhà cung cấp / nguồn</dt>
                <dd>{document.counterpart || receipt?.source || "—"}</dd>
              </div>
              <div>
                <dt>Kho nhập</dt>
                <dd>
                  {document.warehouse_code || receipt?.warehouseId || "—"}
                </dd>
              </div>
              <div>
                <dt>Người tạo</dt>
                <dd>{receipt?.createdBy || document.created_by_name || "—"}</dd>
              </div>
              <div>
                <dt>Ngày ghi nhận nhập kho</dt>
                <dd>{formatDateTime(document.posted_at)}</dd>
              </div>
            </dl>
          </section>

          <div className="inbound-report-detail__overview">
            <section
              className="inbound-report-detail__panel"
              aria-labelledby="inbound-detail-sku-title"
            >
              <h2 id="inbound-detail-sku-title">Danh sách SKU nhập kho</h2>
              <div className="inbound-report-detail__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mã SKU</th>
                      <th>Tên hàng</th>
                      <th>Đơn vị tính</th>
                      <th className="is-number">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Chưa có SKU được ghi nhận.</td>
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
                      <td colSpan={3}>Tổng cộng</td>
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
              <h2 id="inbound-detail-history-title">Lịch sử xử lý</h2>
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
                  Chưa có lịch sử trạng thái.
                </p>
              )}
            </section>
          </div>

          <section
            className="inbound-report-detail__panel inbound-report-detail__records"
            aria-labelledby="inbound-detail-records-title"
          >
            <h2 id="inbound-detail-records-title" className="inbound-sr-only">
              Dữ liệu nhập kho
            </h2>
            <div
              className="inbound-report-detail__tabs"
              role="tablist"
              aria-label="Dữ liệu nhập kho"
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
                Mã đã ghi nhận ({entries.length})
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
                Tổng hợp SKU
              </button>
            </div>
            <div className="inbound-report-detail__records-bar">
              <label>
                <span className="inbound-sr-only">Tìm mã hoặc SKU</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã hoặc SKU..."
                />
              </label>
              <span>
                {entries.length} mã · {skuCount} SKU · {total} sản phẩm
              </span>
            </div>
            {entriesQuery.isPending && tab === "codes" ? (
              <p role="status">Đang tải mã đã ghi nhận...</p>
            ) : null}
            {entriesQuery.isError && tab === "codes" ? (
              <div role="alert">
                Không tải được mã đã ghi nhận.{" "}
                <button
                  type="button"
                  onClick={() => void entriesQuery.refetch()}
                >
                  Thử lại
                </button>
              </div>
            ) : null}
            <div className="inbound-report-detail__table-wrap">
              <table>
                <thead>
                  {tab === "codes" ? (
                    <tr>
                      <th>STT</th>
                      <th>Mã serial / mã quét</th>
                      <th>Mã SKU</th>
                      <th>Tên hàng</th>
                      <th>Đơn vị tính</th>
                      <th className="is-number">Số lượng</th>
                      <th>Trạng thái</th>
                      <th>Ngày ghi nhận</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>STT</th>
                      <th>Mã SKU</th>
                      <th>Tên hàng</th>
                      <th>Đơn vị tính</th>
                      <th className="is-number">Số lượng</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {tab === "codes" ? (
                    filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8}>Không có mã phù hợp.</td>
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
                                  ? "Đã ghi nhận"
                                  : "Đã quét"}
                              </span>
                            </td>
                            <td>{formatDateTime(entry.capturedAt)}</td>
                          </tr>
                        );
                      })
                    )
                  ) : filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Không có SKU phù hợp.</td>
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
