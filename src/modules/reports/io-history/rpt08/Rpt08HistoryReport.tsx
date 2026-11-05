import { businessToday } from "@/shared/utils/date-time";
import { parseDateTime, BUSINESS_TIMEZONE } from "@/shared/utils/date-time";
import { useDateTimePreferences } from "@/shared/store/interface-preferences.store";
import { ReportExportDrawer } from "../../components/ReportExportAction";
import { reportExportSections } from "../../components/report-export-sections";
import { reportWorkbookOptions } from "../../components/report-export-options";
import type { ReportExportChoice } from "../../components/report-export-workbook";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Dayjs } from "dayjs";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import { runReportExport } from "@/modules/reports/operations/report-export";
import {
  IO_HISTORY_EXPORT_CODE,
  ISO_DATE,
  useIoHistorySnapshot,
  type IoTypeFilter,
} from "../io-history-api";
import {
  PAGE_SIZE,
  buildDaily,
  displayAsOf,
  displayStamp,
  mapLiveRow,
  number,
  type AppliedFilters,
  type DailyMovement,
  type ExportState,
  type HistoryRow,
} from "./model";
import {
  FilterCard,
  HeaderActions,
  InitialLoadingBody,
  LoadError,
  RefreshStrip,
  StatusBanner,
} from "./controls";
import {
  ActivityCard,
  DailyChart,
  HistoryTable,
  OverviewCard,
  ProductCard,
  TypePill,
} from "./widgets";
import { tStatic as tUi } from "@/shared/i18n/useT";

function currentSevenDayRange(): [Dayjs, Dayjs] {
  const end = businessToday().startOf("day");
  return [end.subtract(6, "day"), end];
}

export default function IoHistoryReport() {
  useDateTimePreferences();
  const canExportPermission = useCan(WMS_PERMISSION_CATALOG.REPORT_EXPORT);
  const initialRange = useMemo<[Dayjs, Dayjs]>(
    () => currentSevenDayRange(),
    [],
  );

  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs]>(initialRange);
  const [applied, setApplied] = useState<AppliedFilters>({
    from: initialRange[0].format(ISO_DATE),
    to: initialRange[1].format(ISO_DATE),
    type: "ALL",
    actor: "",
  });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [detailRow, setDetailRow] = useState<HistoryRow | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [showExport, setShowExport] = useState(false);

  const sourceType: IoTypeFilter = applied.type === "ALL" ? "" : applied.type;
  const source = useIoHistorySnapshot({
    from: applied.from,
    to: applied.to,
    type: sourceType,
  });

  const liveRows = useMemo(
    () =>
      source.snapshot.rows
        .map(mapLiveRow)
        .filter((row): row is HistoryRow => row !== null),
    [source.snapshot.rows],
  );
  const allRows = liveRows;

  const actorOptions = useMemo(() => {
    const actors = [
      ...new Set(
        allRows
          .map((row) => row.actor)
          .filter((actor) => actor && actor !== "—"),
      ),
    ].sort((left, right) => left.localeCompare(right, "vi"));
    return [
      { value: "", label: tUi("dashboard.operations.filterAll") },
      ...actors.map((actor) => ({ value: actor, label: actor })),
    ];
  }, [allRows]);

  const reportRows = useMemo(() => {
    return allRows.filter((row) => {
      const day = parseDateTime(row.timestamp, BUSINESS_TIMEZONE).format(
        ISO_DATE,
      );
      if (day < applied.from || day > applied.to) return false;
      if (applied.type !== "ALL" && row.type !== applied.type) return false;
      if (applied.actor && row.actor !== applied.actor) return false;
      return true;
    });
  }, [allRows, applied]);

  const searchedRows = useMemo(() => {
    const needle = deferredSearch.trim().toLocaleLowerCase("vi");
    if (!needle) return reportRows;
    return reportRows.filter((row) =>
      [row.documentNo, row.objectPrimary, row.objectSecondary, row.actor]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle),
    );
  }, [deferredSearch, reportRows]);

  const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize));
  const visiblePage = Math.min(page, totalPages);
  const visibleRows = searchedRows.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- State follows a changed external input or route.
    setPage(1);
  }, [deferredSearch, applied.from, applied.to, applied.type, applied.actor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- State follows a changed external input or route.
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const inboundCount = reportRows.filter(
    (row) => row.type === "INBOUND",
  ).length;
  const outboundCount = reportRows.filter(
    (row) => row.type === "OUTBOUND",
  ).length;
  const totalTransactions = inboundCount + outboundCount;

  const productTotal = (type: HistoryRow["type"]): number | null => {
    const rows = reportRows.filter((row) => row.type === type);
    if (rows.some((row) => row.quantity === null)) return null;
    return rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  };
  const inboundProducts = productTotal("INBOUND");
  const outboundProducts = productTotal("OUTBOUND");
  const totalProducts =
    inboundProducts === null || outboundProducts === null
      ? null
      : inboundProducts + outboundProducts;

  const daily = useMemo(
    () => buildDaily(reportRows, applied.from, applied.to),
    [reportRows, applied.from, applied.to],
  );
  const peak = useMemo(() => {
    if (totalTransactions === 0) return null;
    return daily.reduce<DailyMovement | null>((best, current) => {
      if (!best) return current;
      return current.inbound + current.outbound > best.inbound + best.outbound
        ? current
        : best;
    }, null);
  }, [daily, totalTransactions]);

  const invalidRange = draftRange[0]
    .startOf("day")
    .isAfter(draftRange[1].startOf("day"));
  const initialLoading = source.loading && liveRows.length === 0;
  const hardError = Boolean(source.error) && liveRows.length === 0;
  const refreshing = manualRefreshing || (!initialLoading && source.fetching);
  const readonly = !canExportPermission;
  const reportEmpty = !initialLoading && !hardError && totalTransactions === 0;
  const noSearchResult =
    !reportEmpty &&
    deferredSearch.trim().length > 0 &&
    searchedRows.length === 0;
  const stale = !staleDismissed && Boolean(source.error) && liveRows.length > 0;
  const controlsBusy = initialLoading || refreshing;
  const exportDisabled =
    initialLoading ||
    refreshing ||
    hardError ||
    reportEmpty ||
    readonly ||
    invalidRange ||
    Boolean(source.error) ||
    exportState === "unknown" ||
    exportState === "exporting";
  const changeRange = useCallback((next: [Dayjs, Dayjs]) => {
    setDraftRange(next);
    if (next[0].startOf("day").isAfter(next[1].startOf("day"))) return;
    setApplied((current) => ({
      ...current,
      from: next[0].format(ISO_DATE),
      to: next[1].format(ISO_DATE),
    }));
    setPage(1);
  }, []);

  const refresh = useCallback(async () => {
    setStaleDismissed(true);
    setManualRefreshing(true);
    try {
      await source.refetch();
    } finally {
      setManualRefreshing(false);
    }
  }, [source]);

  const exportReport = useCallback(
    async (choice?: ReportExportChoice) => {
      if (exportDisabled) return false;
      setExportState("exporting");
      try {
        await runReportExport("xlsx", {
          reportCode: IO_HISTORY_EXPORT_CODE,
          ...(choice
            ? {
                workbook: reportWorkbookOptions(
                  choice,
                  ["Mã phiếu"],
                  searchedRows.map((row) => row.documentNo),
                  visibleRows.map((row) => row.documentNo),
                ),
              }
            : {}),
          fileStem: "lich-su-nhap-xuat-kho",
          fileSuffix: `-${applied.from}-${applied.to}`,
          filters: {
            from_date: applied.from,
            to_date: applied.to,
            doc_type:
              applied.type === "INBOUND"
                ? "inbound"
                : applied.type === "OUTBOUND"
                  ? "outbound"
                  : "all",
            ...(applied.actor ? { actor: applied.actor } : {}),
            ...(search.trim() ? { keyword: search.trim() } : {}),
          },
        });
        setExportState("idle");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setExportState(
          /timeout|time\s*out|hết thời gian|quá thời gian|chưa xác định/i.test(
            message,
          )
            ? "unknown"
            : "failed",
        );
        return false;
      }
    },
    [applied, exportDisabled, search, searchedRows, visibleRows],
  );

  return (
    <main
      id="rpt08-history-report"
      className={
        "rpt08-report" +
        (initialLoading ? " is-loading" : "") +
        (refreshing ? " is-refreshing" : "")
      }
      data-mvp-screen="RPT-08"
    >
      <header className="rpt08-page-header">
        <div className="rpt08-heading">
          <h1 className="hn-report-page-title">
            {tUi("updatedUi.text_cedbc7cfb228")}
          </h1>
          <p>{tUi("updatedUi.text_5c09481fb555")}</p>
        </div>
        <HeaderActions
          readonly={readonly}
          exportState={exportState}
          exportDisabled={exportDisabled}
          onExport={() => setShowExport(true)}
        />
      </header>

      {hardError ? (
        <LoadError onRetry={refresh} />
      ) : initialLoading ? (
        <InitialLoadingBody />
      ) : (
        <>
          <FilterCard
            range={draftRange}
            type={applied.type}
            actor={applied.actor}
            actorOptions={actorOptions}
            invalid={invalidRange}
            busy={controlsBusy}
            onRangeChange={changeRange}
            onTypeChange={(type) =>
              setApplied((current) => ({ ...current, type }))
            }
            onActorChange={(actor) =>
              setApplied((current) => ({ ...current, actor }))
            }
          />

          {refreshing ? <RefreshStrip /> : null}

          {stale ? (
            <StatusBanner
              tone="warning"
              title={tUi("updatedUi.text_278fb7e1cb78")}
              message={tUi("updatedUi.text_0d15f428b113", {
                value0: String(displayAsOf(source.snapshot.dataAsOf)),
              })}
              primaryLabel="Thử cập nhật"
              onPrimary={refresh}
              onClose={() => setStaleDismissed(true)}
            />
          ) : null}

          {exportState === "failed" ? (
            <StatusBanner
              tone="error"
              title={tUi("updatedUi.text_43dc1de9c0f5")}
              message={tUi("updatedUi.text_420c6ee4be7e")}
              primaryLabel="Thử lại"
              onPrimary={() => void exportReport()}
              onClose={() => setExportState("idle")}
            />
          ) : null}

          {exportState === "unknown" ? (
            <StatusBanner
              tone="warning"
              title={tUi("updatedUi.text_59cf4eaf5714")}
              message={tUi("updatedUi.text_b2fc9bf6624e")}
              primaryLabel="Đã hiểu"
              onPrimary={() => setExportState("idle")}
            />
          ) : null}

          <div className="rpt08-summary-grid">
            <OverviewCard
              total={totalTransactions}
              inbound={inboundCount}
              outbound={outboundCount}
              stale={stale}
            />
            <ProductCard
              total={totalProducts}
              inbound={inboundProducts}
              outbound={outboundProducts}
            />
          </div>

          <div className="rpt08-analysis-grid">
            <DailyChart daily={daily} total={totalTransactions} />
            <ActivityCard
              total={totalTransactions}
              inbound={inboundCount}
              outbound={outboundCount}
              peak={peak}
            />
          </div>

          <HistoryTable
            rows={visibleRows}
            total={searchedRows.length}
            search={search}
            page={visiblePage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            empty={reportEmpty}
            noResult={noSearchResult}
            range={applied}
            onSearch={setSearch}
            onPageChange={setPage}
            onOpenRow={setDetailRow}
            onAdjustRange={() => {
              changeRange(currentSevenDayRange());
              window.requestAnimationFrame(() => {
                document
                  .querySelector<HTMLElement>(".rpt08-date-control")
                  ?.focus();
              });
            }}
          />
        </>
      )}

      {detailRow ? (
        <DrillDownDialog
          title={tUi("updatedUi.text_11e692fd1ec1", {
            value0: String(detailRow.documentNo),
          })}
          subtitle={tUi("updatedUi.text_3244b982398e")}
          maxWidth="md"
          onClose={() => setDetailRow(null)}
        >
          <div className="rpt08-detail-grid">
            <dl>
              <div>
                <dt>{tUi("updatedUi.text_94c1cbc6d405")}</dt>
                <dd>
                  <TypePill type={detailRow.type} />
                </dd>
              </div>
              <div>
                <dt>{tUi("inventory.movement.colTime")}</dt>
                <dd>{displayStamp(detailRow.timestamp)}</dd>
              </div>
              <div>
                <dt>{tUi("audit.colObject")}</dt>
                <dd>
                  {detailRow.objectPrimary} · {detailRow.objectSecondary}
                </dd>
              </div>
              <div>
                <dt>{tUi("dashboard.stockMix.colQuantity")}</dt>
                <dd>
                  {detailRow.quantity === null
                    ? "—"
                    : number(detailRow.quantity)}
                </dd>
              </div>
              <div>
                <dt>{tUi("inventory.trace.colPerformedBy")}</dt>
                <dd>{detailRow.actor}</dd>
              </div>
              <div>
                <dt>{tUi("dashboard.composition.colStatus")}</dt>
                <dd>
                  {detailRow.source?.status ||
                    tUi("warranty.componentIssueStatus.posted")}
                </dd>
              </div>
            </dl>
          </div>
        </DrillDownDialog>
      ) : null}
      {showExport ? (
        <ReportExportDrawer
          title={tUi("reportExport.history")}
          fileStem={"LichSuNhapXuat_" + applied.from + "-" + applied.to}
          context={[
            [tUi("reportExport.period"), applied.from + " – " + applied.to],
          ]}
          sections={reportExportSections(tUi("reportExport.documents"))}
          scopes={[
            {
              id: "all",
              label: tUi("reportExport.all", { count: searchedRows.length }),
              description: tUi("reportExport.allHint"),
              count: searchedRows.length,
            },
            {
              id: "page",
              label: tUi("reportExport.page", { count: visibleRows.length }),
              description: tUi("reportExport.pageHint"),
              count: visibleRows.length,
            },
          ]}
          unavailable={exportDisabled}
          onClose={() => setShowExport(false)}
          onExport={exportReport}
        />
      ) : null}
    </main>
  );
}
