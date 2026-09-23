import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { HomeOutlined } from "@/shared/components/icons";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
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
  type TransactionFilter,
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
  const end = dayjs().startOf("day");
  return [end.subtract(6, "day"), end];
}

export default function IoHistoryReport() {
  const warehouseName =
    useAuthStore((state) => state.currentContext?.warehouse_name)?.trim() || "—";
  const canExportPermission = useCan(WMS_PERMISSION_CATALOG.REPORT_EXPORT);
  const initialRange = useMemo<[Dayjs, Dayjs]>(
    () => currentSevenDayRange(),
    [],
  );

  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs]>(initialRange);
  const [draftType, setDraftType] = useState<TransactionFilter>("ALL");
  const [draftActor, setDraftActor] = useState("");
  const [applied, setApplied] = useState<AppliedFilters>({
    from: initialRange[0].format(ISO_DATE),
    to: initialRange[1].format(ISO_DATE),
    type: "ALL",
    actor: "",
  });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<HistoryRow | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [exportState, setExportState] = useState<ExportState>("idle");

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
      const day = dayjs(row.timestamp).format(ISO_DATE);
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

  const totalPages = Math.max(1, Math.ceil(searchedRows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const visibleRows = searchedRows.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, applied.from, applied.to, applied.type, applied.actor]);

  useEffect(() => {
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
  const refreshing =
    manualRefreshing || (!initialLoading && source.fetching);
  const readonly = !canExportPermission;
  const reportEmpty = !initialLoading && !hardError && totalTransactions === 0;
  const noSearchResult =
    !reportEmpty &&
    deferredSearch.trim().length > 0 &&
    searchedRows.length === 0;
  const stale =
    !staleDismissed && Boolean(source.error) && liveRows.length > 0;
  const controlsBusy = initialLoading || refreshing;
  const exportDisabled =
    initialLoading ||
    refreshing ||
    hardError ||
    reportEmpty ||
    readonly ||
    exportState === "exporting";
  const defaultDraftRange =
    draftRange[0].isSame(initialRange[0], "day") &&
    draftRange[1].isSame(initialRange[1], "day");

  const applyFilters = useCallback(() => {
    if (invalidRange) return;
    setApplied({
      from: draftRange[0].format(ISO_DATE),
      to: draftRange[1].format(ISO_DATE),
      type: draftType,
      actor: draftActor,
    });
    setPage(1);
  }, [draftActor, draftRange, draftType, invalidRange]);

  const resetFilters = useCallback(() => {
    const nextRange = currentSevenDayRange();
    setDraftRange(nextRange);
    setDraftType("ALL");
    setDraftActor("");
    setApplied({
      from: nextRange[0].format(ISO_DATE),
      to: nextRange[1].format(ISO_DATE),
      type: "ALL",
      actor: "",
    });
    setSearch("");
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

  const exportReport = useCallback(async () => {
    if (exportDisabled) return;
    setExportState("exporting");
    try {
      await runReportExport("xlsx", {
        reportCode: IO_HISTORY_EXPORT_CODE,
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
    }
  }, [applied, exportDisabled, search]);

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
          <div
            className="rpt08-breadcrumb"
            aria-label={tUi("updatedUi.text_610f66b336f3")}
          >
            <HomeOutlined />
            <span>{tUi("reports.traceability.breadcrumbReports")}</span>
            <span aria-hidden="true">/</span>
            <span>{tUi("updatedUi.text_8814615e6de0")}</span>
          </div>
          <h1 className="hn-report-page-title">
            {tUi("updatedUi.text_cedbc7cfb228")}
          </h1>
          <p>{tUi("updatedUi.text_5c09481fb555")}</p>
        </div>
        <HeaderActions
          warehouse={warehouseName}
          readonly={readonly}
          exportState={exportState}
          exportDisabled={exportDisabled}
          onExport={() => void exportReport()}
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
            type={draftType}
            actor={draftActor}
            actorOptions={actorOptions}
            warehouse={warehouseName}
            invalid={invalidRange}
            busy={controlsBusy}
            isDefaultRange={defaultDraftRange}
            onRangeChange={setDraftRange}
            onTypeChange={setDraftType}
            onActorChange={setDraftActor}
            onApply={applyFilters}
            onReset={resetFilters}
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
            empty={reportEmpty}
            noResult={noSearchResult}
            range={applied}
            onSearch={setSearch}
            onPageChange={setPage}
            onOpenRow={setDetailRow}
            onAdjustRange={() => {
              setDraftRange(currentSevenDayRange());
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
    </main>
  );
}
