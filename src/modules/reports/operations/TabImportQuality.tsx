import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Box, UiAlert, UiSelect, UiStatusBadge } from "@/shared/ui";
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ActionButton } from "@/shared/components/actions";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  axisDayLabel,
  dateSpan,
  dayKey,
  fmt,
  fmtDateTime,
  listOf,
  n,
  pct,
  text,
  type ItemKind,
  type Raw,
} from "./report-format";
import {
  useImportMatch,
  useSkuCatalog,
  useSkuImportReports,
  useUserDirectory,
} from "./report-data";
import {
  ChartCard,
  ChartGrid,
  DrillDownDialog,
  FilterBar,
  FormulaNote,
  ReportKpi,
  ReportKpiRow,
  ReportSectionHeading,
  SegmentedToggle,
} from "./report-ui";
import {
  AllOrPickFilter,
  ExportButtons,
  ItemKindFilter,
  PeriodFilterControls,
} from "./report-filters";
import { usePeriodFilter } from "./report-period";
import { reportStatusLabel } from "./report-labels";
import { ReportPaginationBar } from "./report-table";
import { useClientPagination } from "./report-columns";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { ReportStatusBadge } from "./report-drilldown";
import { useReportExport } from "./report-export";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

const sourceOptions = (t: TranslateFn) => [
  { value: "all", label: t("reports.importQuality.sourceAll") },
  { value: "IMPORT", label: t("reports.importQuality.sourceFromFile") },
  { value: "SCAN", label: t("reports.importQuality.sourceScanShort") },
];

const resultOptions = (t: TranslateFn) => [
  { value: "SUCCESS", label: t("reports.importQuality.outcomeSuccess") },
  { value: "FAILED", label: t("reports.importQuality.outcomeFailed") },
  { value: "DUPLICATE", label: t("reports.importQuality.outcomeDuplicate") },
];

const TOP_ERROR_OPTIONS = [
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
] as const;

/**
 * Mã lỗi mang nghĩa "đã tồn tại / trùng" — tách khỏi Failed vì nghiệp vụ xử lý
 * hai nhóm này khác hẳn nhau (trùng thì bỏ qua, lỗi thì phải sửa và nộp lại).
 */
function isDuplicateCode(code: string): boolean {
  const upper = code.toUpperCase();
  return (
    upper.includes("DUPLICATE") ||
    upper.includes("ALREADY_EXISTS") ||
    upper.includes("ALREADY_MATCHED")
  );
}

type ErrorLine = {
  rowNo: string;
  code: string;
  message: string;
  reference: string;
  request: string;
  at: string;
};

type BatchRecord = {
  id: string;
  source: "IMPORT" | "SCAN";
  batchNo: string;
  at: string;
  total: number;
  success: number;
  failed: number;
  duplicate: number;
  actor: string;
  status: string;
  skuCodes: string[];
  errors: ErrorLine[];
  errorFileAvailable: boolean;
  /**
   * §13.10 RPT-OUT-MATCH-01: tầng dòng SKU của toa (required/matched/scanned/
   * posted + validation status). Chỉ nguồn SCAN có; nguồn IMPORT danh mục SKU
   * không có khái niệm "toa" nên để rỗng.
   */
  matchLines: Raw[];
};

/**
 * Tab 4 — Import / Match và lỗi dữ liệu.
 *
 * Hai nguồn xử lý có schema hoàn toàn khác nhau (Import SKU qua Excel ở
 * `/skus/import-reports`, đối soát toa qua `/reports/import-match`) nhưng người
 * dùng đọc chúng như MỘT dòng công việc "nạp dữ liệu vào hệ thống". Chuẩn hoá
 * cả hai về một `BatchRecord` ngay tại đây để ba mục 4.1–4.3 chỉ nhìn một hình
 * dạng dữ liệu, thay vì mỗi mục tự xử lý hai nhánh.
 */
export default function TabImportQuality() {
  const t = useT();
  const period = usePeriodFilter("this-month");
  const catalog = useSkuCatalog();
  const users = useUserDirectory();
  const exporter = useReportExport();

  const [itemKind, setItemKind] = useState<ItemKind>("all");
  const [source, setSource] = useState("all");
  const [topErrors, setTopErrors] = useState<"10" | "20">("10");

  const importMatch = useImportMatch({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });
  const skuImports = useSkuImportReports({ enabled: !period.invalid });

  const batches = useMemo<BatchRecord[]>(() => {
    const result: BatchRecord[] = [];

    // ── Nguồn SCAN: đối soát toa Excel (tầng dòng SKU có validation_status) ──
    const matchRows = listOf(importMatch.data?.rows);
    const byBatch = new Map<string, Raw[]>();
    for (const row of matchRows) {
      const key = text(row.import_no, "");
      const bucket = byBatch.get(key);
      if (bucket) bucket.push(row);
      else byBatch.set(key, [row]);
    }
    for (const batch of listOf(importMatch.data?.batches)) {
      const importNo = text(batch.import_no, "");
      const lines = byBatch.get(importNo) ?? [];
      let success = 0;
      let failed = 0;
      let duplicate = 0;
      const errors: ErrorLine[] = [];
      for (const line of lines) {
        const status = text(line.validation_status, "");
        const code = text(line.error_code, "");
        if (status === "VALID") success += 1;
        else if (code && isDuplicateCode(code)) duplicate += 1;
        else if (status === "ERROR" || status === "INVALID") failed += 1;
        if (code || status === "ERROR" || status === "INVALID") {
          errors.push({
            rowNo: text(line.row_no, EMPTY_TEXT),
            code: code || status,
            message: text(line.error_message, ""),
            reference: text(line.sku_code, ""),
            request: text(line.source_request_no, ""),
            at: text(batch.uploaded_at, ""),
          });
        }
      }
      result.push({
        id: text(batch.id, importNo),
        source: "SCAN",
        batchNo: importNo,
        at: text(batch.uploaded_at, ""),
        total: n(batch.total_rows, lines.length),
        success: success || n(batch.valid_rows),
        failed: failed || Math.max(0, n(batch.error_rows) - duplicate),
        duplicate,
        actor: text(batch.uploaded_by_name, ""),
        status: text(batch.status, ""),
        skuCodes: lines
          .map((line) => text(line.sku_code, ""))
          .filter((code) => code !== ""),
        errors,
        errorFileAvailable: false,
        matchLines: lines,
      });
    }

    // ── Nguồn IMPORT: nạp danh mục SKU bằng Excel ──────────────────────────
    for (const row of listOf(skuImports.data?.data)) {
      const at = text(row.created_at, "");
      const day = dayKey(at);
      if (day && (day < period.from || day > period.to)) continue;
      const rowErrors = listOf(row.row_errors);
      let duplicate = 0;
      const errors: ErrorLine[] = rowErrors.map((error) => {
        const code = text(error.code, "");
        if (isDuplicateCode(code)) duplicate += 1;
        return {
          rowNo: text(error.row, EMPTY_TEXT),
          code: code || "UNKNOWN",
          message: text(error.message, ""),
          reference: text(error.value ?? error.field, ""),
          request: text(row.request_id, ""),
          at,
        };
      });
      const actorId = text(row.actor_id, "");
      result.push({
        id: text(row.import_report_id ?? row.id, ""),
        source: "IMPORT",
        // KHÔNG fallback sang import_report_id/id (UUID): batchNo hiển thị ở
        // cột bảng và trong tiêu đề hộp thoại "Chi tiết batch …". Thiếu tên tệp
        // thì để rỗng, nơi render tự hiện "—".
        batchNo: text(row.file_name, ""),
        at,
        total: n(row.total_rows),
        success: n(row.valid_rows),
        failed: Math.max(0, n(row.error_rows) - duplicate),
        duplicate,
        // KHÔNG fallback sang actorId (UUID): trường này hiện ở cột "Người
        // thực hiện" và nuôi luôn danh sách chọn của bộ lọc người thực hiện.
        actor:
          users.entries.find((entry) => entry.user_id === actorId)?.name ?? "",
        status: text(row.status, ""),
        skuCodes: [],
        errors,
        errorFileAvailable: Boolean(row.error_file_available),
        matchLines: [],
      });
    }

    return result.sort((a, b) => b.at.localeCompare(a.at));
  }, [
    importMatch.data,
    skuImports.data,
    users.entries,
    period.from,
    period.to,
  ]);

  /** Bộ lọc chung của 3 biểu đồ: nguồn xử lý + loại hàng. */
  const chartBatches = useMemo(
    () =>
      batches.filter((batch) => {
        if (source !== "all" && batch.source !== source) return false;
        if (itemKind !== "all") {
          // Chỉ batch đối soát toa mới gắn được SKU cụ thể; batch nạp danh mục
          // SKU không thuộc về một loại hàng nào nên bị loại khi lọc theo loại.
          if (batch.skuCodes.length === 0) return false;
          const matched = batch.skuCodes.some(
            (code) => catalog.kindOfCode(code) === itemKind,
          );
          if (!matched) return false;
        }
        return true;
      }),
    [batches, source, itemKind, catalog],
  );

  // ── 4.1 Kết quả Import/Scan theo thời gian ─────────────────────────────
  const days = useMemo(
    () => dateSpan(period.from, period.to),
    [period.from, period.to],
  );

  const dailySeries = useMemo(() => {
    const blank = () => new Map<string, number>(days.map((day) => [day, 0]));
    const success = blank();
    const failed = blank();
    const duplicate = blank();
    for (const batch of chartBatches) {
      const day = dayKey(batch.at);
      if (!success.has(day)) continue;
      success.set(day, (success.get(day) ?? 0) + batch.success);
      failed.set(day, (failed.get(day) ?? 0) + batch.failed);
      duplicate.set(day, (duplicate.get(day) ?? 0) + batch.duplicate);
    }
    return [
      {
        name: t("reports.importQuality.outcomeSuccess"),
        data: days.map((day) => success.get(day) ?? 0),
        color: CHART_COLORS.success,
      },
      {
        name: t("reports.importQuality.outcomeFailed"),
        data: days.map((day) => failed.get(day) ?? 0),
        color: CHART_COLORS.danger,
      },
      {
        name: t("reports.importQuality.outcomeDuplicate"),
        data: days.map((day) => duplicate.get(day) ?? 0),
        color: CHART_COLORS.warning,
      },
    ];
  }, [days, chartBatches, t]);

  const [dayDrill, setDayDrill] = useState<{
    day: string;
    seriesName: string;
  } | null>(null);

  // ── 4.2 Top mã lỗi ─────────────────────────────────────────────────────
  const errorCodeItems = useMemo(() => {
    const counter = new Map<string, number>();
    for (const batch of chartBatches) {
      for (const error of batch.errors) {
        counter.set(error.code, (counter.get(error.code) ?? 0) + 1);
      }
    }
    return [...counter.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [chartBatches]);

  const [errorDrill, setErrorDrill] = useState<string | null>(null);
  const errorDrillLines = useMemo(() => {
    if (!errorDrill) return [];
    return chartBatches.flatMap((batch) =>
      batch.errors
        .filter((error) => error.code === errorDrill)
        .map((error) => ({ ...error, batchNo: batch.batchNo })),
    );
  }, [errorDrill, chartBatches]);

  // ── 4.3 Lịch sử Import/Scan & Batch ────────────────────────────────────
  const [resultFilter, setResultFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [batchKeyword, setBatchKeyword] = useState("");
  // §13.10 RPT-OUT-MATCH-01 giữ bộ lọc theo mã SKU: lọc trên tầng dòng đã tải
  // về (batch nào có dòng khớp SKU thì giữ lại) thay vì gửi thêm tham số lên BE
  // — cả trang này đã tải trọn tập theo kỳ nên lọc tại client là chính xác và
  // không phát sinh round-trip.
  const [skuKeyword, setSkuKeyword] = useState("");
  const [openBatch, setOpenBatch] = useState<BatchRecord | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const statusOptions = useMemo(() => {
    const values = new Set(
      batches.map((batch) => batch.status).filter((value) => value !== ""),
    );
    return [...values].sort().map((value) => ({
      value,
      label: reportStatusLabel(value),
    }));
  }, [batches]);

  const actorOptions = useMemo(() => {
    const values = new Set(
      batches.map((batch) => batch.actor).filter((value) => value !== ""),
    );
    return [...values]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((value) => ({ value, label: value }));
  }, [batches]);

  const filteredBatches = useMemo(() => {
    const keyword = batchKeyword.trim().toLowerCase();
    const sku = skuKeyword.trim().toLowerCase();
    return chartBatches.filter((batch) => {
      if (resultFilter === "SUCCESS" && batch.success === 0) return false;
      if (resultFilter === "FAILED" && batch.failed === 0) return false;
      if (resultFilter === "DUPLICATE" && batch.duplicate === 0) return false;
      if (statusFilter && batch.status !== statusFilter) return false;
      if (actorFilter && batch.actor !== actorFilter) return false;
      if (keyword && !batch.batchNo.toLowerCase().includes(keyword)) {
        return false;
      }
      if (sku) {
        const hit = batch.matchLines.some((line) =>
          text(line.sku_code, "").toLowerCase().includes(sku),
        );
        if (!hit) return false;
      }
      return true;
    });
  }, [
    chartBatches,
    resultFilter,
    statusFilter,
    actorFilter,
    batchKeyword,
    skuKeyword,
  ]);

  const pagination = useClientPagination(filteredBatches, 15);

  const downloadErrorFile = async (batch: BatchRecord) => {
    setDownloading(batch.id);
    try {
      const { blob, fileName } = await http.downloadFile(
        API_ENDPOINTS.SKU_IMPORT_REPORT_ERROR_FILE.replace(":id", batch.id),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName ?? `loi-import-${batch.batchNo}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t("reports.importQuality.errorFileDownloaded"));
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, t("reports.importQuality.errorFileFailed")),
      );
    } finally {
      setDownloading(null);
    }
  };

  const totals = useMemo(() => {
    return chartBatches.reduce(
      (acc, batch) => ({
        total: acc.total + batch.total,
        success: acc.success + batch.success,
        failed: acc.failed + batch.failed,
        duplicate: acc.duplicate + batch.duplicate,
      }),
      { total: 0, success: 0, failed: 0, duplicate: 0 },
    );
  }, [chartBatches]);

  const loading = importMatch.isLoading || skuImports.isLoading;

  return (
    <Box data-testid="rpt-tab-import-quality">
      <ReportSectionHeading
        id="rpt-tab4-heading"
        title={t("reports.importQuality.title")}
        description={t("reports.importQuality.description")}
      />

      <FilterBar
        label={t("reports.importQuality.chartFilterLabel")}
        hint={t("reports.importQuality.chartFilterHint", {
          label: period.label,
          count: fmt(chartBatches.length),
        })}
      >
        <PeriodFilterControls state={period} />
        <ItemKindFilter value={itemKind} onChange={setItemKind} />
        <UiSelect
          minWidth={200}
          aria-label={t("reports.importQuality.sourceAria")}
          value={source}
          onChange={setSource}
          options={sourceOptions(t)}
        />
      </FilterBar>

      {period.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">{t("reports.common.dateOrderError")}</UiAlert>
        </Box>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label={t("reports.importQuality.kpiTotalRows")}
          value={fmt(totals.total)}
          tone="primary"
          icon={<AuditOutlined />}
        />
        <ReportKpi
          label={t("reports.importQuality.outcomeSuccess")}
          value={fmt(totals.success)}
          tone="success"
          icon={<CheckCircleOutlined />}
          hint={pct(totals.success, totals.total)}
        />
        <ReportKpi
          label={t("reports.importQuality.outcomeFailed")}
          value={fmt(totals.failed)}
          tone="error"
          icon={<CloseCircleOutlined />}
          hint={pct(totals.failed, totals.total)}
          onClick={() => setResultFilter("FAILED")}
        />
        <ReportKpi
          label={t("reports.importQuality.outcomeDuplicate")}
          value={fmt(totals.duplicate)}
          tone="warning"
          icon={<CopyOutlined />}
          hint={pct(totals.duplicate, totals.total)}
          onClick={() => setResultFilter("DUPLICATE")}
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title={t("reports.importQuality.dailyTitle")}
          description={t("reports.importQuality.dailyDescription")}
          loading={loading}
          error={importMatch.error ?? skuImports.error}
          onRetry={() => {
            void importMatch.refetch();
            void skuImports.refetch();
          }}
          empty={days.length === 0 || totals.total === 0}
          emptyText={t("reports.importQuality.dailyEmpty")}
        >
          <MultiSeriesBarChart
            stacked
            categories={days.map(axisDayLabel)}
            series={dailySeries}
            height={320}
            valueFormatter={fmt}
            onSelect={(payload) =>
              setDayDrill({
                day: days[payload.categoryIndex] ?? "",
                seriesName: payload.seriesName,
              })
            }
          />
        </ChartCard>

        <ChartCard
          title={t("reports.importQuality.topErrorsTitle")}
          description={t("reports.importQuality.topErrorsDescription")}
          loading={loading}
          error={importMatch.error}
          onRetry={() => void importMatch.refetch()}
          empty={errorCodeItems.length === 0}
          emptyText={t("reports.importQuality.topErrorsEmpty")}
          toolbar={
            <SegmentedToggle
              label={t("reports.importQuality.topErrorsCount")}
              value={topErrors}
              onChange={setTopErrors}
              options={TOP_ERROR_OPTIONS}
            />
          }
        >
          <HorizontalBarChart
            items={errorCodeItems}
            limit={Number(topErrors)}
            color={CHART_COLORS.danger}
            valueFormatter={fmt}
            onSelect={(item) => setErrorDrill(item.label)}
          />
        </ChartCard>
      </ChartGrid>

      <ReportSectionHeading
        id="rpt-tab4-batches"
        title={t("reports.importQuality.batchTitle")}
        description={t("reports.importQuality.batchDescription")}
      />

      <FilterBar
        label={t("reports.importQuality.batchFilterLabel")}
        hint={`${fmt(filteredBatches.length)} batch`}
        actions={
          <ExportButtons
            exporting={exporter.exporting}
            disabled={period.invalid || loading}
            onExport={(format) =>
              void exporter.exportReport(format, {
                reportCode: "import-match",
                fileStem: "import-scan-batch",
                fileSuffix: `-${period.from}-${period.to}`,
                filters: {
                  from_date: period.from,
                  to_date: period.to,
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(batchKeyword.trim()
                    ? { keyword: batchKeyword.trim() }
                    : {}),
                },
              })
            }
          />
        }
      >
        <AllOrPickFilter
          value={resultFilter}
          onChange={setResultFilter}
          options={resultOptions(t)}
          allLabel={t("reports.importQuality.outcomeAll")}
          ariaLabel={t("reports.importQuality.outcomeAria")}
        />
        <AllOrPickFilter
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          allLabel={t("reports.importQuality.statusAll")}
          ariaLabel={t("reports.importQuality.statusAria")}
        />
        <AllOrPickFilter
          value={actorFilter}
          onChange={setActorFilter}
          options={actorOptions}
          allLabel={t("reports.importQuality.actorAll")}
          ariaLabel={t("reports.importQuality.actorAria")}
          minWidth={210}
        />
        <SearchInput
          width={260}
          placeholder={t("reports.importQuality.batchOrRequestCode")}
          aria-label={t("reports.importQuality.searchAria")}
          value={batchKeyword}
          onChange={setBatchKeyword}
        />
        <SearchInput
          width={180}
          placeholder={t("reports.importQuality.skuPlaceholder")}
          aria-label={t("reports.importQuality.skuAria")}
          value={skuKeyword}
          onChange={setSkuKeyword}
        />
      </FilterBar>

      {skuImports.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={skuImports.error}
            title={t("reports.importQuality.batchLoadError")}
            onRetry={() => void skuImports.refetch()}
          />
        </Box>
      ) : null}

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title={t("reports.common.exportDenied")}
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      <ResponsiveDataTable<BatchRecord>
        columns={[
          {
            key: "stt",
            header: "STT",
            align: "center",
            width: 56,
            hideOnMobile: true,
            render: (row) =>
              mvpRowNumber(
                pagination.page,
                pagination.perPage,
                rowIndexOf(pagination.pageRows, row),
              ),
          },
          {
            key: "batchNo",
            header: t("reports.importQuality.batchOrRequestCode"),
            sortAccessor: (row) => row.batchNo,
            render: (row) => (
              <Box>
                <Box sx={{ fontWeight: 700 }}>{row.batchNo || EMPTY_TEXT}</Box>
                <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                  {row.source === "IMPORT"
                    ? t("reports.importQuality.sourceSkuImport")
                    : t("reports.importQuality.sourceScan")}
                </Box>
              </Box>
            ),
          },
          {
            key: "at",
            header: t("reports.importQuality.colTime"),
            width: 165,
            sortAccessor: (row) => row.at,
            render: (row) => (row.at ? fmtDateTime(row.at) : EMPTY_TEXT),
          },
          {
            key: "total",
            header: t("reports.importQuality.colTotalRows"),
            align: "right",
            width: 110,
            sortAccessor: (row) => row.total,
            render: (row) => fmt(row.total),
          },
          {
            key: "success",
            header: t("reports.importQuality.colSuccess"),
            align: "right",
            width: 110,
            sortAccessor: (row) => row.success,
            render: (row) => fmt(row.success),
          },
          {
            key: "failed",
            header: t("reports.importQuality.colFailed"),
            align: "right",
            width: 110,
            sortAccessor: (row) => row.failed,
            render: (row) => fmt(row.failed),
          },
          {
            key: "duplicate",
            header: t("reports.importQuality.colDuplicate"),
            align: "right",
            width: 115,
            sortAccessor: (row) => row.duplicate,
            render: (row) => fmt(row.duplicate),
          },
          {
            key: "rate",
            header: t("reports.importQuality.colSuccessRate"),
            align: "right",
            width: 130,
            sortAccessor: (row) =>
              row.total > 0 ? row.success / row.total : 0,
            render: (row) => pct(row.success, row.total),
          },
          {
            key: "actor",
            header: t("reports.importQuality.colActor"),
            hideOnMobile: true,
            render: (row) => row.actor || EMPTY_TEXT,
          },
          {
            key: "status",
            header: t("reports.importQuality.colStatus"),
            width: 150,
            render: (row) => (
              <ReportStatusBadge
                value={row.status}
                label={reportStatusLabel(row.status)}
              />
            ),
          },
        ]}
        rows={pagination.pageRows}
        rowKey={(row) => `${row.source}:${row.id}`}
        loading={loading}
        onRowClick={(row) => setOpenBatch(row)}
        emptyText={t("reports.importQuality.batchEmpty")}
        renderRowActions={(row) => (
          <RowActionGroup>
            <RowActionButton
              kind="view"
              aria-label={t("reports.importQuality.batchRowAria")}
              onClick={() => setOpenBatch(row)}
            ></RowActionButton>
          </RowActionGroup>
        )}
      />
      <ReportPaginationBar
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPerPage}
      />

      {dayDrill ? (
        <DrillDownDialog
          title={t("reports.importQuality.dayDrillTitle", {
            series: dayDrill.seriesName,
            date: dayDrill.day,
          })}
          subtitle={t("reports.importQuality.dayDrillSubtitle")}
          onClose={() => setDayDrill(null)}
        >
          <ResponsiveDataTable<BatchRecord>
            columns={[
              {
                key: "batchNo",
                header: t("reports.importQuality.colBatchNo"),
                render: (row) => row.batchNo || EMPTY_TEXT,
              },
              {
                key: "success",
                header: t("reports.importQuality.colSuccess"),
                align: "right",
                render: (row) => fmt(row.success),
              },
              {
                key: "failed",
                header: t("reports.importQuality.colFailed"),
                align: "right",
                render: (row) => fmt(row.failed),
              },
              {
                key: "duplicate",
                header: t("reports.importQuality.colDuplicate"),
                align: "right",
                render: (row) => fmt(row.duplicate),
              },
              {
                key: "actor",
                header: t("reports.importQuality.colActor"),
                render: (row) => row.actor || EMPTY_TEXT,
              },
            ]}
            rows={chartBatches.filter(
              (batch) => dayKey(batch.at) === dayDrill.day,
            )}
            rowKey={(row) => `${row.source}:${row.id}`}
            emptyText={t("reports.importQuality.dayDrillEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {errorDrill ? (
        <DrillDownDialog
          title={t("reports.importQuality.errorDrillTitle", {
            code: errorDrill,
          })}
          subtitle={t("reports.importQuality.errorDrillSubtitle", {
            count: fmt(errorDrillLines.length),
          })}
          onClose={() => setErrorDrill(null)}
        >
          <ResponsiveDataTable<ErrorLine & { batchNo: string }>
            columns={[
              {
                key: "batchNo",
                header: t("reports.importQuality.colBatchNo"),
                render: (row) => row.batchNo || EMPTY_TEXT,
              },
              {
                key: "rowNo",
                header: t("reports.importQuality.colErrorRow"),
                render: (row) => row.rowNo,
              },
              {
                key: "code",
                header: t("reports.importQuality.colErrorCode"),
                render: (row) => row.code,
              },
              {
                key: "message",
                header: t("reports.importQuality.colErrorMessage"),
                render: (row) => row.message || EMPTY_TEXT,
              },
              {
                key: "reference",
                header: t("reports.importQuality.colSkuOrPhysical"),
                render: (row) => row.reference || EMPTY_TEXT,
              },
              {
                key: "request",
                header: "Request",
                render: (row) => row.request || EMPTY_TEXT,
              },
              {
                key: "at",
                header: t("reports.importQuality.colTime"),
                render: (row) => (row.at ? fmtDateTime(row.at) : EMPTY_TEXT),
              },
            ]}
            rows={errorDrillLines}
            rowKey={(row) => `${row.batchNo}-${row.rowNo}-${row.code}`}
            emptyText={t("reports.importQuality.errorDrillEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {openBatch ? (
        <DrillDownDialog
          title={t("reports.importQuality.batchDetailTitle", {
            code: openBatch.batchNo,
          })}
          subtitle={t("reports.importQuality.batchDetailSubtitle", {
            source:
              openBatch.source === "IMPORT"
                ? t("reports.importQuality.sourceSkuImport")
                : t("reports.importQuality.sourceScan"),
            total: fmt(openBatch.total),
            rate: pct(openBatch.success, openBatch.total),
          })}
          onClose={() => setOpenBatch(null)}
        >
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
            <UiStatusBadge
              size="small"
              tone="success"
              label={t("reports.importQuality.badgeSuccess", {
                count: fmt(openBatch.success),
              })}
            />
            <UiStatusBadge
              size="small"
              tone="error"
              label={t("reports.importQuality.badgeFailed", {
                count: fmt(openBatch.failed),
              })}
            />
            <UiStatusBadge
              size="small"
              tone="warning"
              label={t("reports.importQuality.badgeDuplicate", {
                count: fmt(openBatch.duplicate),
              })}
            />
            {openBatch.errorFileAvailable ? (
              <ActionButton
                kind="download"
                loading={downloading === openBatch.id}
                onClick={() => void downloadErrorFile(openBatch)}
              >
                {t("reports.importQuality.downloadErrorFile")}
              </ActionButton>
            ) : null}
          </Box>
          <ResponsiveDataTable<ErrorLine>
            columns={[
              {
                key: "rowNo",
                header: t("reports.importQuality.colErrorRow"),
                render: (row) => row.rowNo,
              },
              {
                key: "code",
                header: t("reports.importQuality.colErrorCode"),
                render: (row) => row.code,
              },
              {
                key: "message",
                header: t("reports.importQuality.colErrorMessage"),
                render: (row) => row.message || EMPTY_TEXT,
              },
              {
                key: "reference",
                header: t("reports.importQuality.colSkuOrPhysical"),
                render: (row) => row.reference || EMPTY_TEXT,
              },
              {
                key: "request",
                header: "Request",
                render: (row) => row.request || EMPTY_TEXT,
              },
              {
                key: "at",
                header: t("reports.importQuality.colTime"),
                render: (row) => (row.at ? fmtDateTime(row.at) : EMPTY_TEXT),
              },
            ]}
            rows={openBatch.errors}
            rowKey={(row) => `${row.rowNo}-${row.code}-${row.reference}`}
            emptyText={t("reports.importQuality.batchErrorsEmpty")}
          />
          {openBatch.matchLines.length > 0 ? (
            <>
              <Box
                sx={{ typography: "subtitle2", fontWeight: 700, mt: 2, mb: 1 }}
              >
                {t("reports.importQuality.requestLinesTitle")}
              </Box>
              <ResponsiveDataTable<Raw>
                columns={[
                  {
                    key: "row_no",
                    header: t("reports.importQuality.colRow"),
                    align: "right",
                    width: 80,
                    render: (row) => text(row.row_no),
                  },
                  {
                    key: "source_request_no",
                    header: t("reports.importQuality.colRequestNo"),
                    render: (row) => text(row.source_request_no),
                  },
                  {
                    key: "sku_code",
                    header: t("reports.importQuality.colSkuCode"),
                    render: (row) => text(row.sku_code),
                  },
                  {
                    key: "required_qty",
                    header: t("reports.importQuality.colRequired"),
                    align: "right",
                    render: (row) => fmt(row.required_qty),
                  },
                  {
                    key: "matched_qty",
                    header: t("reports.importQuality.colMatched"),
                    align: "right",
                    render: (row) => fmt(row.matched_qty),
                  },
                  {
                    key: "scanned_qty",
                    header: t("reports.importQuality.colScanned"),
                    align: "right",
                    render: (row) => fmt(row.scanned_qty),
                  },
                  {
                    key: "posted_qty",
                    header: t("reports.importQuality.colPosted"),
                    align: "right",
                    render: (row) => fmt(row.posted_qty),
                  },
                  {
                    key: "validation_status",
                    header: t("reports.importQuality.colCheck"),
                    render: (row) => (
                      <ReportStatusBadge
                        value={row.validation_status}
                        label={reportStatusLabel(row.validation_status)}
                      />
                    ),
                  },
                ]}
                rows={openBatch.matchLines}
                rowKey={(row) => text(row.id, "")}
                emptyText={t("reports.importQuality.requestLinesEmpty")}
              />
            </>
          ) : null}
          {!openBatch.errorFileAvailable && openBatch.errors.length > 0 ? (
            <FormulaNote>{t("reports.importQuality.noErrorFile")}</FormulaNote>
          ) : null}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
