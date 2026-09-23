import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
/** RPT-08: SystemHNWeb presentation over the existing document-history snapshot. */
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import dayjs from "dayjs";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useAuthStore } from "@/shared/store/auth.store";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { fmt, presetRange } from "@/modules/reports/operations/report-format";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import { runReportExport } from "@/modules/reports/operations/report-export";
import { reportStatusLabel } from "@/modules/reports/operations/report-labels";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { useReportRangeAdvice } from "@/modules/reports/operations/report-coverage";
import { DOCUMENT_HISTORY_COVERAGE_PROBE } from "@/modules/reports/operations/report-probes";
import { ReportRangeAdviceBanner } from "@/modules/reports/operations/ReportRangeAdviceBanner";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { IoIcon } from "./io-history-icons";
import {
  IO_HISTORY_EXPORT_CODE,
  IO_HISTORY_STATUS,
  ISO_DATE,
  useIoHistorySnapshot,
  type IoDocType,
  type IoHistoryRow,
  type IoTypeFilter,
} from "./io-history-api";
import { IoHistoryOverview } from "./IoHistoryOverview";
import {
  IoHistoryFeedback,
  IoHistorySkeleton,
  IoHistoryTableState,
  type IoHistoryFeedbackState,
} from "./IoHistoryFeedback";
import { UiDialog, UiSelect, UiVuexyDateRangePicker } from "@/shared/ui";
import { useTabView } from "@/shared/ui/use-tab-view";
import { useT } from "@/shared/i18n/useT";
import { useReducedMotion } from "@/shared/components/motion/useReducedMotion";
import "./io-history-report.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

type ViewMode = "table" | "slice";
const PAGE_SIZE = 5;
function signed(value: number): string {
  return (value >= 0 ? "+" : "−") + fmt(Math.abs(value));
}
function signedOrEmpty(value: number | null): string {
  return value === null ? EMPTY_TEXT : signed(value);
}
function absOrEmpty(value: number | null): string {
  return value === null ? EMPTY_TEXT : fmt(Math.abs(value));
}
function fmtDay(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : EMPTY_TEXT;
}
function fmtStamp(value: string): string {
  const parsed = dayjs(value);
  return !value || !parsed.isValid()
    ? EMPTY_TEXT
    : parsed.format(value.length <= 10 ? "DD/MM/YYYY" : "DD/MM/YYYY HH:mm");
}
function toneOf(type: IoDocType): string {
  return type === "INBOUND" ? "ok" : type === "OUTBOUND" ? "warn" : "info";
}
function movementLabelOf(row: IoHistoryRow): string {
  return row.movementCount === 0
    ? EMPTY_TEXT
    : row.movementCount === 1
      ? row.movementNo || EMPTY_TEXT
      : fmt(row.movementCount) + " movement";
}
function sumQty(rows: IoHistoryRow[]): number {
  return rows.reduce((total, row) => total + (row.qty ?? 0), 0);
}
function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const response = "response" in error ? error.response : undefined;
  return response && typeof response === "object" && "status" in response
    ? Number(response.status)
    : undefined;
}

export default function IoHistoryReport() {
  const t = useT();
  const typeLabels = useMemo<Readonly<Record<IoDocType, string>>>(
    () => ({
      INBOUND: t("reports.ioHistory.typeInbound"),
      OUTBOUND: t("reports.ioHistory.typeOutbound"),
      REVERSAL: t("reports.ioHistory.typeReversal"),
    }),
    [t],
  );
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const currentContext = useAuthStore((s) => s.currentContext);
  const warehouseName =
    currentContext?.warehouse_name || tUi("updatedUi.text_48d0d4a0911f");
  const canExport = hasAnyWmsPermission(
    permissionCodes,
    WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
    isSuperAdmin,
  );
  const [range, setRange] = useState(() => {
    const [start, end] = presetRange("this-month");
    return { from: start.format(ISO_DATE), to: end.format(ISO_DATE) };
  });
  const [type, setType] = useState<IoTypeFilter>("");
  const [query, setQuery] = useState("");
  const [dateError, setDateError] = useState(false);
  const [filterVisible, setFilterVisible] = useState(true);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const drillOpenRef = useRef(false);
  const openDrill = (id: string) => {
    drillOpenRef.current = true;
    setDrillId(id);
    setDrillOpen(true);
  };
  const closeDrill = () => {
    drillOpenRef.current = false;
    setDrillOpen(false);
  };
  const [page, setPage] = useState(1);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    state: IoHistoryFeedbackState;
    message?: string;
  } | null>(null);
  const [dismissedStale, setDismissedStale] = useState<string | null>(null);
  const [lastFormat, setLastFormat] = useState<"xlsx" | "pdf">("xlsx");
  const exportingRef = useRef(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLElement>(null);
  const viewTab = useTabView<ViewMode>("table");
  const view = viewTab.view;
  const shownView = viewTab.shown;
  const deferredView = useDeferredValue(view);
  const { snapshot, loading, fetching, error, refetch } = useIoHistorySnapshot({
    from: range.from,
    to: range.to,
    type,
  });
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return snapshot.rows.filter((row) => {
      const day = row.postedAt.slice(0, 10);
      return (
        day >= range.from &&
        day <= range.to &&
        (type === "" || row.type === type) &&
        (needle === "" ||
          [row.documentNo, row.actor, row.party, movementLabelOf(row)]
            .join(" ")
            .toLocaleLowerCase("vi")
            .includes(needle))
      );
    });
  }, [snapshot.rows, range.from, range.to, type, query]);
  const actorOptions = useMemo(
    () => optionsFromRows(snapshot.rows, (row) => row.actor),
    [snapshot.rows],
  );
  const dataDays = useMemo(
    () => snapshot.rows.map((row) => row.postedAt.slice(0, 10)),
    [snapshot.rows],
  );
  const rangeAdvice = useReportRangeAdvice({
    from: range.from,
    to: range.to,
    dataDays,
    loading,
    probe: DOCUMENT_HISTORY_COVERAGE_PROBE,
  });
  // ── Lát cắt đối soát (hàm `slices()` của mockup) ───────────────────────
  const reversalsOf = useMemo(() => {
    const map = new Map<string, IoHistoryRow[]>();
    for (const row of rows) {
      if (row.type !== "REVERSAL" || row.originalDocumentNo === "") continue;
      const bucket = map.get(row.originalDocumentNo) ?? [];
      bucket.push(row);
      map.set(row.originalDocumentNo, bucket);
    }
    return map;
  }, [rows]);

  /**
   * Bộ lọc RIÊNG của khối "Lịch sử chứng từ đã ghi nhận".
   *
   * Bộ lọc đầu trang dựng lại cả KPI, biểu đồ và snapshot; ở đây người đọc chỉ
   * cần khoanh đúng danh sách chứng từ đang soi trong CÙNG lát cắt đã chốt —
   * nên phép lọc này dừng lại trong khối và KHÔNG đụng số liệu phía trên.
   *
   * Áp cho CẢ "Dạng ngang" lẫn "Dạng hộp": hai chế độ là hai cách vẽ của cùng
   * một tập chứng từ, lọc lệch nhau sẽ thành hai sự thật.
   */
  const documentFilterConfig = useMemo<SectionFilterConfig<IoHistoryRow>>(
    () => ({
      searchPlaceholder: t("reports.ioHistory.searchPlaceholder"),
      searchText: (row) => [
        row.documentNo,
        row.party,
        row.actor,
        row.department,
        row.movementNo,
        row.originalDocumentNo,
        row.skuLines.join(" "),
      ],
      selects: [
        {
          key: "type",
          placeholder: t("reports.ioHistory.anyDocType"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.type,
              (value) => typeLabels[value as IoDocType] ?? value,
            ),
          match: (row, value) => row.type === value,
          minWidth: 185,
        },
        {
          key: "department",
          placeholder: t("reports.ioHistory.anyDepartment"),
          options: (list) => optionsFromRows(list, (row) => row.department),
          match: (row, value) => row.department === value,
          minWidth: 175,
        },
        {
          key: "actor",
          placeholder: t("reports.ioHistory.anyActor"),
          options: (list) => optionsFromRows(list, (row) => row.actor),
          match: (row, value) => row.actor === value,
          minWidth: 195,
        },
      ],
    }),
    [t, typeLabels],
  );
  const documentFilter = useSectionFilter(rows, documentFilterConfig);

  const slices = useMemo(
    () =>
      documentFilter.rows
        .filter((row) => row.type !== "REVERSAL")
        .map((row) => {
          const linked = reversalsOf.get(row.documentNo) ?? [];
          return {
            row,
            linked,
            reversalQty: linked.reduce(
              (total, item) => total + Math.abs(item.qty ?? 0),
              0,
            ),
            net: row.qty === null ? null : row.qty + sumQty(linked),
          };
        }),
    [documentFilter.rows, reversalsOf],
  );

  // ── Hộp thoại chi tiết (hàm `dialog()` của mockup) ─────────────────────
  const drill = useMemo(() => {
    if (drillId === null) return null;
    const row = snapshot.rows.find((item) => item.id === drillId);
    if (row === undefined) return null;
    const source =
      row.type === "REVERSAL" && row.originalDocumentNo !== ""
        ? (snapshot.rows.find(
            (item) => item.documentNo === row.originalDocumentNo,
          ) ?? row)
        : row;
    const linked = snapshot.rows.filter(
      (item) =>
        item.type === "REVERSAL" &&
        item.originalDocumentNo !== "" &&
        item.originalDocumentNo === source.documentNo,
    );
    return {
      row,
      source,
      linked,
      reversalQty: linked.reduce(
        (total, item) => total + Math.abs(item.qty ?? 0),
        0,
      ),
      net: source.qty === null ? null : source.qty + sumQty(linked),
    };
  }, [drillId, snapshot.rows]);

  const resetFilters = useCallback(() => {
    const [start, end] = presetRange("this-month");
    setRange({ from: start.format(ISO_DATE), to: end.format(ISO_DATE) });
    setType("");
    setQuery("");
    setDateError(false);
    setPage(1);
  }, []);
  const { refreshing, refresh: resetAll } = useReportRefresh({
    refetch,
    readError: () => error,
    beforeRefetch: resetFilters,
  });
  const { refreshing: applying, refresh: applyFilters } = useReportRefresh({
    refetch,
    readError: () => error,
  });
  const busy = refreshing || applying || fetching;
  const tableTabRef = useRef<HTMLButtonElement>(null);
  const sliceTabRef = useRef<HTMLButtonElement>(null);
  const switchView = (next: ViewMode) => {
    viewTab.select(next);
    if (next === "slice") setFilterVisible(false);
  };
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = view === "table" ? "slice" : "table";
    switchView(next);
    (next === "table" ? tableTabRef : sliceTabRef).current?.focus();
  };
  useEffect(() => {
    const onOnline = () => setOnline(true),
      onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const onPointer = (event: PointerEvent) => {
      if (!exportRef.current?.contains(event.target as Node))
        setExportMenu(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (exportRef.current?.contains(document.activeElement)) {
          exportRef.current
            .querySelector<HTMLButtonElement>(".io-export-trigger")
            ?.focus();
        }
        setExportMenu(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    if (exportMenu)
      exportRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus();
  }, [exportMenu]);
  // Keep pagination a view over the complete snapshot; KPI/export queries never receive page parameters.
  const pageKey = [
    range.from,
    range.to,
    type,
    query,
    documentFilter.keyword,
    JSON.stringify(documentFilter.values),
  ].join("|");
  const [previousPageKey, setPreviousPageKey] = useState(pageKey);
  if (previousPageKey !== pageKey) {
    setPreviousPageKey(pageKey);
    setPage(1);
  }
  const pageCount = Math.max(
    1,
    Math.ceil(documentFilter.rows.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const firstRow = (currentPage - 1) * PAGE_SIZE;
  const pageRows = documentFilter.rows.slice(firstRow, firstRow + PAGE_SIZE);
  const pageNumbers = Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]),
  )
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);
  const openDateFilter = () => {
    setFilterVisible(true);
    requestAnimationFrame(() =>
      filterRef.current
        ?.querySelector<HTMLButtonElement>('[data-date-field="from"]')
        ?.click(),
    );
  };
  const runExport = async (format: "xlsx" | "pdf") => {
    if (!canExport || exportingRef.current || !online) return;
    exportingRef.current = true;
    setExporting(format);
    setExportMenu(false);
    setExportFeedback(null);
    setLastFormat(format);
    try {
      await runReportExport(format, {
        reportCode: IO_HISTORY_EXPORT_CODE,
        fileStem: "lich-su-nhap-xuat-kho",
        fileSuffix: "-" + range.from + "-" + range.to,
        filters: {
          from_date: range.from,
          to_date: range.to,
          doc_type:
            type === "INBOUND"
              ? "inbound"
              : type === "OUTBOUND"
                ? "outbound"
                : "all",
          status: IO_HISTORY_STATUS,
          ...(query.trim() === "" ? {} : { keyword: query.trim() }),
        },
      });
      setExportFeedback({ state: "export-success" });
    } catch (cause) {
      const message = getApiErrorMessage(cause);
      const code =
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : "";
      const uncertain =
        /timeout|timed out|quá thời gian|chưa hoàn tất|chưa hoàn thành|chờ quá|đang xử lý lâu hơn|taking longer/i.test(
          message,
        ) ||
        ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"].includes(code) ||
        !navigator.onLine;
      setExportFeedback({
        state: uncertain ? "export-unknown" : "export-error",
        message,
      });
    } finally {
      exportingRef.current = false;
      setExporting(null);
    }
  };
  const status = errorStatus(error);
  // A failure in a supplementary source must not hide successfully loaded documents.
  const fatalState: IoHistoryFeedbackState | null =
    status === 401
      ? "session-expired"
      : snapshot.rows.length > 0
        ? null
        : !online
          ? "offline"
          : status === 403
            ? "forbidden"
            : status === 404
              ? "not-found"
              : status !== undefined && status >= 500
                ? "server-error"
                : error
                  ? "load-error"
                  : null;
  const staleKey = error
    ? String(status) + "|" + getApiErrorMessage(error) + "|" + snapshot.dataAsOf
    : !online
      ? "offline|" + snapshot.dataAsOf
      : null;
  const retryReport = () => {
    setDismissedStale(null);
    applyFilters();
  };
  const filteredEmpty = rows.length === 0 && query.trim() !== "";
  const clearSearch = () => {
    documentFilter.clear();
    setQuery("");
    setPage(1);
  };
  const goHome = () => window.location.assign("/dashboard?screen=MAP-01");
  const fullError = fatalState !== null;
  const compactHeader =
    fullError &&
    ["forbidden", "not-found", "server-error", "maintenance"].includes(
      fatalState,
    );
  return (
    <div className="hn-rpt-io" data-mvp-screen="RPT-08">
      <div className="content page-wrap">
        {!compactHeader && (
          <header className="io-page-heading">
            <div className="io-heading-copy">
              <nav
                className="breadcrumb"
                aria-label={t("reports.ioHistory.breadcrumbAria")}
              >
                <span>⌂ {t("reports.ioHistory.breadcrumbReports")}</span>
                <span aria-hidden="true">/</span>
                <span>{tUi("updatedUi.text_8814615e6de0")}</span>
              </nav>
              <h1 className="hn-report-page-title">
                {tUi("updatedUi.text_cedbc7cfb228")}
              </h1>
              <p>{tUi("updatedUi.text_5c09481fb555")}</p>
            </div>
            <div className="io-heading-actions">
              <span
                className="io-source"
                title={t("reports.ioHistory.metaAsOf", {
                  time: fmtStamp(snapshot.dataAsOf),
                })}
              >
                <IoIcon name="info" />
                {tUi("updatedUi.text_098cc1b3c5b9")}
              </span>
              <details className="io-warehouse-info">
                <summary>
                  <IoIcon name="warehouse" />
                  <span>
                    <b>{warehouseName}</b>
                    <small>{tUi("updatedUi.text_41cb6f85fb3a")}</small>
                  </span>
                  <IoIcon name="chevron" />
                </summary>
                <div className="io-warehouse-popover">
                  <b>{warehouseName}</b>
                  <p>
                    {currentContext?.role_name ||
                      t("reports.ioHistory.postedOnly")}
                  </p>
                  <small>{tUi("updatedUi.text_88e88d358418")}</small>
                </div>
              </details>
              <div className="io-export" ref={exportRef}>
                {canExport ? (
                  <button
                    className="btn io-export-trigger"
                    disabled={
                      loading ||
                      fullError ||
                      busy ||
                      !online ||
                      exporting !== null ||
                      exportFeedback?.state === "export-unknown"
                    }
                    aria-expanded={exportMenu}
                    aria-haspopup="menu"
                    aria-controls={exportMenu ? "rptio-export-menu" : undefined}
                    onClick={() => setExportMenu(!exportMenu)}
                  >
                    <span
                      className={exporting ? "refresh-icon is-spinning" : ""}
                    >
                      <IoIcon name={exporting ? "refresh" : "download"} />
                    </span>
                    {exporting
                      ? tUi("updatedUi.text_f218a6c991e2")
                      : tUi("reports.traceability.exportReport")}
                  </button>
                ) : (
                  <span
                    className="io-readonly"
                    title={t("reports.ioHistory.exportDenied")}
                  >
                    <IoIcon name="lock" />
                    {tUi("masterData.common.viewOnly")}
                  </span>
                )}
                {exportMenu && (
                  <div
                    id="rptio-export-menu"
                    className="io-export-menu"
                    role="menu"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        setExportMenu(false);
                        requestAnimationFrame(() =>
                          exportRef.current
                            ?.querySelector<HTMLButtonElement>(
                              ".io-export-trigger",
                            )
                            ?.focus(),
                        );
                        return;
                      }
                      const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
                      if (!keys.includes(event.key)) return;
                      event.preventDefault();
                      const items = Array.from(
                        event.currentTarget.querySelectorAll<HTMLButtonElement>(
                          '[role="menuitem"]',
                        ),
                      );
                      const index = items.indexOf(
                        document.activeElement as HTMLButtonElement,
                      );
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? items.length - 1
                            : (index +
                                (event.key === "ArrowDown" ? 1 : -1) +
                                items.length) %
                              items.length;
                      items[next]?.focus();
                    }}
                    aria-label={tUi("reports.traceability.exportReport")}
                  >
                    {documentFilter.active && (
                      <p className="io-export-scope">
                        {tUi("updatedUi.text_e47a1498d48d")}
                      </p>
                    )}
                    <button
                      role="menuitem"
                      onClick={() => void runExport("xlsx")}
                    >
                      <IoIcon name="file" />
                      {t("reports.ioHistory.exportXlsx")}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => void runExport("pdf")}
                    >
                      <IoIcon name="file" />
                      {t("reports.ioHistory.exportPdf")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}
        {fullError ? (
          <IoHistoryFeedback
            state={fatalState}
            message={error ? getApiErrorMessage(error) : undefined}
            onRetry={retryReport}
            busy={busy}
            onHome={goHome}
            onLogin={() => window.location.assign("/login")}
          />
        ) : (
          <>
            {loading ? (
              <IoHistorySkeleton includeFilters />
            ) : (
              <>
                {filterVisible ? (
                  <section
                    ref={filterRef}
                    className="card filters"
                    aria-label={t("reports.ioHistory.filterAria")}
                  >
                    <div className="io-filter-fields">
                      <div
                        className={
                          dateError
                            ? "field io-range-field is-invalid"
                            : "field io-range-field"
                        }
                      >
                        <label>
                          {tUi("reports.packingLabel.dateRangeLabel")}
                        </label>
                        <UiVuexyDateRangePicker
                          aria-label={t("reports.ioHistory.fieldDateRange")}
                          value={[dayjs(range.from), dayjs(range.to)]}
                          format="DD/MM/YYYY"
                          allowClear={false}
                          maxDate={dayjs()}
                          presets={periodPresets}
                          className="hn-rpt-io-date-range"
                          popupClassName="hn-rpt-io-date-popup"
                          onChange={(value) => {
                            if (
                              !value?.[0] ||
                              !value[1] ||
                              value[0].isAfter(value[1], "day")
                            ) {
                              setDateError(true);
                              return;
                            }
                            setDateError(false);
                            setRange({
                              from: value[0].format(ISO_DATE),
                              to: value[1].format(ISO_DATE),
                            });
                          }}
                        />
                        {dateError && (
                          <small className="io-field-error" role="alert">
                            {tUi("dashboard.dateError.order")}
                          </small>
                        )}
                      </div>
                      <div className="field">
                        <label htmlFor="rptio-warehouse">
                          {tUi("updatedUi.text_19c608bfa103")}
                        </label>
                        <div className="io-select-wrap io-warehouse-field">
                          <IoIcon name="warehouse" />
                          <input
                            id="rptio-warehouse"
                            readOnly
                            value={warehouseName}
                            title={tUi("updatedUi.text_021e3ee2db52")}
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="rptio-type">
                          {tUi("updatedUi.text_94c1cbc6d405")}
                        </label>
                        <div className="io-combobox">
                          <IoIcon name="swap" />
                          <UiSelect
                            id="rptio-type"
                            aria-label={t("reports.ioHistory.fieldDocType")}
                            value={type}
                            onChange={(value) => setType(value as IoTypeFilter)}
                            options={[
                              {
                                value: "",
                                label: tUi("dashboard.operations.filterAll"),
                              },
                              ...(
                                ["INBOUND", "OUTBOUND", "REVERSAL"] as const
                              ).map((value) => ({
                                value,
                                label: typeLabels[value],
                              })),
                            ]}
                            fullWidth
                            displayEmpty
                            searchable={false}
                            menuClassName="hn-rpt-io-select-menu"
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="rptio-actor">
                          {tUi("inventory.trace.colPerformedBy")}
                        </label>
                        <div className="io-combobox">
                          <IoIcon name="user" />
                          <UiSelect
                            id="rptio-actor"
                            aria-label={tUi("inventory.trace.colPerformedBy")}
                            value={documentFilter.values.actor ?? ""}
                            onChange={(value) =>
                              documentFilter.setValue("actor", value)
                            }
                            options={[
                              {
                                value: "",
                                label: tUi("dashboard.operations.filterAll"),
                              },
                              ...actorOptions,
                            ]}
                            fullWidth
                            displayEmpty
                            searchable={false}
                            menuClassName="hn-rpt-io-select-menu"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="io-period-note">
                      {periodPresets.find((p) => {
                        const [a, b] = p.range();
                        return (
                          a.format(ISO_DATE) === range.from &&
                          b.format(ISO_DATE) === range.to
                        );
                      })?.label || tUi("updatedUi.text_08cf5b3c1847")}{" "}
                      {tUi("updatedUi.text_b8076e3b0c7b")}
                      {documentFilter.values.actor && (
                        <span className="io-actor-scope">
                          {" "}
                          {tUi("updatedUi.text_82869b6aa7ff")}
                        </span>
                      )}
                    </p>
                    <div className="io-filter-actions">
                      <button
                        className="btn io-apply"
                        disabled={busy || dateError}
                        aria-busy={applying}
                        onClick={retryReport}
                      >
                        {applying && (
                          <span className="refresh-icon is-spinning">
                            <IoIcon name="refresh" />
                          </span>
                        )}
                        {tUi("dashboard.snapshot.apply")}
                      </button>
                      <button
                        className="btn io-reset"
                        disabled={busy}
                        aria-busy={refreshing}
                        onClick={resetAll}
                      >
                        {refreshing && (
                          <span className="refresh-icon is-spinning">
                            <IoIcon name="refresh" />
                          </span>
                        )}
                        {refreshing
                          ? t("reports.ioHistory.resetting")
                          : t("reports.ioHistory.reset")}
                      </button>
                    </div>
                  </section>
                ) : (
                  <div className="card collapsed">
                    <div className="summary">
                      <b>{t("reports.ioHistory.collapsedTitle")}</b>
                      <span>
                        {fmtDay(range.from)} – {fmtDay(range.to)} ·{" "}
                        {type
                          ? typeLabels[type]
                          : tUi("dashboard.operations.filterAll")}
                      </span>
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() => setFilterVisible(true)}
                    >
                      <IoIcon name="search" />
                      {t("reports.ioHistory.showFilters")}
                    </button>
                  </div>
                )}
                {staleKey && dismissedStale !== staleKey && (
                  <IoHistoryFeedback
                    state="stale"
                    updatedAt={fmtStamp(snapshot.dataAsOf)}
                    message={
                      !online ? tUi("updatedUi.text_f152a05815cc") : undefined
                    }
                    onRetry={retryReport}
                    onDismiss={() => setDismissedStale(staleKey)}
                    busy={busy}
                  />
                )}
                {busy && !error && <IoHistoryFeedback state="refreshing" />}
                {exportFeedback && (
                  <IoHistoryFeedback
                    state={exportFeedback.state}
                    message={exportFeedback.message}
                    onDismiss={() => setExportFeedback(null)}
                    onRetry={
                      exportFeedback.state === "export-error"
                        ? () => void runExport(lastFormat)
                        : undefined
                    }
                    busy={exporting !== null}
                  />
                )}
                <ReportRangeAdviceBanner
                  advice={rangeAdvice}
                  onApply={(next) => setRange({ from: next.from, to: next.to })}
                />
                <IoHistoryOverview
                  rows={rows}
                  stale={Boolean(staleKey)}
                  from={range.from}
                  to={range.to}
                />
                <section
                  className="card io-history-card"
                  aria-label={tUi("updatedUi.text_8814615e6de0")}
                >
                  <div className="io-table-heading">
                    <h2>
                      {tUi("updatedUi.text_8814615e6de0")}{" "}
                      <span className="io-count">
                        {fmt(documentFilter.rows.length)}
                        {documentFilter.active
                          ? " " + tUi("updatedUi.text_e48337fc9b4f")
                          : ""}
                      </span>
                    </h2>
                    <div className="io-table-search">
                      <IoIcon name="search" />
                      <input
                        aria-label={t("reports.filters.sectionSearchAria", {
                          label: t("reports.ioHistory.detailTitle"),
                        })}
                        placeholder={tUi("updatedUi.text_886568aaba24")}
                        value={documentFilter.keyword}
                        onChange={(e) =>
                          documentFilter.setKeyword(e.target.value)
                        }
                      />
                      {documentFilter.keyword && (
                        <button
                          aria-label={tUi("updatedUi.text_816c89e8e46b")}
                          onClick={() => documentFilter.setKeyword("")}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <details className="io-additional-controls">
                    <summary>
                      <IoIcon name="list" />
                      {tUi("updatedUi.text_b9d7167dd282")}
                      {documentFilter.active && (
                        <span className="io-count">
                          {tUi("updatedUi.text_e9b3b4cc12ad")}
                        </span>
                      )}
                    </summary>
                    <div className="io-additional-body">
                      <div
                        className="tabs"
                        role="tablist"
                        aria-label={t("reports.ioHistory.tabsAria")}
                        onKeyDown={onTabKeyDown}
                      >
                        <button
                          ref={tableTabRef}
                          id="rptio-tab-table"
                          className="tab"
                          role="tab"
                          aria-selected={shownView === "table"}
                          aria-controls="rptio-panel-table"
                          onClick={() => switchView("table")}
                        >
                          <IoIcon name="list" />
                          {t("reports.ioHistory.viewTable")}
                        </button>
                        <button
                          ref={sliceTabRef}
                          id="rptio-tab-slice"
                          className="tab"
                          role="tab"
                          aria-selected={shownView === "slice"}
                          aria-controls="rptio-panel-slice"
                          onClick={() => switchView("slice")}
                        >
                          <IoIcon name="grid-2x2-plus" />
                          {t("reports.ioHistory.viewSlice")}
                        </button>
                      </div>
                      <div className="io-global-search">
                        <label htmlFor="rptio-query">
                          {t("reports.ioHistory.fieldQuickSearch")}
                        </label>
                        <div className="control">
                          <IoIcon name="search" />
                          <input
                            id="rptio-query"
                            aria-label={t("reports.ioHistory.quickSearchAria")}
                            placeholder={t(
                              "reports.ioHistory.quickSearchPlaceholder",
                            )}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </div>
                      </div>
                      <SectionFilterBar
                        state={documentFilter}
                        label={t("reports.ioHistory.detailTitle")}
                        unit={t("reports.ioHistory.tableUnit")}
                        showCount={false}
                        data-testid="rptio-document-section-filter"
                      />
                    </div>
                  </details>
                  {deferredView === "table" ? (
                    <section
                      id="rptio-panel-table"
                      role="tabpanel"
                      aria-labelledby="rptio-tab-table"
                      data-report-view-panel="table"
                    >
                      <div className="scroll">
                        <table className="io-history-table">
                          <thead>
                            <tr>
                              <th>
                                <span className="io-desktop-label">
                                  {tUi("inventory.movement.colTime")}
                                </span>
                                <span className="io-tablet-label">
                                  {tUi("updatedUi.text_5a3a1b69c2b3")}
                                </span>
                              </th>
                              <th>{tUi("inventory.detail.colType")}</th>
                              <th className="io-document-column">
                                {tUi("warranty.componentList.colCode")}
                              </th>
                              <th>{tUi("audit.colObject")}</th>
                              <th className="qty">
                                {tUi("dashboard.stockMix.colQuantity")}
                              </th>
                              <th>{tUi("inventory.trace.colPerformedBy")}</th>
                              <th>{tUi("reports.importMatchReport.detail")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((row) => (
                              <tr key={row.id} data-drill-key={row.id}>
                                <td>
                                  <time dateTime={row.postedAt}>
                                    {fmtStamp(row.postedAt)}
                                  </time>
                                  <b className="io-tablet-label">
                                    {row.documentNo || EMPTY_TEXT}
                                  </b>
                                </td>
                                <td>
                                  <span className={"type " + toneOf(row.type)}>
                                    {typeLabels[row.type]}
                                  </span>
                                </td>
                                <td className="io-document-column">
                                  <b title={row.documentNo}>
                                    {row.documentNo || EMPTY_TEXT}
                                  </b>
                                </td>
                                <td>
                                  <div
                                    className="cell io-object"
                                    title={[...row.skuLines, row.party]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  >
                                    {row.skuLines.length > 0 && (
                                      <span>{row.skuLines.join(" · ")}</span>
                                    )}
                                    <span>{row.party || EMPTY_TEXT}</span>
                                  </div>
                                </td>
                                <td className="qty">
                                  <span title={t("reports.ioHistory.colQty")}>
                                    {signedOrEmpty(row.qty)}
                                  </span>
                                </td>
                                <td>
                                  <span className="cell" title={row.actor}>
                                    {row.actor || EMPTY_TEXT}
                                  </span>
                                </td>
                                <td>
                                  <RowActionGroup>
                                    <RowActionButton
                                      kind="view"
                                      onClick={() => openDrill(row.id)}
                                    >
                                      {t("reports.ioHistory.view")}
                                    </RowActionButton>
                                  </RowActionGroup>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {pageRows.length === 0 && (
                        <IoHistoryTableState
                          state={
                            documentFilter.active || filteredEmpty
                              ? "no-results"
                              : "empty"
                          }
                          onReset={
                            documentFilter.active || filteredEmpty
                              ? clearSearch
                              : openDateFilter
                          }
                        />
                      )}
                      <footer className="tfoot hn-report-pagination-footer">
                        <span>
                          {tUi("putaway.queue.showing")}{" "}
                          {documentFilter.rows.length ? firstRow + 1 : 0}–
                          {Math.min(
                            firstRow + PAGE_SIZE,
                            documentFilter.rows.length,
                          )}{" "}
                          / {fmt(documentFilter.rows.length)}
                          {" " + tUi("updatedUi.text_74e542e35044")}
                        </span>
                        <nav
                          className="io-pagination hn-report-pagination"
                          aria-label={tUi("updatedUi.text_d66bbe96b8ac")}
                        >
                          <button
                            aria-label={tUi(
                              "reports.traceability.previousPage",
                            )}
                            disabled={currentPage === 1}
                            onClick={() => setPage(currentPage - 1)}
                          >
                            ‹
                          </button>
                          {pageNumbers.map((n, index) => (
                            <span key={n}>
                              {index > 0 && n - pageNumbers[index - 1] > 1 && (
                                <span className="io-page-gap">…</span>
                              )}
                              <button
                                aria-label={"Trang " + n}
                                aria-current={
                                  currentPage === n ? "page" : undefined
                                }
                                onClick={() => setPage(n)}
                              >
                                {n}
                              </button>
                            </span>
                          ))}
                          <button
                            aria-label={tUi("updatedUi.text_8cac33aab67d")}
                            disabled={currentPage === pageCount}
                            onClick={() => setPage(currentPage + 1)}
                          >
                            ›
                          </button>
                        </nav>
                        <small
                          title={t("reports.ioHistory.metaAsOf", {
                            time: fmtStamp(snapshot.dataAsOf),
                          })}
                        >
                          {fmtDay(range.from)} – {fmtDay(range.to)}
                        </small>
                      </footer>
                    </section>
                  ) : (
                    <section
                      id="rptio-panel-slice"
                      className="card"
                      role="tabpanel"
                      aria-labelledby="rptio-tab-slice"
                      data-report-view-panel="slice"
                    >
                      <div className="cardhead">
                        <div className="cardhead-l">
                          <i className="headicon">
                            <IoIcon name="grid-2x2-plus" />
                          </i>
                          <div>
                            <div className="title">
                              {t("reports.ioHistory.sliceTitle")}
                            </div>
                            <div className="note">
                              {t("reports.ioHistory.sliceNote")}
                            </div>
                          </div>
                        </div>
                        <span className="chip chip-info">
                          {t("reports.ioHistory.sourceRowCount", {
                            count: fmt(rows.length),
                          })}
                        </span>
                      </div>
                      <div className="slices">
                        {slices.length === 0 ? (
                          <div className="empty-row">
                            {t("reports.ioHistory.sliceEmpty")}
                          </div>
                        ) : (
                          slices.map((slice, index) => (
                            <article
                              key={slice.row.id}
                              className="slice"
                              data-drill-key={slice.row.id}
                            >
                              <div className="slicetop">
                                <div>
                                  <div className="stt-badge">
                                    {t("shared.table.rowNumber")} {index + 1}
                                  </div>
                                  <div className="cell">
                                    {slice.row.documentNo === ""
                                      ? EMPTY_TEXT
                                      : slice.row.documentNo}
                                  </div>
                                  <div className="sub">
                                    {slice.row.party === ""
                                      ? EMPTY_TEXT
                                      : slice.row.party}
                                  </div>
                                </div>
                                <span
                                  className={`type ${toneOf(slice.row.type)}`}
                                >
                                  {typeLabels[slice.row.type]}
                                </span>
                              </div>
                              <div className="slicemetrics">
                                <div>
                                  <small>
                                    {t("reports.ioHistory.sliceTotal")}
                                  </small>
                                  <b>{absOrEmpty(slice.row.qty)}</b>
                                </div>
                                <div>
                                  <small>
                                    {t("reports.ioHistory.sliceReversal")}
                                  </small>
                                  <b>{fmt(slice.reversalQty)}</b>
                                </div>
                                <div>
                                  <small>
                                    {t("reports.ioHistory.sliceNet")}
                                  </small>
                                  <b>{signedOrEmpty(slice.net)}</b>
                                </div>
                              </div>
                              <div className="slicefoot">
                                <span>
                                  {t("reports.ioHistory.sliceMilestones", {
                                    count: 1 + slice.linked.length,
                                  })}
                                </span>
                                <button
                                  className="btn secondary"
                                  type="button"
                                  onClick={() => openDrill(slice.row.id)}
                                >
                                  {t("reports.ioHistory.reconcile")}
                                </button>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
      {/* ── Hộp thoại chi tiết chứng từ ─────────────────────────────────── */}
      <UiDialog
        open={drillOpen && drill !== null}
        onClose={closeDrill}
        aria-labelledby="rptio-detail-title"
        className="hn-rpt-io io-detail-overlay"
        maxWidth={false}
        transitionDuration={reduceMotion ? 0 : { enter: 280, exit: 200 }}
        slotProps={{
          paper: { className: "modal" },
          transition: {
            onExited: () => {
              if (!drillOpenRef.current) setDrillId(null);
            },
          },
        }}
      >
        {drill !== null && (
          <>
            <div className="modalhead">
              <div>
                <h2 id="rptio-detail-title">
                  {drill.row.documentNo === ""
                    ? EMPTY_TEXT
                    : drill.row.documentNo}
                </h2>
                <div className="note">{t("reports.ioHistory.drawerNote")}</div>
              </div>
              <button
                className="btn secondary"
                type="button"
                aria-label={t("reports.ioHistory.drawerClose")}
                onClick={closeDrill}
              >
                ×
              </button>
            </div>
            <div className="modalbody">
              <section className="detail-summary">
                <div>
                  <small>{t("reports.ioHistory.selectedDoc")}</small>
                  <strong>
                    {drill.row.documentNo === ""
                      ? EMPTY_TEXT
                      : drill.row.documentNo}
                  </strong>
                  <span className={`chip ${toneOf(drill.row.type)}`}>
                    {typeLabels[drill.row.type]} ·{" "}
                    {reportStatusLabel(
                      drill.row.status === ""
                        ? IO_HISTORY_STATUS
                        : drill.row.status,
                    )}
                  </span>
                </div>
                <div className="detail-qty">{signedOrEmpty(drill.row.qty)}</div>
              </section>

              <section className="detail-section">
                <h3>{t("reports.ioHistory.sectionDocInfo")}</h3>
                <div className="detail-grid">
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldSourceDoc")}</small>
                    <b>
                      {drill.source.documentNo === ""
                        ? EMPTY_TEXT
                        : drill.source.documentNo}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldActorDept")}</small>
                    <b>
                      {[drill.row.actor, drill.row.department]
                        .filter((part) => part !== "")
                        .join(" · ") || EMPTY_TEXT}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldParty")}</small>
                    <b>
                      {drill.row.party === "" ? EMPTY_TEXT : drill.row.party}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldSkuLines")}</small>
                    <b>
                      {drill.row.skuLines.length === 0
                        ? EMPTY_TEXT
                        : drill.row.skuLines.join(" · ")}
                    </b>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>{t("reports.ioHistory.sectionTiming")}</h3>
                <div className="detail-grid">
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldCreatedAt")}</small>
                    <b>{fmtStamp(drill.row.createdAt)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldPostedAt")}</small>
                    <b>{fmtStamp(drill.row.postedAt)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldMovement")}</small>
                    <b>{movementLabelOf(drill.row)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldLinked")}</small>
                    <b>
                      {drill.row.originalDocumentNo === ""
                        ? t("reports.ioHistory.none")
                        : drill.row.originalDocumentNo}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldHistory")}</small>
                    <b>
                      {t("reports.ioHistory.historyValue", {
                        count: 1 + drill.linked.length,
                        type: typeLabels[drill.row.type],
                      })}
                    </b>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>{t("reports.ioHistory.sectionQtyRecon")}</h3>
                <div className="detail-recon">
                  <div>
                    <small>{t("reports.ioHistory.totalPosted")}</small>
                    <b>{absOrEmpty(drill.source.qty)}</b>
                  </div>
                  <div>
                    <small>{t("reports.ioHistory.sliceReversal")}</small>
                    <b>{fmt(drill.reversalQty)}</b>
                  </div>
                  <div>
                    <small>{t("reports.ioHistory.kpiNet")}</small>
                    <b>{signedOrEmpty(drill.net)}</b>
                  </div>
                </div>
              </section>

              <p className="detail-hint">{t("reports.ioHistory.drawerHint")}</p>
            </div>
          </>
        )}
      </UiDialog>
    </div>
  );
}
