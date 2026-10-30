import { ReportWarehouseCard } from "@/modules/reports/components/ReportWarehouseCard";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  UiButton,
  UiAlert,
  UiDialog,
  UiTextField,
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
  usePackingLabelSnapshot,
  type PackingLabelEvent,
  type PackingLabelResult,
} from "./packing-label-api";
import { PackingLabelSnapshotScreen } from "./PackingLabelSnapshotScreen";
import { AlignedOutboundDetailModal } from "@/modules/outbound/components/AlignedOutboundDetailModal";
import {
  fetchLabelSnapshots,
  printLabelSnapshot,
  reprintLabelSnapshot,
} from "@/modules/outbound/services/mvpOutboundService";
import "./packing-label-report.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

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
  if (value === "PRINTED") return tUi("reports.packingLabel.resultPrinted");
  if (value === "PRINT_FAILED") return tUi("updatedUi.text_2a2df69319d9");
  return tUi("dashboard.snapshot.stateProcessing");
}

function resultClass(value: PackingLabelResult) {
  if (value === "PRINTED") return "is-success";
  if (value === "PRINT_FAILED") return "is-error";
  return "is-pending";
}

function actionLabel(row: PackingLabelEvent, busy: boolean) {
  if (busy) return tUi("updatedUi.text_79eb2035913d");
  if (row.result === "PRINTED")
    return tUi("reports.packingLabel.outcomeReprint");
  if (row.result === "PRINT_FAILED") return tUi("common.retry");
  return tUi("outbound.detail.print");
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
  const [detailLabelId, setDetailLabelId] = useState<string | null>(null);
  const [viewOutboundId, setViewOutboundId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [actionEventId, setActionEventId] = useState<string | null>(null);
  const [actionPhase, setActionPhase] = useState<ActionPhase>("idle");
  const [reprintRow, setReprintRow] = useState<PackingLabelEvent | null>(null);
  const [reprintReason, setReprintReason] = useState("");
  const [reprintReasonError, setReprintReasonError] = useState(false);
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

  const snapshotContext = useMemo(() => ({
    labels: report.labels,
    printerNames: new Map(report.printerOptions.map((item) => [item.value, item.label])),
    actorNames: new Map(report.events.filter((item) => item.actorId).map((item) => [item.actorId, item.actorName])),
  }), [report.labels, report.printerOptions, report.events]);
  const snapshot = usePackingLabelSnapshot(detailLabelId, snapshotContext);

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
    const printed = report.events.filter(
      (row) => row.result === "PRINTED",
    ).length;
    const failed = report.events.filter(
      (row) => row.result === "PRINT_FAILED",
    ).length;
    const reprinted = report.events.filter(
      (row) => row.action === "REPRINT",
    ).length;
    return { total, printed, failed, reprinted };
  }, [report.events]);

  const printedRate =
    metrics.total > 0
      ? Math.round((metrics.printed / metrics.total) * 1000) / 10
      : 0;

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

  const detailEvent = report.events.find((row) => row.labelId === detailLabelId && row.eventId === selectedEventId)
    ?? report.events.find((row) => row.labelId === detailLabelId)
    ?? null;

  const applyFilters = () => {
    if (draftInvalid) return;
    period.setRange(draftRange);
    setPage(1);
  };

  const resetFilters = () => {
    const next: [Dayjs, Dayjs] = [
      dayjs().startOf("month"),
      dayjs().endOf("day"),
    ];
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

  const handlePrint = async (
    row: PackingLabelEvent,
    confirmedReason?: string,
  ) => {
    if (actionPhase !== "idle" || !online) return;

    if (row.result === "PRINTED") {
      if (confirmedReason === undefined) {
        setReprintRow(row);
        setReprintReason("");
        setReprintReasonError(false);
        setNotice(null);
        return;
      }
      const reason = confirmedReason.trim();
      if (!reason) {
        setReprintReasonError(true);
        return;
      }
      setActionEventId(row.eventId);
      setActionPhase("submitting");
      setNotice(null);
      try {
        const snapshots = await fetchLabelSnapshots();
        const snapshot = snapshots.find((item) => item.id === row.labelId);
        const printerConfigId =
          row.printerId || report.printerOptions[0]?.value;
        if (
          !snapshot?.documentId ||
          snapshot.version === undefined ||
          !printerConfigId
        ) {
          throw new Error(tUi("updatedUi.text_dde858009aea"));
        }
        await reprintLabelSnapshot({
          documentId: snapshot.documentId,
          labelId: snapshot.id,
          printerConfigId,
          ifMatch: snapshot.version,
          idempotencyKey: makeIdempotencyKey("rpt05-reprint"),
          reason: reason.trim(),
        });
        setNotice({
          tone: "success",
          text: tUi("updatedUi.text_e1ba7a344055"),
        });
        setReprintRow(null);
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
            ? tUi("updatedUi.text_1d0ee43b7c56")
            : message || tUi("updatedUi.text_7b667db21ada"),
        });
        if (uncertain) return;
      } finally {
        setActionEventId(null);
        setActionPhase((current) =>
          current === "submitting" ? "idle" : current,
        );
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
      if (
        !snapshot?.documentId ||
        snapshot.version === undefined ||
        !printerConfigId
      ) {
        throw new Error(tUi("updatedUi.text_dde858009aea"));
      }
      await printLabelSnapshot({
        documentId: snapshot.documentId,
        labelId: snapshot.id,
        printerConfigId,
        ifMatch: snapshot.version,
        idempotencyKey: makeIdempotencyKey("rpt05-print"),
      });
      setNotice({
        tone: "success",
        text: tUi("updatedUi.text_13f25c7cce14"),
      });
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
          ? tUi("updatedUi.text_1d0ee43b7c56")
          : message || tUi("updatedUi.text_43ee48f65338"),
      });
      if (uncertain) return;
    } finally {
      setActionEventId(null);
      setActionPhase((current) =>
        current === "submitting" ? "idle" : current,
      );
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
    (keyword.trim() !== "" ||
      tableKeyword.trim() !== "" ||
      statusFilter !== "");

  const showFullFailure = !online || Boolean(report.error);

  if (detailLabelId) {
    return <><PackingLabelSnapshotScreen
      detail={snapshot.detail}
      loading={snapshot.loading}
      error={snapshot.error}
      preview={preview}
      selectedEvent={detailEvent}
      onBack={() => { setDetailLabelId(null); setPreview(false); setViewOutboundId(null); }}
      onPreview={() => setPreview((current) => !current)}
      onPrint={() => {
        if (detailEvent) {
          setDetailLabelId(null);
          setPreview(false);
          void handlePrint(detailEvent);
        }
      }}
      onOpenSource={() => {
        if (snapshot.detail?.outboundDocumentId) setViewOutboundId(snapshot.detail.outboundDocumentId);
      }}
    />{viewOutboundId ? <AlignedOutboundDetailModal documentId={viewOutboundId} onClose={() => setViewOutboundId(null)} onChanged={() => void report.refetch()} /> : null}</>;
  }

  return (
    <div className="hn-pkg-label" data-testid="rpt-tab-packing-label">
      <div className="hn-pkg-label__crumb">
        {tUi("updatedUi.text_3b63f8aabf97")}
      </div>

      <header className="hn-pkg-label__header">
        <div>
          <h1 className="hn-report-page-title">
            {t("reports.packingLabel.title")}
          </h1>
          <p>{t("reports.packingLabel.description")}</p>
        </div>
        <div className="hn-pkg-label__header-actions hn-report-warehouse-actions">
          <UiButton
            appearance="outlined"
            disabled={
              Boolean(exporter.exporting) || showFullFailure || draftInvalid
            }
            onClick={exportXlsx}
          >
            {exporter.exporting
              ? tUi("updatedUi.text_3de340210fb9")
              : tUi("reports.traceability.exportReport")}
          </UiButton>
          <UiButton
            appearance="tonal"
            startIcon={<PrinterOutlined />}
            disabled={!selectedRow || showFullFailure || actionPhase !== "idle"}
            onClick={() => selectedRow && void handlePrint(selectedRow)}
          >
            {actionPhase === "submitting"
              ? tUi("updatedUi.text_8b96ca57d2f4")
              : tUi("outbound.detail.print")}
          </UiButton>

          <ReportWarehouseCard />
        </div>
      </header>

      {!online ? (
        <div className="hn-pkg-label__banner is-warning">
          <WarningOutlined />
          {" " + tUi("updatedUi.text_793312837e7f")}
        </div>
      ) : null}

      {actionPhase === "submitting" ? (
        <div className="hn-pkg-label__banner is-info">
          <PrinterOutlined />
          {" " + tUi("updatedUi.text_c38ce88e41ef")}
        </div>
      ) : null}

      {notice ? (
        <div className={"hn-pkg-label__banner is-" + notice.tone} role="status">
          {notice.tone === "success" ? (
            <CheckCircleOutlined />
          ) : (
            <WarningOutlined />
          )}
          <span>{notice.text}</span>
          <button
            type="button"
            aria-label={tUi("updatedUi.text_8af6ba927e1f")}
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      <section
        className="hn-pkg-label__filter"
        aria-label={tUi("reports.recipientAgency.filterTitle")}
      >
        <div
          className={"hn-pkg-label__field " + (draftInvalid ? "has-error" : "")}
        >
          <label>{tUi("reports.packingLabel.dateRangeLabel")}</label>
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
            <small>{tUi("updatedUi.text_ed929e076375")}</small>
          ) : null}
        </div>

        <div className="hn-pkg-label__field">
          <label>{tUi("updatedUi.text_19c608bfa103")}</label>
          <div className="hn-pkg-label__readonly">◇&nbsp;&nbsp;Kho Hoa Nam</div>
        </div>

        <div className="hn-pkg-label__field">
          <label>{tUi("dashboard.composition.colStatus")}</label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label={tUi("dashboard.composition.colStatus")}
          >
            <option value="">{tUi("updatedUi.text_cdc3530d2f3f")}</option>
            <option value="PRINTED">
              {tUi("reports.packingLabel.resultPrinted")}
            </option>
            <option value="PRINT_FAILED">
              {tUi("updatedUi.text_2a2df69319d9")}
            </option>
            <option value="PENDING_PRINT">
              {tUi("dashboard.snapshot.stateProcessing")}
            </option>
          </select>
        </div>

        <div className="hn-pkg-label__field">
          <label>{tUi("updatedUi.text_5345eb7325a1")}</label>
          <SearchInput
            id="rpt-05-q"
            width="100%"
            value={keyword}
            placeholder={tUi("updatedUi.text_28e2d39c772f")}
            aria-label={tUi("updatedUi.text_5345eb7325a1")}
            onChange={setKeyword}
          />
        </div>

        <div className="hn-pkg-label__filter-meta">
          <span>
            {tUi("updatedUi.text_e7ea4adf1845") + " "}
            {period.from.split("-").reverse().join("/")}–
            {period.to.split("-").reverse().join("/")}
          </span>
          <span>{tUi("updatedUi.text_bebd46bc068a")}</span>
        </div>
        <div className="hn-pkg-label__filter-actions">
          <UiButton
            appearance="tonal"
            disabled={draftInvalid || !online}
            onClick={applyFilters}
          >
            {tUi("dashboard.snapshot.apply")}
          </UiButton>
          <UiButton appearance="text" onClick={resetFilters}>
            {tUi("reports.packingLabel.reset")}
          </UiButton>
        </div>
      </section>
      <UiDialog
        open={Boolean(reprintRow)}
        onClose={() => {
          if (actionPhase !== "submitting") setReprintRow(null);
        }}
        title={tUi("outbound.detail.reprint")}
        maxWidth="sm"
        actions={
          <>
            <UiButton
              appearance="outlined"
              disabled={actionPhase === "submitting"}
              onClick={() => setReprintRow(null)}
            >
              {tUi("dashboard.snapshot.cancel")}
            </UiButton>
            <UiButton
              appearance="filled"
              loading={actionPhase === "submitting"}
              disabled={!online || actionPhase !== "idle"}
              onClick={() => {
                if (reprintRow) void handlePrint(reprintRow, reprintReason);
              }}
            >
              {tUi("updatedUi.text_a0455ba3ad22")}
            </UiButton>
          </>
        }
      >
        <p style={{ color: "var(--ops-muted)", margin: "0 0 14px" }}>
          {reprintRow?.labelCode} · {reprintRow?.outboundNo}
        </p>
        {notice && notice.tone !== "success" ? (
          <div style={{ marginBottom: 14 }}>
            <UiAlert tone={notice.tone}>{notice.text}</UiAlert>
          </div>
        ) : null}
        <UiTextField
          autoFocus
          fullWidth
          required
          multiline
          minRows={3}
          label={tUi("outbound.reprint.title")}
          value={reprintReason}
          disabled={actionPhase !== "idle"}
          error={reprintReasonError}
          helperText={
            reprintReasonError
              ? tUi("updatedUi.text_e113e89ba4b9")
              : tUi("updatedUi.text_097751df70a6")
          }
          onChange={(event) => {
            setReprintReason(event.target.value);
            setReprintReasonError(false);
          }}
        />
      </UiDialog>

      {!showFullFailure ? (
        <>
          <section
            className="hn-pkg-label__kpis"
            aria-label={tUi("updatedUi.text_8919df372459")}
          >
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-blue">
                <PrinterOutlined />
              </span>
              <div>
                <span>{tUi("updatedUi.text_63a9dc4f581c")}</span>
                <strong>{formatQuantity(metrics.total)}</strong>
                <small>{tUi("updatedUi.text_2c5c7edb2cb3")}</small>
              </div>
            </article>
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-green">
                <CheckCircleOutlined />
              </span>
              <div>
                <span>{tUi("reports.packingLabel.resultPrinted")}</span>
                <strong>{formatQuantity(metrics.printed)}</strong>
                <small className="is-green-text">
                  {printedRate.toLocaleString("vi-VN")}
                  {tUi("updatedUi.text_9828e86e38cd")}
                </small>
              </div>
            </article>
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-red">
                <WarningOutlined />
              </span>
              <div>
                <span>{tUi("updatedUi.text_8d18877fc9ca")}</span>
                <strong>{formatQuantity(metrics.failed)}</strong>
                <small className="is-red-text">
                  {tUi("reports.traceability.needsReview")}
                </small>
              </div>
            </article>
            <article className="hn-pkg-label__kpi">
              <span className="hn-pkg-label__kpi-icon is-blue">
                <UndoOutlined />
              </span>
              <div>
                <span>{tUi("updatedUi.text_c5476e0cf681")}</span>
                <strong>{formatQuantity(metrics.reprinted)}</strong>
                <small>{tUi("updatedUi.text_9ec67691c148")}</small>
              </div>
            </article>
          </section>

          <section className="hn-pkg-label__health">
            <h2>{tUi("updatedUi.text_d7501a48ef2c")}</h2>
            <div className="hn-pkg-label__health-body">
              <div className="hn-pkg-label__bar-wrap">
                <div className="hn-pkg-label__bar">
                  <span style={{ width: String(printedRate) + "%" }} />
                  <i
                    style={{
                      width: String(Math.max(0, 100 - printedRate)) + "%",
                    }}
                  />
                </div>
                <div className="hn-pkg-label__legend">
                  <span>
                    <b className="is-green-dot" />{" "}
                    <strong>{formatQuantity(metrics.printed)}</strong>
                    {" " + tUi("updatedUi.text_a68b980df605")}
                  </span>
                  <span>
                    <b className="is-red-dot" />{" "}
                    <strong>{formatQuantity(metrics.failed)}</strong>
                    {" " + tUi("updatedUi.text_9f2be3acefea")}
                  </span>
                </div>
              </div>
              <div className="hn-pkg-label__health-number">
                <strong>{printedRate.toLocaleString("vi-VN")}%</strong>
                <span>{tUi("updatedUi.text_9ada32d66f1d")}</span>
              </div>
              <div className="hn-pkg-label__health-number">
                <strong>{formatQuantity(metrics.reprinted)}</strong>
                <span>{tUi("updatedUi.text_b26797dded3e")}</span>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section
        className={
          "hn-pkg-label__list " + (showFullFailure ? "is-full-state" : "")
        }
      >
        {showFullFailure ? (
          <div className="hn-pkg-label__full-state">
            <span className="hn-pkg-label__state-icon">
              <WarningOutlined />
            </span>
            <h2>
              {online
                ? tUi("dashboard.alert.failedBadge")
                : tUi("updatedUi.text_ce0ba8d55ff5")}
            </h2>
            <p>
              {online
                ? tUi("updatedUi.text_746ce26e0f2a")
                : tUi("updatedUi.text_3ad5d030ccde")}
            </p>
            <UiButton
              appearance="tonal"
              startIcon={<ReloadOutlined />}
              disabled={!online}
              onClick={refresh}
            >
              {tUi("common.retry")}
            </UiButton>
          </div>
        ) : (
          <>
            <div className="hn-pkg-label__list-head">
              <div className="hn-pkg-label__list-title">
                <h2>{tUi("updatedUi.text_257e942e79dc")}</h2>
                <span className="hn-pkg-label__count">
                  {partial
                    ? tUi("updatedUi.text_ebc5a4d489c7")
                    : formatQuantity(filteredRows.length)}
                </span>
                {partial ? (
                  <span className="hn-pkg-label__partial">
                    <WarningOutlined />
                    {" " + tUi("updatedUi.text_3349b06e35cf")}
                  </span>
                ) : null}
              </div>
              <SearchInput
                id="rpt-05-table-q"
                width="100%"
                value={tableKeyword}
                placeholder={tUi("updatedUi.text_aa051eef2028")}
                aria-label={tUi("updatedUi.text_e7b976530be3")}
                onChange={setTableKeyword}
              />
            </div>

            <div className="hn-pkg-label__table-wrap">
              <table className="hn-pkg-label__table">
                <thead>
                  <tr>
                    <th>
                      {tUi("updatedUi.text_54b9001e5cce")}
                      <br />
                      {tUi("warranty.componentList.colCode")}
                    </th>
                    <th>
                      SKU /<br />
                      {tUi("dashboard.skuType.product")}
                    </th>
                    <th>{tUi("updatedUi.text_cc63dd2119ce")}</th>
                    <th>{tUi("dashboard.composition.colStatus")}</th>
                    <th>
                      {tUi("updatedUi.text_2b044f4871ca")}
                      <br />
                      in
                    </th>
                    <th>{tUi("outbound.detail.colAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.loading ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="hn-pkg-label__empty">
                          <span className="hn-pkg-label__spinner" />
                          {tUi("shared.states.loadingData")}
                        </div>
                      </td>
                    </tr>
                  ) : partial ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="hn-pkg-label__empty">
                          <span className="hn-pkg-label__state-icon is-small">
                            <WarningOutlined />
                          </span>
                          <h3>{tUi("updatedUi.text_f826e626c6ce")}</h3>
                          <p>{tUi("updatedUi.text_150036f2ad25")}</p>
                          <small>{tUi("updatedUi.text_15e514f9796a")}</small>
                          <UiButton
                            appearance="outlined"
                            startIcon={<ReloadOutlined />}
                            onClick={refresh}
                          >
                            {tUi("shared.address.retry")}
                          </UiButton>
                        </div>
                      </td>
                    </tr>
                  ) : noResult ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="hn-pkg-label__empty">
                          <h3>{tUi("updatedUi.text_21b5584e639e")}</h3>
                          <p>{tUi("updatedUi.text_3bbb177609bb")}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const skuSummary =
                        report.labels.get(row.labelId)?.skuSummary || "—";
                      const busy =
                        actionEventId === row.eventId &&
                        actionPhase === "submitting";
                      return (
                        <tr
                          key={row.eventId}
                          className={
                            selectedRow?.eventId === row.eventId
                              ? "is-selected"
                              : ""
                          }
                          onClick={() => setSelectedEventId(row.eventId)}
                        >
                          <td>
                            <strong>{row.labelCode || "—"}</strong>
                            <span>{row.outboundNo || "—"}</span>
                          </td>
                          <td>
                            <strong>{skuSummary.split(",")[0] || "—"}</strong>
                            <span>{row.recipient || "—"}</span>
                          </td>
                          <td>
                            {row.attemptedAt
                              ? formatDateTime(row.attemptedAt)
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={
                                "hn-pkg-label__status " +
                                resultClass(row.result)
                              }
                            >
                              <b />
                              {resultLabel(row.result)}
                            </span>
                          </td>
                          <td className="is-center">
                            {Math.max(1, row.attemptNo || 1)}
                          </td>
                          <td>
                            <RowActionGroup>
                              <RowActionButton
                                kind="view"
                                aria-label={`Xem chi tiết nhãn ${row.labelCode}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedEventId(row.eventId);
                                  setDetailLabelId(row.labelId);
                                  setPreview(false);
                                }}
                              >
                                Chi tiết
                              </RowActionButton>
                              <RowActionButton
                                kind="print"
                                disabled={actionPhase !== "idle" || !online}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handlePrint(row);
                                }}
                                loading={busy}
                              >
                                {actionLabel(row, busy)}
                              </RowActionButton>
                            </RowActionGroup>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="hn-pkg-label__list-footer hn-report-pagination-footer">
              <div>
                <strong>
                  {tUi("putaway.queue.showing")}{" "}
                  {filteredRows.length === 0
                    ? 0
                    : (safePage - 1) * PAGE_SIZE + 1}
                  –{Math.min(safePage * PAGE_SIZE, filteredRows.length)} /{" "}
                  {formatQuantity(filteredRows.length)}
                  {" " + tUi("updatedUi.text_ab184fe298be")}
                </strong>
                <span>{tUi("updatedUi.text_5f1b29ade3fd")}</span>
              </div>
              <nav
                className="hn-pkg-label__pagination hn-report-pagination"
                aria-label={tUi("shared.table.pagination")}
              >
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from(
                  { length: Math.min(totalPages, 3) },
                  (_, index) => index + 1,
                ).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={safePage === value ? "is-active" : ""}
                    onClick={() => setPage(value)}
                  >
                    {value}
                  </button>
                ))}
                {totalPages > 4 ? <span>…</span> : null}
                {totalPages > 3 ? (
                  <button
                    type="button"
                    className={safePage === totalPages ? "is-active" : ""}
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
              </nav>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
