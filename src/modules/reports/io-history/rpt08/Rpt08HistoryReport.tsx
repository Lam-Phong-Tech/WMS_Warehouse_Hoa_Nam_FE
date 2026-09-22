import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useSearchParams } from "react-router-dom";
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
  DEMO_FROM,
  DEMO_TO,
  EMPTY_FROM,
  EMPTY_TO,
  PAGE_SIZE,
  buildDaily,
  displayAsOf,
  displayStamp,
  makeDemoRows,
  mapLiveRow,
  number,
  readPreviewState,
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

export default function IoHistoryReport() {
  const [searchParams] = useSearchParams();
  const forcedState = readPreviewState(searchParams);
  const demoScreen = searchParams.get("screen")?.toUpperCase() === "RPT-08";
  const demoMode = demoScreen || forcedState !== null;
  const warehouseName =
    useAuthStore((state) => state.currentContext?.warehouse_name) || "Kho Hoa Nam";
  const canExportPermission = useCan(WMS_PERMISSION_CATALOG.REPORT_EXPORT);

  const initialDraftRange: [Dayjs, Dayjs] =
    forcedState === "empty"
      ? [EMPTY_FROM, EMPTY_TO]
      : forcedState === "invalid"
        ? [DEMO_TO, DEMO_FROM]
        : demoMode
          ? [DEMO_FROM, DEMO_TO]
          : [dayjs().subtract(6, "day").startOf("day"), dayjs().startOf("day")];
  const initialAppliedRange: [Dayjs, Dayjs] =
    forcedState === "empty"
      ? [EMPTY_FROM, EMPTY_TO]
      : demoMode
        ? [DEMO_FROM, DEMO_TO]
        : initialDraftRange;

  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs]>(initialDraftRange);
  const [draftType, setDraftType] = useState<TransactionFilter>("ALL");
  const [draftActor, setDraftActor] = useState("");
  const [applied, setApplied] = useState<AppliedFilters>({
    from: initialAppliedRange[0].format(ISO_DATE),
    to: initialAppliedRange[1].format(ISO_DATE),
    type: "ALL",
    actor: "",
  });
  const [search, setSearch] = useState(
    forcedState === "no-result" ? "SN-KHONG-TON-TAI" : "",
  );
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<HistoryRow | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [exportState, setExportState] = useState<ExportState>(() => {
    if (forcedState === "exporting") return "exporting";
    if (forcedState === "export-failed") return "failed";
    if (forcedState === "export-unknown") return "unknown";
    return "idle";
  });

  const sourceType: IoTypeFilter = applied.type === "ALL" ? "" : applied.type;
  const source = useIoHistorySnapshot({
    from: applied.from,
    to: applied.to,
    type: sourceType,
  });

  const demoRows = useMemo(makeDemoRows, []);
  const liveRows = useMemo(
    () => source.snapshot.rows.map(mapLiveRow).filter((row): row is HistoryRow => row !== null),
    [source.snapshot.rows],
  );
  const allRows = demoMode ? demoRows : liveRows;

  const actorOptions = useMemo(() => {
    const actors = [...new Set(allRows.map((row) => row.actor).filter((actor) => actor && actor !== "—"))]
      .sort((left, right) => left.localeCompare(right, "vi"));
    return [
      { value: "", label: "Tất cả" },
      ...actors.map((actor) => ({ value: actor, label: actor })),
    ];
  }, [allRows]);

  const reportRows = useMemo(() => {
    if (forcedState === "empty") return [];
    return allRows.filter((row) => {
      const day = dayjs(row.timestamp).format(ISO_DATE);
      if (day < applied.from || day > applied.to) return false;
      if (applied.type !== "ALL" && row.type !== applied.type) return false;
      if (applied.actor && row.actor !== applied.actor) return false;
      return true;
    });
  }, [allRows, applied, forcedState]);

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

  useEffect(() => {
    if (forcedState === "no-result") setSearch("SN-KHONG-TON-TAI");
  }, [forcedState]);

  useEffect(() => {
    if (forcedState === "exporting") setExportState("exporting");
    else if (forcedState === "export-failed") setExportState("failed");
    else if (forcedState === "export-unknown") setExportState("unknown");
  }, [forcedState]);

  const inboundCount = reportRows.filter((row) => row.type === "INBOUND").length;
  const outboundCount = reportRows.filter((row) => row.type === "OUTBOUND").length;
  const totalTransactions = inboundCount + outboundCount;

  const canonicalDemoRange =
    demoMode &&
    applied.from === DEMO_FROM.format(ISO_DATE) &&
    applied.to === DEMO_TO.format(ISO_DATE) &&
    applied.actor === "";

  const liveInboundProducts = reportRows
    .filter((row) => row.type === "INBOUND")
    .reduce((sum, row) => sum + row.quantity, 0);
  const liveOutboundProducts = reportRows
    .filter((row) => row.type === "OUTBOUND")
    .reduce((sum, row) => sum + row.quantity, 0);
  const inboundProducts = canonicalDemoRange ? (applied.type === "OUTBOUND" ? 0 : 6480) : liveInboundProducts;
  const outboundProducts = canonicalDemoRange ? (applied.type === "INBOUND" ? 0 : 5980) : liveOutboundProducts;
  const totalProducts = inboundProducts + outboundProducts;

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

  const invalidRange =
    forcedState === "invalid" || draftRange[0].startOf("day").isAfter(draftRange[1].startOf("day"));
  const initialLoading =
    forcedState === "loading" || (!demoMode && source.loading && liveRows.length === 0);
  const hardError =
    forcedState === "error" || (!demoMode && Boolean(source.error) && liveRows.length === 0);
  const refreshing =
    forcedState === "refreshing" ||
    manualRefreshing ||
    (!demoMode && !initialLoading && source.fetching);
  const readonly =
    forcedState === "readonly" || (!demoMode && !canExportPermission);
  const reportEmpty = !initialLoading && !hardError && totalTransactions === 0;
  const noSearchResult =
    !reportEmpty &&
    (forcedState === "no-result" ||
      (deferredSearch.trim().length > 0 && searchedRows.length === 0));
  const stale =
    !staleDismissed &&
    (forcedState === "stale" ||
      (!demoMode && Boolean(source.error) && liveRows.length > 0));
  const controlsBusy = initialLoading || refreshing;
  const exportDisabled =
    initialLoading ||
    refreshing ||
    hardError ||
    reportEmpty ||
    readonly ||
    exportState === "exporting";
  const defaultDraftRange =
    draftRange[0].isSame(DEMO_FROM, "day") && draftRange[1].isSame(DEMO_TO, "day");

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
    const nextRange: [Dayjs, Dayjs] = demoMode
      ? [DEMO_FROM, DEMO_TO]
      : [dayjs().subtract(6, "day").startOf("day"), dayjs().startOf("day")];
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
  }, [demoMode]);

  const refresh = useCallback(() => {
    setStaleDismissed(true);
    setManualRefreshing(true);
    source.refetch();
    window.setTimeout(() => setManualRefreshing(false), 800);
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
        /timeout|time\s*out|hết thời gian|quá thời gian|chưa xác định/i.test(message)
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
          <div className="rpt08-breadcrumb" aria-label="Đường dẫn điều hướng">
            <HomeOutlined />
            <span>Báo cáo</span>
            <span aria-hidden="true">/</span>
            <span>Lịch sử nhập - xuất kho</span>
          </div>
          <h1>Báo cáo Lịch sử nhập - xuất kho</h1>
          <p>Theo dõi toàn bộ giao dịch nhập, xuất và luân chuyển hàng hóa</p>
        </div>
        <HeaderActions
          warehouse={warehouseName}
          demo={demoMode}
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
              title="Dữ liệu có thể chưa mới nhất"
              message={`Đang hiển thị bản cập nhật gần nhất. Cập nhật lần cuối: ${displayAsOf(source.snapshot.dataAsOf, demoMode)}.`}
              primaryLabel="Thử cập nhật"
              onPrimary={refresh}
              onClose={() => setStaleDismissed(true)}
            />
          ) : null}

          {exportState === "failed" ? (
            <StatusBanner
              tone="error"
              title="Không thể xuất báo cáo"
              message="Báo cáo chưa được tạo. Vui lòng thử lại."
              primaryLabel="Thử lại"
              onPrimary={() => void exportReport()}
              onClose={() => setExportState("idle")}
            />
          ) : null}

          {exportState === "unknown" ? (
            <StatusBanner
              tone="warning"
              title="Chưa xác định kết quả xuất báo cáo"
              message="Không nhận được xác nhận từ hệ thống. Hãy kiểm tra các tệp đã tải trước khi xuất lại để tránh trùng lặp."
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
            demo={demoMode}
            range={applied}
            onSearch={setSearch}
            onPageChange={setPage}
            onOpenRow={setDetailRow}
            onAdjustRange={() => {
              setDraftRange([DEMO_FROM, DEMO_TO]);
              window.requestAnimationFrame(() => {
                document.querySelector<HTMLElement>(".rpt08-date-control")?.focus();
              });
            }}
          />
        </>
      )}

      {detailRow ? (
        <DrillDownDialog
          title={`Chi tiết giao dịch · ${detailRow.documentNo}`}
          subtitle="Thông tin lấy từ lát cắt báo cáo đang hiển thị."
          maxWidth="md"
          onClose={() => setDetailRow(null)}
        >
          <div className="rpt08-detail-grid">
            <dl>
              <div><dt>Loại giao dịch</dt><dd><TypePill type={detailRow.type} /></dd></div>
              <div><dt>Thời gian</dt><dd>{displayStamp(detailRow.timestamp)}</dd></div>
              <div><dt>Đối tượng</dt><dd>{detailRow.objectPrimary} · {detailRow.objectSecondary}</dd></div>
              <div><dt>Số lượng</dt><dd>{number(detailRow.quantity)}</dd></div>
              <div><dt>Người thực hiện</dt><dd>{detailRow.actor}</dd></div>
              <div><dt>Trạng thái</dt><dd>{detailRow.source?.status || "Đã ghi nhận"}</dd></div>
            </dl>
          </div>
        </DrillDownDialog>
      ) : null}
    </main>
  );
}
