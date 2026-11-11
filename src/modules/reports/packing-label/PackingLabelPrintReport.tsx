import { businessToday } from "@/shared/utils/date-time";
import { ReportExportAction } from "@/modules/reports/components/ReportExportAction";
import { reportExportSections } from "@/modules/reports/components/report-export-sections";
import { reportWorkbookOptions } from "@/modules/reports/components/report-export-options";
import type { ReportExportChoice } from "@/modules/reports/components/report-export-workbook";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UiAlert,
  UiButton,
  UiDialog,
  UiDrawer,
  UiTextField,
} from "@/shared/ui";
import {
  FilterOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  UndoOutlined,
} from "@/shared/components/icons";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { rowActivationProps } from "@/shared/components/data-display/row-activation";
import { ReportDateRangePicker } from "@/modules/reports/components/ReportDateRangePicker";
import { usePeriodFilter } from "../operations/report-period";
import { useReportExport } from "../operations/report-export";
import {
  usePackingLabelReport,
  usePackingLabelSnapshot,
  type PackingLabelEvent,
} from "./packing-label-api";
import { PackingLabelSnapshotScreen } from "./PackingLabelSnapshotScreen";
import {
  labelRows,
  printGate,
  printMetrics,
  snapshotMissing,
  snapshotPayload,
} from "./packing-label-view";
import {
  packingLabelFailureText,
  LABEL_SNAPSHOT_STATUS_LABELS,
} from "./packing-label-labels";
const AlignedOutboundDetailModal = lazy(() =>
  import("@/modules/outbound/components/AlignedOutboundDetailModal").then(
    (module) => ({ default: module.AlignedOutboundDetailModal }),
  ),
);
import {
  printLabelSnapshot,
  reprintLabelSnapshot,
} from "@/modules/outbound/services/mvpOutboundService";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import "./packing-label-report.css";

type Target = {
  labelId: string;
  labelCode: string;
  outboundNo: string;
  printerId?: string;
};
type PrintContext = Target & {
  documentId: string;
  version: number;
  action: "PRINT" | "REPRINT";
  attempts: number;
  eventIds: string[];
};
const resultText = (result: string, t: TranslateFn) =>
  result === "PRINTED"
    ? t("packingLabelReport.printSuccessful")
    : result === "PRINT_FAILED"
      ? t("packingLabelReport.printFailed")
      : t("packingLabelReport.undetermined");
export function PrintStatus({ result }: { result: string }) {
  const t = useT();
  return (
    <span
      className={
        "hn-pkg-label__status " +
        (result === "PRINTED"
          ? "is-success"
          : result === "PRINT_FAILED"
            ? "is-error"
            : "is-pending")
      }
    >
      <b />
      {resultText(result, t)}
    </span>
  );
}

export default function PackingLabelPrintReport() {
  const t = useT();
  const period = usePeriodFilter("this-month");
  const exporter = useReportExport();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((s) => s.permissionCodes);
  const superAdmin = useAuthStore((s) => s.isSuperAdmin);
  const canPrint = hasAnyWmsPermission(
    permissions,
    WMS_ACTION_PERMISSIONS.PACKING_LABEL_PRINT,
    superAdmin,
  );
  const canReprint = hasAnyWmsPermission(
    permissions,
    WMS_ACTION_PERMISSIONS.PACKING_LABEL_REPRINT,
    superAdmin,
  );
  const [view, setView] = useState<"events" | "labels">("events");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [printer, setPrinter] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [descending, setDescending] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [printContext, setPrintContext] = useState<PrintContext | null>(null);
  const [printerId, setPrinterId] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [uncertain, setUncertain] = useState<{
    labelId: string;
    previousIds: string[];
  } | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "error";
    text: (translate: TranslateFn) => string;
  } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const report = usePackingLabelReport({
    from: period.from,
    to: period.to,
    enabled: online,
  });
  const snapshot = usePackingLabelSnapshot(
    detailId,
    useMemo(
      () => ({
        labels: report.labels,
        printerNames: new Map(
          report.printerOptions.map((p) => [p.value, p.label]),
        ),
        actorNames: new Map(
          report.events
            .filter((e) => e.actorId)
            .map((e) => [e.actorId, e.actorName]),
        ),
      }),
      [report.labels, report.printerOptions, report.events],
    ),
  );
  const metrics = useMemo(
    () => printMetrics(report.labels, report.events),
    [report.labels, report.events],
  );
  const allLabels = useMemo(
    () => labelRows(report.labels, report.events),
    [report.labels, report.events],
  );
  const filteredEvents = useMemo(
    () =>
      report.events.filter((e) => {
        const label = report.labels.get(e.labelId);
        return (
          (!status || e.result === status) &&
          (!printer || e.printerId === printer) &&
          (!actor || e.actorId === actor) &&
          (!action || e.action === action) &&
          (!keyword.trim() ||
            [
              e.labelCode,
              e.outboundNo,
              e.recipient,
              e.printerName,
              e.actorName,
              label?.skuSummary,
            ]
              .join(" ")
              .toLocaleLowerCase("vi")
              .includes(keyword.trim().toLocaleLowerCase("vi")))
        );
      }),
    [report.events, report.labels, status, printer, actor, action, keyword],
  );
  const filteredLabels = allLabels.filter((row) => {
    if (status || printer || actor || action)
      return filteredEvents.some((e) => e.labelId === row.labelId);
    return (
      !keyword.trim() ||
      [
        row.label.labelCode,
        row.label.outboundNo,
        row.label.recipient,
        row.label.skuSummary,
        row.latest?.printerName,
        row.latest?.actorName,
      ]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(keyword.trim().toLocaleLowerCase("vi"))
    );
  });
  const rows = (
    view === "events"
      ? filteredEvents.map((e) => ({
          target: e as Target,
          label: report.labels.get(e.labelId),
          latest: e,
          total: e.attemptNo,
          key: e.eventId,
        }))
      : filteredLabels.map((r) => ({
          target: {
            labelId: r.labelId,
            labelCode: r.label.labelCode,
            outboundNo: r.label.outboundNo,
            printerId: r.latest?.printerId,
          },
          label: r.label,
          latest: r.latest,
          total: r.total,
          key: r.labelId,
        }))
  ).sort(
    (a, b) =>
      (descending ? -1 : 1) *
      (a.latest?.attemptedAt || a.label?.createdAt || "").localeCompare(
        b.latest?.attemptedAt || b.label?.createdAt || "",
      ),
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const filtered = Boolean(
    keyword ||
    status ||
    printer ||
    actor ||
    action ||
    !period.range[0].isSame(businessToday().startOf("month"), "day") ||
    !period.range[1].isSame(businessToday(), "day"),
  );
  const failure = !online || Boolean(report.error);
  const partial = Boolean(report.eventsError);
  const rate = metrics.total
    ? Math.round((metrics.printed / metrics.total) * 1000) / 10
    : 0;
  const selectedEvent =
    report.events.find((e) => e.eventId === eventId) ?? null;
  useEffect(() => {
    setPage(1);
  }, [
    view,
    keyword,
    status,
    printer,
    actor,
    action,
    pageSize,
    period.from,
    period.to,
  ]);
  const clear = () => {
    setKeyword("");
    setStatus("");
    setPrinter("");
    setActor("");
    setAction("");
    period.setRange([
      businessToday().startOf("month"),
      businessToday().endOf("day"),
    ]);
    setPage(1);
  };
  const refresh = () => {
    report.refetch();
    snapshot.refetch();
  };
  const openDetail = (target: Target, e: PackingLabelEvent | null) => {
    setDetailId(target.labelId);
    setEventId(e?.eventId ?? null);
    setPreview(false);
  };
  const closeDetail = () => {
    setDetailId(null);
    setEventId(null);
    setPreview(false);
  };
  const failureText = (e: PackingLabelEvent) =>
    packingLabelFailureText(e.reasonNote || e.errorCode || e.reasonCode, t);

  // Re-read only the chosen snapshot; historical attempt results never choose the mutation.
  const preparePrint = async (target: Target) => {
    if (actionLock.current || uncertain || !online) return;
    actionLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const raw = await http.get<Record<string, unknown>>(
        API_ENDPOINTS.LABEL_SNAPSHOT.replace(":id", target.labelId),
      );
      const payload = snapshotPayload(raw.label_payload);
      const attempts = Array.isArray(raw.print_events)
        ? (raw.print_events as Record<string, unknown>[])
        : [];
      const pending = attempts
        .filter((e) =>
          ["PENDING", "SENT", "PENDING_PRINT"].includes(String(e.status)),
        )
        .map(() => ({ result: "PENDING_PRINT" }) as PackingLabelEvent);
      const gate = printGate(
        String(raw.status),
        pending,
        snapshotMissing(payload, t),
        t,
      );
      if (!gate.action) {
        setNotice({
          tone: "warning",
          text: (translate) =>
            printGate(
              String(raw.status),
              pending,
              snapshotMissing(payload, translate),
              translate,
            ).reason,
        });
        void queryClient.invalidateQueries({
          queryKey: ["rpt-05", "label-snapshot", target.labelId],
        });
        openDetail(target, null);
        return;
      }
      if (!(gate.action === "REPRINT" ? canReprint : canPrint)) {
        setNotice({
          tone: "warning",
          text: (translate) =>
            translate("packingLabelReport.noPrintPermission"),
        });
        return;
      }
      const version = Number(raw.version);
      if (
        !raw.outbound_document_id ||
        raw.version == null ||
        !Number.isFinite(version)
      )
        throw new Error(t("packingLabelReport.missingVersion"));
      setPrintContext({
        ...target,
        documentId: String(raw.outbound_document_id),
        version,
        action: gate.action,
        attempts: attempts.length,
        eventIds: attempts.map((e) => String(e.id)),
      });
      setPrinterId(target.printerId || "");
      setReason("");
      setReasonError(false);
    } catch (error) {
      setNotice({
        tone: "error",
        text: (translate) =>
          error instanceof Error &&
          error.message === t("packingLabelReport.missingVersion")
            ? translate("packingLabelReport.missingVersion")
            : getApiErrorMessage(
                error,
                translate("packingLabelReport.loadSnapshotError"),
              ),
      });
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const submitPrint = async () => {
    if (!printContext || actionLock.current || !online || uncertain) return;
    if (!printerId || (printContext.action === "REPRINT" && !reason.trim())) {
      setReasonError(true);
      return;
    }
    if (!(printContext.action === "REPRINT" ? canReprint : canPrint)) return;
    actionLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const input = {
        documentId: printContext.documentId,
        labelId: printContext.labelId,
        printerConfigId: printerId,
        ifMatch: printContext.version,
        idempotencyKey:
          "rpt05-" +
          printContext.action.toLowerCase() +
          "-" +
          crypto.randomUUID(),
      };
      const response =
        printContext.action === "REPRINT"
          ? await reprintLabelSnapshot({ ...input, reason: reason.trim() })
          : await printLabelSnapshot(input);
      const result = String(response.status ?? response.result ?? "");
      setPrintContext(null);
      setNotice({
        tone:
          result === "PRINT_FAILED" || result === "FAILED"
            ? "error"
            : "success",
        text: (translate) =>
          result === "PRINTED"
            ? translate("packingLabelReport.printerConfirmed")
            : result === "PRINT_FAILED" || result === "FAILED"
              ? translate("packingLabelReport.printerFailed")
              : translate("packingLabelReport.printAccepted"),
      });
      report.refetch();
      await queryClient.invalidateQueries({
        queryKey: ["rpt-05", "label-snapshot", printContext.labelId],
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const httpStatus = (error as { response?: { status?: number } }).response
        ?.status;
      const message = error instanceof Error ? error.message : "";
      if (
        !navigator.onLine ||
        (httpStatus !== undefined && httpStatus >= 500) ||
        ["ECONNABORTED", "ERR_NETWORK", "ETIMEDOUT"].includes(code || "") ||
        /network|timeout|connection/i.test(message)
      ) {
        setUncertain({
          labelId: printContext.labelId,
          previousIds: printContext.eventIds,
        });
        setPrintContext(null);
        setNotice({
          tone: "warning",
          text: (translate) => translate("packingLabelReport.printUncertain"),
        });
      } else {
        setPrintContext(null);
        void queryClient.invalidateQueries({
          queryKey: ["rpt-05", "label-snapshot", printContext.labelId],
        });
        setNotice({
          tone: "error",
          text: (translate) =>
            getApiErrorMessage(
              error,
              translate("packingLabelReport.submitPrintError"),
            ),
        });
      }
      report.refetch();
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const reconcile = async () => {
    if (!uncertain || !online || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const raw = await http.get<Record<string, unknown>>(
        API_ENDPOINTS.LABEL_SNAPSHOT.replace(":id", uncertain.labelId),
      );
      const events = Array.isArray(raw.print_events)
        ? (raw.print_events as Record<string, unknown>[])
        : [];
      const latest = events
        .filter((e) => !uncertain.previousIds.includes(String(e.id)))
        .sort((a, b) =>
          String(b.requested_at ?? b.created_at).localeCompare(
            String(a.requested_at ?? a.created_at),
          ),
        )[0];
      if (
        !latest ||
        !["PRINTED", "FAILED", "PRINT_FAILED"].includes(String(latest.status))
      )
        setNotice({
          tone: "warning",
          text: (translate) => translate("packingLabelReport.noFinalResult"),
        });
      else {
        setUncertain(null);
        setNotice({
          tone: "success",
          text: (translate) => translate("packingLabelReport.reconciled"),
        });
        refresh();
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text: (translate) =>
          getApiErrorMessage(
            error,
            translate("packingLabelReport.reconcileError"),
          ),
      });
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const exportContext: [string, string][] = [
    [
      t("packingLabelReport.creationPeriod"),
      period.range[0].format("DD/MM/YYYY") +
        " – " +
        period.range[1].format("DD/MM/YYYY"),
    ],
    [t("packingLabelReport.scope"), t("packingLabelReport.exportScope")],
    [
      t("packingLabelReport.result"),
      status ? resultText(status, t) : t("packingLabelReport.all"),
    ],
    [
      t("packingLabelReport.printer"),
      report.printerOptions.find((p) => p.value === printer)?.label ||
        t("packingLabelReport.all"),
    ],
    [
      t("packingLabelReport.printedBy"),
      (report.actorOptions ?? []).find((p) => p.value === actor)?.label ||
        t("packingLabelReport.all"),
    ],
    [
      t("packingLabelReport.attemptType"),
      action
        ? action === "REPRINT"
          ? t("packingLabelReport.reprint")
          : t("packingLabelReport.firstPrintRetry")
        : t("packingLabelReport.all"),
    ],
    [
      t("packingLabelReport.keyword"),
      keyword.trim() || t("packingLabelReport.all"),
    ],
  ];
  const doExport = (choice: ReportExportChoice) => {
    return exporter.exportReport(choice.format, {
      workbook: reportWorkbookOptions(
        choice,
        ["Label Snapshot"],
        filteredLabels.map((row) => row.labelId),
        [...new Set(visibleRows.map((row) => row.target.labelId))],
        exportContext,
      ),
      reportCode: "label-log",
      fileStem: "bao-cao-nhan-dong-goi",
      fileSuffix: "-" + period.from + "-" + period.to,
      filters: {
        from_date: period.from,
        to_date: period.to,
        ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
        ...(status ? { status } : {}),
        ...(printer ? { printer_id: printer } : {}),
        ...(actor ? { actor_id: actor } : {}),
        ...(action ? { action } : {}),
      },
    });
  };

  return (
    <div className="hn-pkg-label" data-testid="rpt-tab-packing-label">
      <header className="hn-pkg-label__header">
        <div>
          <h1>{t("packingLabelReport.title")}</h1>
          <p>{t("packingLabelReport.subtitle")}</p>
        </div>
        <div className="hn-pkg-label__header-actions">
          <ReportExportAction
            title={t("packingLabelReport.exportTitle")}
            fileStem={
              t("packingLabelReport.exportFileStem") +
              period.from +
              "-" +
              period.to
            }
            total={filteredLabels.length}
            currentCount={
              new Set(visibleRows.map((row) => row.target.labelId)).size
            }
            formats={["xlsx", "pdf"]}
            sections={reportExportSections(
              t("packingLabelReport.exportSection"),
              "none",
            )}
            context={exportContext}
            disabled={
              failure ||
              report.loading ||
              Boolean(report.capped && (status || printer || actor || action))
            }
            disabledReason={
              report.capped
                ? t("packingLabelReport.exportIncomplete")
                : undefined
            }
            loading={Boolean(exporter.exporting)}
            onExport={doExport}
          />
        </div>
      </header>
      {notice && !detailId && (
        <div className="hn-pkg-label__notice" role="status">
          <UiAlert tone={notice.tone}>{notice.text(t)}</UiAlert>
          {uncertain && (
            <UiButton
              appearance="outlined"
              disabled={busy || !online}
              onClick={() => void reconcile()}
            >
              {t("packingLabelReport.checkStatus")}
            </UiButton>
          )}
        </div>
      )}
      {!online && (
        <UiAlert tone="warning">{t("packingLabelReport.offline")}</UiAlert>
      )}
      {!failure && (
        <>
          <section
            className="hn-pkg-label__kpis"
            aria-label={t("packingLabelReport.overview")}
          >
            {[
              {
                label: t("packingLabelReport.uniqueLabels"),
                value: metrics.labels,
                note: t("packingLabelReport.attemptsInPeriod", {
                  count: formatQuantity(metrics.total),
                }),
                icon: <PrinterOutlined />,
                tone: "blue",
              },
              {
                label: t("packingLabelReport.successfulAttempts"),
                value: metrics.printed,
                note: t("packingLabelReport.successRate", {
                  rate: formatQuantity(rate),
                }),
                icon: <CheckCircleOutlined />,
                tone: "green",
              },
              {
                label: t("packingLabelReport.failedAttempts"),
                value: metrics.failed,
                note: t("packingLabelReport.checkPrinter"),
                icon: <WarningOutlined />,
                tone: "red",
              },
              {
                label: t("packingLabelReport.reprintAttempts"),
                value: metrics.reprinted,
                note: t("packingLabelReport.keepContent"),
                icon: <UndoOutlined />,
                tone: "blue",
              },
            ].map((kpi) => (
              <article className="hn-pkg-label__kpi" key={kpi.label}>
                <span className={"hn-pkg-label__kpi-icon is-" + kpi.tone}>
                  {kpi.icon}
                </span>
                <div>
                  <span>{kpi.label}</span>
                  <strong>
                    {report.loading || partial || report.capped
                      ? "—"
                      : formatQuantity(kpi.value)}
                  </strong>
                  <small>{kpi.note}</small>
                </div>
              </article>
            ))}
          </section>
          {!report.loading && !partial && !report.capped && (
            <section
              className="hn-pkg-label__health"
              aria-label={t("packingLabelReport.printingStatus")}
            >
              <div className="hn-pkg-label__health-heading">
                <h2>{t("packingLabelReport.printingStatus")}</h2>
                <span>
                  {t("packingLabelReport.pendingAttempts", {
                    count: metrics.pending,
                  })}
                </span>
              </div>
              <div
                className="hn-pkg-label__bar"
                aria-label={t("packingLabelReport.statusSummary", {
                  printed: metrics.printed,
                  failed: metrics.failed,
                  pending: metrics.pending,
                })}
              >
                {metrics.total > 0 && (
                  <>
                    <span
                      style={{
                        width: (metrics.printed / metrics.total) * 100 + "%",
                      }}
                    />
                    <i
                      style={{
                        width: (metrics.failed / metrics.total) * 100 + "%",
                      }}
                    />
                    <b
                      style={{
                        width: (metrics.pending / metrics.total) * 100 + "%",
                      }}
                    />
                  </>
                )}
              </div>
              <div className="hn-pkg-label__legend">
                <span>
                  <b className="is-green-dot" />{" "}
                  {t("packingLabelReport.successfulCount", {
                    count: metrics.printed,
                  })}
                </span>
                <span>
                  <b className="is-red-dot" />{" "}
                  {t("packingLabelReport.failedCount", {
                    count: metrics.failed,
                  })}
                </span>
                <span>
                  <b className="is-pending-dot" />{" "}
                  {t("packingLabelReport.pendingCount", {
                    count: metrics.pending,
                  })}
                </span>
              </div>
            </section>
          )}
        </>
      )}
      <section
        className="hn-pkg-label__workspace"
        aria-label={t("packingLabelReport.workspace")}
      >
        <div
          className="hn-pkg-label__tabs"
          role="tablist"
          aria-label={t("packingLabelReport.dataScope")}
        >
          <button
            id="packing-events-tab"
            role="tab"
            aria-selected={view === "events"}
            aria-controls="packing-report-panel"
            onClick={() => setView("events")}
          >
            {t("packingLabelReport.attempts")}{" "}
            <span>{report.events.length}</span>
          </button>
          <button
            id="packing-labels-tab"
            role="tab"
            aria-selected={view === "labels"}
            aria-controls="packing-report-panel"
            onClick={() => setView("labels")}
          >
            {t("packingLabelReport.labels")} <span>{report.labels.size}</span>
          </button>
          <span className="hn-pkg-label__asof">
            {report.asOf
              ? t("packingLabelReport.latestAttempt", {
                  time: formatDateTime(report.asOf),
                })
              : t("packingLabelReport.noAttemptsInPeriod")}
          </span>
        </div>
        <div
          className="hn-pkg-label__filters"
          aria-label={t("packingLabelReport.filters")}
        >
          <SearchInput
            id="rpt-05-q"
            width="100%"
            value={keyword}
            placeholder={t("packingLabelReport.searchPlaceholder")}
            aria-label={t("packingLabelReport.searchLabel")}
            onChange={setKeyword}
          />
          <ReportDateRangePicker
            value={period.range}
            onChange={(range) => {
              if (range?.[0] && range?.[1])
                period.setRange([range[0], range[1]]);
            }}
          />
          <select
            aria-label={t("packingLabelReport.statusFilter")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("packingLabelReport.resultAll")}</option>
            <option value="PRINTED">
              {t("packingLabelReport.resultSuccessful")}
            </option>
            <option value="PRINT_FAILED">
              {t("packingLabelReport.resultFailed")}
            </option>
            <option value="PENDING_PRINT">
              {t("packingLabelReport.resultPending")}
            </option>
          </select>
          <select
            aria-label={t("packingLabelReport.printer")}
            value={printer}
            onChange={(e) => setPrinter(e.target.value)}
          >
            <option value="">{t("packingLabelReport.printerAll")}</option>
            {report.printerOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {t("packingLabelReport.printerOption", { name: p.label })}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="hn-pkg-label__more-filters"
            aria-expanded={filtersOpen}
            aria-controls="packing-label-extra-filters"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <FilterOutlined aria-hidden="true" />
            {t("packingLabelReport.filterButton")}
          </button>
          {filtered && (
            <UiButton appearance="outlined" onClick={clear}>
              {t("packingLabelReport.clearFilters")}
            </UiButton>
          )}
        </div>
        <div
          id="packing-label-extra-filters"
          className="hn-pkg-label__extra-filters"
          hidden={!filtersOpen}
        >
          <select
            aria-label={t("packingLabelReport.operator")}
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          >
            <option value="">{t("packingLabelReport.actorAll")}</option>
            {(report.actorOptions ?? []).map((p) => (
              <option key={p.value} value={p.value}>
                {t("packingLabelReport.actorOption", { name: p.label })}
              </option>
            ))}
          </select>
          <select
            aria-label={t("packingLabelReport.printAttemptType")}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">{t("packingLabelReport.actionAll")}</option>
            <option value="PRINT">{t("packingLabelReport.actionPrint")}</option>
            <option value="REPRINT">
              {t("packingLabelReport.actionReprint")}
            </option>
          </select>
        </div>
        <div className="hn-pkg-label__scope">
          <span>
            {t("packingLabelReport.periodCaption", {
              from: period.range[0].format("DD/MM/YYYY"),
              to: period.range[1].format("DD/MM/YYYY"),
            })}
          </span>
        </div>
        {report.capped && (
          <UiAlert tone="warning">
            {t("packingLabelReport.historyCapped")}
          </UiAlert>
        )}
        <div
          id="packing-report-panel"
          role="tabpanel"
          aria-labelledby={
            view === "events" ? "packing-events-tab" : "packing-labels-tab"
          }
        >
          {failure || (partial && view === "events") ? (
            <div className="hn-pkg-label__state" role="alert">
              <WarningOutlined />
              <h2>{t("packingLabelReport.historyError")}</h2>
              <p>
                {partial
                  ? t("packingLabelReport.partialHistory")
                  : t("packingLabelReport.retryHistory")}
              </p>
              <UiButton
                appearance="filled"
                onClick={refresh}
                disabled={!online}
              >
                {t("common.retry")}
              </UiButton>
            </div>
          ) : (
            <div className="hn-pkg-label__list">
              <div
                className="hn-pkg-label__table-wrap"
                tabIndex={0}
                role="region"
                aria-label={t("packingLabelReport.tableRegion")}
              >
                <table className="hn-pkg-label__table">
                  <colgroup>
                    {[6, 20, 28, 17, 17, 12].map((width, i) => (
                      <col key={i} style={{ width: width + "%" }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="is-center">#</th>
                      <th>{t("packingLabelReport.colLabelOutbound")}</th>
                      <th>{t("packingLabelReport.colSkuRecipient")}</th>
                      <th aria-sort={descending ? "descending" : "ascending"}>
                        <button onClick={() => setDescending(!descending)}>
                          {t("packingLabelReport.time")}{" "}
                          {descending ? "↓" : "↑"}
                        </button>
                      </th>
                      <th>{t("packingLabelReport.result")}</th>
                      <th>{t("packingLabelReport.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.loading ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="hn-pkg-label__state" role="status">
                            {t("packingLabelReport.loading")}
                          </div>
                        </td>
                      </tr>
                    ) : visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="hn-pkg-label__state">
                            <PrinterOutlined />
                            <h2>
                              {filtered
                                ? t("packingLabelReport.noMatches")
                                : view === "events"
                                  ? t("packingLabelReport.noAttemptsInPeriod")
                                  : t("packingLabelReport.noLabelsInPeriod")}
                            </h2>
                            <p>{t("packingLabelReport.emptyHint")}</p>
                            {filtered && (
                              <UiButton appearance="outlined" onClick={clear}>
                                {t("packingLabelReport.clearFilters")}
                              </UiButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map(
                        ({ target, label, latest, key }, index) => {
                          const currentAttempts = report.events.filter(
                            (e) => e.labelId === target.labelId,
                          );
                          const gate = printGate(
                            label?.status || "",
                            currentAttempts,
                          );
                          const allowed =
                            gate.action === "REPRINT" ? canReprint : canPrint;
                          return (
                            <tr
                              key={key}
                              {...rowActivationProps(() =>
                                openDetail(target, latest),
                              )}
                            >
                              <td className="is-center">
                                {(safePage - 1) * pageSize + index + 1}
                              </td>
                              <td>
                                <strong>{target.labelCode || "—"}</strong>
                                <span>{target.outboundNo || "—"}</span>
                              </td>
                              <td>
                                <strong>
                                  {label?.skuSummary ||
                                    t("packingLabelReport.noSku")}
                                </strong>
                                <span>
                                  {label?.recipient ||
                                    t("packingLabelReport.noRecipient")}
                                </span>
                              </td>
                              <td>
                                {latest?.attemptedAt
                                  ? formatDateTime(latest.attemptedAt)
                                  : t("packingLabelReport.noAttempts")}
                                <span>
                                  {latest
                                    ? latest.action === "REPRINT"
                                      ? t("packingLabelReport.reprint")
                                      : t("packingLabelReport.firstPrintRetry")
                                    : t(
                                        "packingLabelReport.awaitingFirstPrint",
                                      )}
                                </span>
                              </td>
                              <td>
                                {latest ? (
                                  <PrintStatus result={latest.result} />
                                ) : (
                                  <span className="hn-pkg-label__status is-neutral">
                                    {LABEL_SNAPSHOT_STATUS_LABELS[
                                      label?.status || ""
                                    ] || t("packingLabelReport.unprinted")}
                                  </span>
                                )}
                                {latest && failureText(latest) && (
                                  <span className="hn-pkg-label__reason">
                                    {failureText(latest)}
                                  </span>
                                )}
                              </td>
                              <td>
                                <RowActionGroup>
                                  <RowActionButton
                                    kind="view"
                                    aria-label={t(
                                      "packingLabelReport.viewDetails",
                                      { code: target.labelCode },
                                    )}
                                    onClick={() => openDetail(target, latest)}
                                  >
                                    {t("packingLabelReport.details")}
                                  </RowActionButton>
                                  {gate.action && allowed && (
                                    <RowActionButton
                                      kind="print"
                                      disabled={
                                        busy || Boolean(uncertain) || !online
                                      }
                                      onClick={() => void preparePrint(target)}
                                    >
                                      {gate.action === "REPRINT"
                                        ? t("packingLabelReport.reprint")
                                        : t("packingLabelReport.printLabel")}
                                    </RowActionButton>
                                  )}
                                  {!gate.action && (
                                    <small>
                                      {currentAttempts.some(
                                        (e) => e.result === "PENDING_PRINT",
                                      )
                                        ? t(
                                            "packingLabelReport.awaitingResponse",
                                          )
                                        : t("packingLabelReport.notReady")}
                                    </small>
                                  )}
                                </RowActionGroup>
                              </td>
                            </tr>
                          );
                        },
                      )
                    )}
                  </tbody>
                </table>
              </div>
              <div className="hn-pkg-label__list-footer">
                <div className="hn-pkg-label__page-info">
                  <span>
                    {t("packingLabelReport.rowsCaption", {
                      from: rows.length ? (safePage - 1) * pageSize + 1 : 0,
                      to: Math.min(safePage * pageSize, rows.length),
                      total: rows.length,
                      unit:
                        view === "events"
                          ? t("packingLabelReport.attemptUnit")
                          : t("packingLabelReport.labelUnit"),
                    })}
                  </span>
                  <label>
                    {t("packingLabelReport.rows")}{" "}
                    <select
                      aria-label={t("packingLabelReport.rowsPerPage")}
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                      {[10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {t("packingLabelReport.perPage", { count: n })}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <nav
                  className="hn-pkg-label__pagination"
                  aria-label={t("packingLabelReport.pagination")}
                >
                  <button
                    aria-label={t("packingLabelReport.previousPage")}
                    disabled={safePage === 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    ‹
                  </button>
                  <span>
                    {t("packingLabelReport.pageCaption", {
                      page: safePage,
                      total: totalPages,
                    })}
                  </span>
                  <button
                    aria-label={t("packingLabelReport.nextPage")}
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    ›
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
        <p className="hn-pkg-label__footnote">
          {t("packingLabelReport.footnote")}
        </p>
      </section>
      <UiDrawer
        slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
        open={Boolean(detailId)}
        width={820}
        onClose={closeDetail}
        title={
          <span className="hn-pkg-label__drawer-title">
            <span>
              {preview
                ? t("packingLabelReport.previewLabel")
                : t("packingLabelReport.detailTitle")}
            </span>
            <button
              aria-label={t("packingLabelReport.closeDetail")}
              onClick={closeDetail}
            >
              ×
            </button>
          </span>
        }
      >
        {notice && (
          <div className="hn-pkg-label__notice" role="status">
            <UiAlert tone={notice.tone}>{notice.text(t)}</UiAlert>
            {uncertain && (
              <UiButton
                appearance="outlined"
                disabled={busy || !online}
                onClick={() => void reconcile()}
              >
                {t("packingLabelReport.checkStatus")}
              </UiButton>
            )}
          </div>
        )}
        <PackingLabelSnapshotScreen
          detail={snapshot.detail}
          loading={snapshot.loading}
          error={snapshot.error}
          preview={preview}
          selectedEvent={selectedEvent}
          onBack={closeDetail}
          onPreview={() => setPreview(!preview)}
          onRetry={snapshot.refetch}
          onPrint={() => {
            if (snapshot.detail)
              void preparePrint({
                labelId: snapshot.detail.labelId,
                labelCode: snapshot.detail.labelCode,
                outboundNo: snapshot.detail.outboundNo,
                printerId: snapshot.detail.attempts[0]?.printerId,
              });
          }}
          onOpenSource={() => {
            if (snapshot.detail?.outboundDocumentId) {
              setSourceId(snapshot.detail.outboundDocumentId);
              closeDetail();
            }
          }}
          canPrint={canPrint}
          canReprint={canReprint}
          busy={busy || !online}
          locked={Boolean(uncertain)}
        />
      </UiDrawer>
      {sourceId && (
        <Suspense
          fallback={
            <UiAlert tone="info">
              {t("packingLabelReport.loadingOutbound")}
            </UiAlert>
          }
        >
          <AlignedOutboundDetailModal
            documentId={sourceId}
            onClose={() => setSourceId(null)}
            onChanged={refresh}
          />
        </Suspense>
      )}
      <UiDialog
        open={Boolean(printContext)}
        onClose={() => {
          if (!busy) setPrintContext(null);
        }}
        title={
          printContext?.action === "REPRINT"
            ? t("packingLabelReport.reprintLabel")
            : t("packingLabelReport.confirmPrint")
        }
        actions={
          <>
            <UiButton
              appearance="outlined"
              disabled={busy}
              onClick={() => setPrintContext(null)}
            >
              {t("packingLabelReport.cancel")}
            </UiButton>
            <UiButton
              appearance="filled"
              loading={busy}
              disabled={busy || !online || Boolean(uncertain)}
              onClick={() => void submitPrint()}
            >
              {printContext?.action === "REPRINT"
                ? t("packingLabelReport.confirmReprint")
                : t("packingLabelReport.confirmPrint")}
            </UiButton>
          </>
        }
      >
        <div className="hn-pkg-label__confirm">
          <strong>{printContext?.labelCode}</strong>
          <span>
            {t("packingLabelReport.outboundCaption", {
              number: printContext?.outboundNo ?? "",
            })}
          </span>
          <span>
            {t("packingLabelReport.attemptsRecorded", {
              count: printContext?.attempts ?? 0,
            })}
          </span>
        </div>
        {notice && notice.tone !== "success" && (
          <UiAlert tone={notice.tone}>{notice.text(t)}</UiAlert>
        )}
        <label className="hn-pkg-label__form-label">
          {t("packingLabelReport.printer")} *
          <select
            aria-label={t("packingLabelReport.commandPrinter")}
            value={printerId}
            disabled={busy}
            onChange={(e) => {
              setPrinterId(e.target.value);
              setReasonError(false);
            }}
          >
            <option value="">{t("packingLabelReport.choosePrinter")}</option>
            {report.printerOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {reasonError && !printerId && (
          <p role="alert" className="hn-pkg-label__error-text">
            {t("packingLabelReport.choosePrinterError")}
          </p>
        )}
        {printContext?.action === "REPRINT" && (
          <UiTextField
            fullWidth
            required
            multiline
            minRows={3}
            label={t("packingLabelReport.reprintReason")}
            value={reason}
            error={reasonError && !reason.trim()}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText={
              reasonError && !reason.trim()
                ? t("packingLabelReport.reasonRequired")
                : t("packingLabelReport.reasonHint")
            }
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(false);
            }}
          />
        )}
        <UiAlert tone="info">{t("packingLabelReport.confirmHint")}</UiAlert>
      </UiDialog>
    </div>
  );
}
