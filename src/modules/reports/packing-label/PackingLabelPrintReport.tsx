import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  UiButton,
  UiVuexyDateRangePicker,
} from "@/shared/ui";
import {
  CheckCircleOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { usePeriodFilter } from "../operations/report-period";
import { reportRangePresets } from "../operations/report-range-presets";
import { useReportExport } from "../operations/report-export";
import { useT } from "@/shared/i18n/useT";
import {
  usePackingLabelReport,
  type PackingLabelEvent,
  type PackingLabelResult,
} from "./packing-label-api";
import {
  fetchLabelSnapshots,
  printLabelSnapshot,
  reprintLabelSnapshot,
} from "@/modules/outbound/services/mvpOutboundService";
import "./packing-label-report.css";

type ActionPhase = "idle" | "submitting" | "uncertain";

type Notice =
  | { tone: "success"; text: string }
  | { tone: "warning"; text: string }
  | { tone: "error"; text: string }
  | null;

const PAGE_SIZE = 5;

function makeIdempotencyKey(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  return prefix + "-" + suffix;
}

function resultLabel(value: PackingLabelResult) {
  if (value === "PRINTED") return "In thành công";
  if (value === "PRINT_FAILED") return "Lỗi in";
  return "Đang xử lý";
}

function resultClass(value: PackingLabelResult) {
  if (value === "PRINTED") return "is-success";
  if (value === "PRINT_FAILED") return "is-error";
  return "is-pending";
}

function actionLabel(row: PackingLabelEvent, busy: boolean) {
  if (busy) return "Đang xử lý…";
  if (row.result === "PRINTED") return "In lại";
  if (row.result === "PRINT_FAILED") return "Thử lại";
  return "In nhãn";
}

export default function PackingLabelPrintReport() {
  const t = useT();
  const period = usePeriodFilter("this-month");
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const exporter = useReportExport();

  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs]>([
    period.range[0],
    period.range[1],
  ]);
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [tableKeyword, setTableKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [actionEventId, setActionEventId] = useState<string | null>(null);
  const [actionPhase, setActionPhase] = useState<ActionPhase>("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const report = usePackingLabelReport({
    from: period.from,
    to: period.to,
    enabled: online,
  });

  const draftInvalid = draftRange[0].isAfter(draftRange[1], "day");

  const filteredRows = useMemo(() => {
    const topNeedle = keyword.trim().toLocaleLowerCase("vi");
    const tableNeedle = tableKeyword.trim().toLocaleLowerCase("vi");
    return report.events.filter((row) => {
      if (statusFilter && row.result !== statusFilter) return false;
      const sku = report.labels.get(row.labelId)?.skuSummary ?? "";
      const haystack = [
        row.labelCode,
        row.outboundNo,
        row.recipient,
        row.printerName,
        row.actorName,
        sku,
      ]
        .join(" ")
        .toLocaleLowerCase("vi");
      if (topNeedle && !haystack.includes(topNeedle)) return false;
      if (tableNeedle && !haystack.includes(tableNeedle)) return false;
      return true;
    });
  }, [report.events, report.labels, statusFilter, keyword, tableKeyword]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, keyword, tableKeyword, period.from, period.to]);

  const metrics = useMemo(() => {
    const total = report.events.length;
    const printed = report.events.filter((row) => row.result === "PRINTED").length;
    const failed = report.events.filter((row) => row.result === "PRINT_FAILED").length;
    const reprinted = report.events.filter((row) => row.action === "REPRINT").length;
    return { total, printed, failed, reprinted };
  }, [report.events]);

  const printedRate =
    metrics.total > 0 ? Math.round((metrics.printed / metrics.total) * 1000) / 10 : 0;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const selectedRow =
    filteredRows.find((row) => row.eventId === selectedEventId) ??
    pageRows[0] ??
    null;

  const applyFilters = () => {
    if (draftInvalid) return;
    period.setRange(draftRange);
    setPage(1);
  };

  const resetFilters = () => {
    const next: [Dayjs, Dayjs] = [dayjs().startOf("month"), dayjs().endOf("day")];
    setDraftRange(next);
    period.setRange(next);
    setStatusFilter("");
    setKeyword("");
    setTableKeyword("");
    setPage(1);
  };

  const refresh = () => {
    setNotice(null);
    report.refetch();
  };

  const handlePrint = async (row: PackingLabelEvent) => {
    if (actionPhase !== "idle" || !online) return;

    if (row.result === "PRINTED") {
      const reason = window.prompt("Lý do in lại nhãn");
      if (!reason?.trim()) return;
      setActionEventId(row.eventId);
      setActionPhase("submitting");
      setNotice(null);
      try {
        const snapshots = await fetchLabelSnapshots();
        const snapshot = snapshots.find((item) => item.id === row.labelId);
        const printerConfigId = row.printerId || report.printerOptions[0]?.value;
        if (!snapshot?.documentId || snapshot.version === undefined || !printerConfigId) {
          throw new Error("Thiếu thông tin phiên bản hoặc máy in.");
        }
        await reprintLabelSnapshot({
          documentId: snapshot.documentId,
          labelId: snapshot.id,
          printerConfigId,
          ifMatch: snapshot.version,
          idempotencyKey: makeIdempotencyKey("rpt05-reprint"),
          reason: reason.trim(),
        });
        setNotice({ tone: "success", text: "In lại nhãn thành công." });
        report.refetch();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const uncertain =
          !navigator.onLine ||
          /network|fetch|timeout|timed out|connection/i.test(message);
        setActionPhase(uncertain ? "uncertain" : "idle");
        setNotice({
          tone: uncertain ? "warning" : "error",
          text: uncertain
            ? "Chưa xác định kết quả in. Yêu cầu đã gửi; tạm khóa gửi lại để tránh in trùng."
            : message || "Không thể in lại nhãn.",
        });
        if (uncertain) return;
      } finally {
        setActionEventId(null);
        setActionPhase((current) => (current === "submitting" ? "idle" : current));
      }
      return;
    }

    setActionEventId(row.eventId);
    setActionPhase("submitting");
    setNotice(null);
    try {
      const snapshots = await fetchLabelSnapshots();
      const snapshot = snapshots.find((item) => item.id === row.labelId);
      const printerConfigId = row.printerId || report.printerOptions[0]?.value;
      if (!snapshot?.documentId || snapshot.version === undefined || !printerConfigId) {
        throw new Error("Thiếu thông tin phiên bản hoặc máy in.");
      }
      await printLabelSnapshot({
        documentId: snapshot.documentId,
        labelId: snapshot.id,
        printerConfigId,
        ifMatch: snapshot.version,
        idempotencyKey: makeIdempotencyKey("rpt05-print"),
      });
      setNotice({ tone: "success", text: "Đã gửi yêu cầu in nhãn thành công." });
      report.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const uncertain =
        !navigator.onLine ||
        /network|fetch|timeout|timed out|connection/i.test(message);
      setActionPhase(uncertain ? "uncertain" : "idle");
      setNotice({
        tone: uncertain ? "warning" : "error",
        text: uncertain
          ? "Chưa xác định kết quả in. Yêu cầu đã gửi; tạm khóa gửi lại để tránh in trùng."
          : message || "Không thể gửi yêu cầu in nhãn.",
      });
      if (uncertain) return;
    } finally {
      setActionEventId(null);
      setActionPhase((current) => (current === "submitting" ? "idle" : current));
    }
  };

  const exportXlsx = () => {
    void exporter.exportReport("xlsx", {
      reportCode: "label-log",
      fileStem: "packing-label-log",
      fileSuffix: "-" + period.from + "-" + period.to,
      filters: {
        from_date: period.from,
        to_date: period.to,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      },
    });
  };

  const partial = Boolean(report.eventsError) && !report.error;
  const noResult =
    !report.loading &&
    !report.error &&
    filteredRows.length === 0 &&
    (keyword.trim() !== "" || tableKeyword.trim() !== "" || statusFilter !== "");

  const showFullFailure = !online || Boolean(report.error);

  return (
    <div className="hn-pkg-label" data-testid="rpt-tab-packing-label">
      <div className="hn-pkg-label__crumb">⌂&nbsp;&nbsp; Báo cáo &nbsp;/&nbsp; Nhãn đóng gói</div>

      <header className="hn-pkg-label__header">
        <div>
          <h1>{t("reports.packingLabel.title")}</h1>
          <p>{t("reports.packingLabel.description")}</p>
        </div>
        <div className="hn-pkg-label__header-actions">
          <span className="hn-pkg-label__demo-chip">ⓘ&nbsp; Dữ liệu minh họa</span>
          <UiButton
            appearance="outlined"
            disabled={exporter.exporting || showFullFailure || draftInvalid}
            onClick={exportXlsx}
          >
            {exporter.exporting ? "Đang xuất…" : "Xuất báo cáo"}
          </UiButton>
          <UiButton
            appearance="tonal"
            startIcon={<PrinterOutlined />}
            disabled={!selectedRow || showFullFailure || actionPhase !== "idle"}
            onClick={() => selectedRow && void handlePrint(selectedRow)}
          >
            {actionPhase === "submitting" ? "Đang gửi yêu cầu…" : "In nhãn"}
          </UiButton>
        </div>
      </header>

      {!online ? (
        <div className="hn-pkg-label__banner is-warning">
          <WarningOutlined /> Bạn đang ngoại tuyến. Không thể tải dữ liệu mới.
        </div>
      ) : null}

      {actionPhase === "submitting" ? (
        <div className="hn-pkg-label__banner is-info">
          <PrinterOutlined /> Đang gửi yêu cầu in nhãn
        </div>
      ) : null}

      {notice ? (
        <div className={"hn-pkg-label__banner is-" + notice.tone} role="status">
          {notice.tone === "success" ? <CheckCircleOutlined /> : <WarningOutlined />}
          <span>{notice.text}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      ) : null}

      <section className="hn-pkg-label__filter" aria-label="Bộ lọc báo cáo">
        <div className={"hn-pkg-label__field " + (draftInvalid ? "has-error" : "")}>
          <label>Khoảng thời gian</label>
          <UiVuexyDateRangePicker
            value={draftRange}
            format="DD/MM/YYYY"
            allowClear={false}
            presets={periodPresets}
            maxDate={dayjs().endOf("day")}
            className="hn-vuexy-date-range"
            popupClassName="hn-packing-label-date-popup"
            onChange={(value) => {
              if (value?.[0] && value?.[1]) setDraftRange([value[0], value[1]]);
            }}
          />
          {draftInvalid ? (
            <small>ⓘ Ngày bắt đầu không được sau ngày kết thúc.</small>
          ) : null}
        </div>

        <div className="hn-pkg-label__field">
          <label>Kho</label>
          <div className="hn-pkg-label__readonly">◇&nbsp;&nbsp;Kho Hoa Nam</div>
        </div>

        <div className="hn-pkg-label__field">
          <label>Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Trạng thái"
          >
            <option value="">▤&nbsp;&nbsp;Tất cả</option>
            <option value="PRINTED">In thành công</option>
            <option value="PRINT_FAILED">Lỗi in</option>
            <option value="PENDING_PRINT">Đang xử lý</option>
          </select>
        </div>

        <div className="hn-pkg-label__field">
          <label>Tìm kiếm báo cáo</label>
          <SearchInput
            id="rpt-05-q"
            width="100%"
            value={keyword}
            placeholder="Mã nhãn, SKU, mã phiếu..."
            aria-label="Tìm kiếm báo cáo"
            onChange={setKeyword}
          />
        </div>

        <div className="hn-pkg-label__filter-meta">
          <span>Kỳ báo cáo: {period.from.split("-").reverse().join("/")}–{period.to.split("-").reverse().join("/")}</span>
          <span>Múi giờ Việt Nam</span>
        </div>
        <div className="hn-pkg-label__filter-actions">
          <UiButton appearance="tonal" disabled={draftInvalid || !online} onClick={applyFilters}>
            Áp dụng
          </UiButton>
          <UiButton appearance="text" onClick={resetFilters}>Đặt lại</UiButton>
        </div>
      </section>

      {!showFullFailure ? (
        <>
          <section className="hn-pkg-label__kpis" aria-label="Tổng quan in nhãn">
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-blue"><PrinterOutlined /></span>
              <div><span>Tổng nhãn</span><strong>{formatQuantity(metrics.total)}</strong><small>Nhãn duy nhất trong kỳ</small></div>
            </article>
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-green"><CheckCircleOutlined /></span>
              <div><span>In thành công</span><strong>{formatQuantity(metrics.printed)}</strong><small className="is-green-text">{printedRate.toLocaleString("vi-VN")}% tổng nhãn</small></div>
            </article>
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-red"><WarningOutlined /></span>
              <div><span>Nhãn lỗi</span><strong>{formatQuantity(metrics.failed)}</strong><small className="is-red-text">Cần kiểm tra</small></div>
            </article>
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-blue"><UndoOutlined /></span>
              <div><span>Lượt in lại</span><strong>{formatQuantity(metrics.reprinted)}</strong><small>Lượt độc lập · Không cộng tổng nhãn</small></div>
            </article>
          </section>

          <section className="hn-pkg-label__health">
            <h2>Tình trạng in nhãn</h2>
            <div className="hn-pkg-label__health-body">
              <div className="hn-pkg-label__bar-wrap">
                <div className="hn-pkg-label__bar">
                  <span style={{ width: String(printedRate) + "%" }} />
                  <i style={{ width: String(Math.max(0, 100 - printedRate)) + "%" }} />
                </div>
                <div className="hn-pkg-label__legend">
                  <span><b className="is-green-dot" /> <strong>{formatQuantity(metrics.printed)}</strong> thành công</span>
                  <span><b className="is-red-dot" /> <strong>{formatQuantity(metrics.failed)}</strong> lỗi</span>
                </div>
              </div>
              <div className="hn-pkg-label__health-number"><strong>{printedRate.toLocaleString("vi-VN")}%</strong><span>Tỷ lệ in thành công</span></div>
              <div className="hn-pkg-label__health-number"><strong>{formatQuantity(metrics.reprinted)}</strong><span>lượt in lại</span></div>
            </div>
          </section>
        </>
      ) : null}

      <section className={"hn-pkg-label__list " + (showFullFailure ? "is-full-state" : "")}>
        {showFullFailure ? (
          <div className="hn-pkg-label__full-state">
            <span className="hn-pkg-label__state-icon"><WarningOutlined /></span>
            <h2>{online ? "Không thể tải dữ liệu" : "Không có kết nối mạng"}</h2>
            <p>{online ? "Đã xảy ra lỗi khi tải báo cáo. Vui lòng thử lại." : "Kiểm tra kết nối và thử lại."}</p>
            <UiButton
              appearance="tonal"
              startIcon={<ReloadOutlined />}
              disabled={!online}
              onClick={refresh}
            >
              Thử lại
            </UiButton>
          </div>
        ) : (
          <>
            <div className="hn-pkg-label__list-head">
              <div className="hn-pkg-label__list-title">
                <h2>Danh sách nhãn</h2>
                <span className="hn-pkg-label__count">
                  {partial ? "Chưa cập nhật" : formatQuantity(filteredRows.length)}
                </span>
                {partial ? (
                  <span className="hn-pkg-label__partial">⚠ Dữ liệu có thể chưa đầy đủ</span>
                ) : null}
              </div>
              <SearchInput
                id="rpt-05-table-q"
                width="100%"
                value={tableKeyword}
                placeholder="Tìm trong danh sách nhãn..."
                aria-label="Tìm trong danh sách nhãn"
                onChange={setTableKeyword}
              />
            </div>

            <div className="hn-pkg-label__table-wrap">
              <table className="hn-pkg-label__table">
                <thead>
                  <tr>
                    <th>Mã nhãn /<br />Mã phiếu</th>
                    <th>SKU /<br />Sản phẩm</th>
                    <th>Thời gian in</th>
                    <th>Trạng thái</th>
                    <th>Số lần<br />in</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {report.loading ? (
                    <tr><td colSpan={6}><div className="hn-pkg-label__empty"><span className="hn-pkg-label__spinner" />Đang tải dữ liệu…</div></td></tr>
                  ) : partial ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="hn-pkg-label__empty">
                          <span className="hn-pkg-label__state-icon is-small"><WarningOutlined /></span>
                          <h3>Chưa tải được danh sách nhãn</h3>
                          <p>Tải lại để cập nhật danh sách nhãn.</p>
                          <small>Xuất báo cáo tạm khóa: danh sách chưa đầy đủ.</small>
                          <UiButton appearance="outlined" startIcon={<ReloadOutlined />} onClick={refresh}>Tải lại</UiButton>
                        </div>
                      </td>
                    </tr>
                  ) : noResult ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="hn-pkg-label__empty">
                          <h3>Không tìm thấy nhãn phù hợp</h3>
                          <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const skuSummary = report.labels.get(row.labelId)?.skuSummary || "—";
                      const busy = actionEventId === row.eventId && actionPhase === "submitting";
                      return (
                        <tr
                          key={row.eventId}
                          className={selectedRow?.eventId === row.eventId ? "is-selected" : ""}
                          onClick={() => setSelectedEventId(row.eventId)}
                        >
                          <td><strong>{row.labelCode || "—"}</strong><span>{row.outboundNo || "—"}</span></td>
                          <td><strong>{skuSummary.split(",")[0] || "—"}</strong><span>{row.recipient || "—"}</span></td>
                          <td>{row.attemptedAt ? formatDateTime(row.attemptedAt) : "—"}</td>
                          <td><span className={"hn-pkg-label__status " + resultClass(row.result)}><b />{resultLabel(row.result)}</span></td>
                          <td className="is-center">{Math.max(1, row.attemptNo || 1)}</td>
                          <td>
                            <UiButton
                              appearance="outlined"
                              size="small"
                              startIcon={busy ? <ReloadOutlined /> : <UndoOutlined />}
                              disabled={actionPhase !== "idle" || !online}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handlePrint(row);
                              }}
                            >
                              {actionLabel(row, busy)}
                            </UiButton>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="hn-pkg-label__list-footer">
              <div>
                <strong>
                  Hiển thị {filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredRows.length)} / {formatQuantity(filteredRows.length)} nhãn
                </strong>
                <span>Dữ liệu theo kỳ đã áp dụng</span>
              </div>
              <nav className="hn-pkg-label__pagination" aria-label="Phân trang">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1).map((value) => (
                  <button key={value} type="button" className={safePage === value ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button>
                ))}
                {totalPages > 4 ? <span>…</span> : null}
                {totalPages > 3 ? <button type="button" className={safePage === totalPages ? "is-active" : ""} onClick={() => setPage(totalPages)}>{totalPages}</button> : null}
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
              </nav>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
