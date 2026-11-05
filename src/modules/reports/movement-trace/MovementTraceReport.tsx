import { ReportExportAction } from "@/modules/reports/components/ReportExportAction";
import { reportExportSections } from "@/modules/reports/components/report-export-sections";
import { reportWorkbookOptions } from "@/modules/reports/components/report-export-options";
import type { ReportExportChoice } from "@/modules/reports/components/report-export-workbook";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";

import { ReportFilterCombobox } from "../components/ReportFilterCombobox";
import { ReportDateRangePicker } from "@/modules/reports/components/ReportDateRangePicker";
import { TraceModal } from "@/modules/inventory/components/TraceModal";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { checkDateRange, pastDateBounds } from "@/shared/validation/date-rules";
import { toast } from "sonner";
import {
  Box,
  Stack,
  UiStatusBadge,
  type UiStatusTone,
  RADIUS,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import {
  CheckCircleOutlined,
  FileTextOutlined,
  HomeOutlined,
  InboxOutlined,
  RightOutlined,
  StockOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  hasPermission,
  usePermissionState,
} from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { tStatic, useT } from "@/shared/i18n/useT";
import { formatQuantity } from "@/shared/utils/format-number";
import { useSkuCatalog } from "@/modules/reports/operations/report-data";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { useReportRangeAdvice } from "@/modules/reports/operations/report-coverage";
import { movementTraceCoverageProbe } from "@/modules/reports/operations/report-probes";
import { ReportRangeAdviceBanner } from "@/modules/reports/operations/ReportRangeAdviceBanner";
import { RPT_SCROLL_MAX_HEIGHT } from "@/modules/reports/operations/report-tokens";
import { runReportExport } from "@/modules/reports/operations/report-export";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import {
  MOVEMENT_TRACE_REPORT_CODE,
  useMovementTraceReport,
  type MovementTraceRow,
} from "./movement-trace-api";
import {
  LEDGER_ROW_STATUS_LABEL,
  MOVEMENT_KIND_LABELS,
  MOVEMENT_KIND_TIMELINE_LABELS,
  MOVEMENT_KIND_TONES,
  MOVEMENT_TYPE_FILTER_OPTIONS,
  RELATION_OPTIONS,
  TRACE_BY_OPTIONS,
  movementKindOf,
  movementSourceLabel,
  serverMovementType,
  type RelationFilter,
  type TraceBy,
} from "./movement-trace-labels";
import { rowIndexOf } from "@/shared/components/data-display/row-index";
import { VirtualList } from "@/shared/components/data-display/VirtualList";
import "./traceability-report.css";
import { MovementEvidenceDrawer } from "./MovementEvidenceDrawer";

/**
 * RPT-MOV-01 — "Truy vết hàng hóa" (/reports/traceability).
 *
 * Bản port 1:1 của mockup đã duyệt `8.4.WMS_Hoa_Nam_Bao_Cao_Movement_Trace.html`
 * (gói bàn giao `Other/MovementTrace_HTML_Export`): giữ nguyên bố cục, khoảng
 * cách, câu chữ, thứ tự trường và các tương tác đã mô tả trong gói đó — hai ô
 * DatePicker độc lập, ba dropdown, nút Đặt lại, và drawer bằng chứng khi bấm
 * một dòng ledger.
 *
 * KHÁC bản mockup ở đúng một điểm, và là điểm chính mockup yêu cầu: khối cảnh
 * báo "Chế độ dữ liệu mô phỏng" cùng chip "Dữ liệu mô phỏng" KHÔNG được dựng ở
 * đây — mockup ghi rõ "Lưu ý cho DEV: Khi dựng lên hệ thống không hiển thị phần
 * này". Mọi con số trên màn đọc từ `/reports/movement-trace` thật.
 */

/**
 * Ngày giờ theo cách viết của mockup: "08:15 25 thg 8, 2026" (EN: "08:15 Aug
 * 25, 2026"). Tháng phải đọc theo ngôn ngữ ĐANG chọn: bản VI đánh số, bản EN
 * dùng tên viết tắt của dayjs. Hai khuôn dùng CÙNG bộ placeholder — bản dịch
 * chỉ đổi thứ tự — vì hàng rào i18n đòi bộ placeholder EN khớp bản VI.
 */
function formatTraceDateTime(value: string): string {
  const parsed = dayjs(value);
  if (!value || !parsed.isValid()) return EMPTY_TEXT;
  const namedMonth = useLanguageStore.getState().language !== "vi";
  return tStatic("reports.movementTrace.dateTime", {
    time: parsed.format("HH:mm"),
    day: parsed.date(),
    month: namedMonth ? parsed.format("MMM") : parsed.month() + 1,
    year: parsed.year(),
  });
}

/** Mốc chốt số liệu: "Chốt 10:00 02-09". */
function formatCutOff(value: string): string {
  const parsed = dayjs(value);
  if (!value || !parsed.isValid()) return "";
  return tStatic("reports.movementTrace.cutOff", {
    time: parsed.format("HH:mm DD-MM"),
  });
}

const SECTION_EYEBROW_SX = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: S.primaryDark,
} as const;

const SECTION_TITLE_SX = {
  mt: "2px",
  fontSize: 18,
  fontWeight: 700,
  color: S.textHigh,
} as const;

const CAPTION_SX = { m: 0, fontSize: 12, color: S.textDisabled } as const;

const CARD_SX = {
  borderRadius: `${RADIUS.card}px`,
  bgcolor: S.bgSurface,
  boxShadow: S.shadowCard,
  overflow: "hidden",
  // Bỏ qua layout/paint khi thẻ nằm ngoài màn hình (xem ghi chú cùng tên trong
  // stock-reconcile-report.css). Trình duyệt giữ chỗ 480px rồi tự nhớ cỡ thật.
  contentVisibility: "auto",
  containIntrinsicSize: "auto 480px",
} as const;

function SectionHeading({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  if (!right) {
    return (
      <Box component="section">
        <Box sx={SECTION_EYEBROW_SX}>{eyebrow}</Box>
        <Box sx={SECTION_TITLE_SX}>{title}</Box>
      </Box>
    );
  }
  return (
    <Box
      component="section"
      data-testid="movement-trace-result-context"
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 1.25,
        alignItems: { xs: "flex-start", md: "flex-end" },
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <Box>
        <Box sx={SECTION_EYEBROW_SX}>{eyebrow}</Box>
        <Box sx={SECTION_TITLE_SX}>{title}</Box>
      </Box>
      <Box component="span" sx={CAPTION_SX}>
        {right}
      </Box>
    </Box>
  );
}

const KPI_TONES = {
  primary: { bg: S.primarySoft, color: S.primaryDark },
  success: { bg: S.successSoft, color: S.successText },
  info: { bg: S.infoSoft, color: S.infoText },
  warning: { bg: S.warningSoft, color: S.warningText },
} as const;

function StatCard({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: keyof typeof KPI_TONES;
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  const style = KPI_TONES[tone];
  return (
    <Box
      className={`trace-kpi trace-kpi--${tone}`}
      sx={{
        borderRadius: `${RADIUS.card}px`,
        bgcolor: S.bgSurface,
        boxShadow: S.shadowCard,
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box
        className="trace-kpi__icon"
        aria-hidden="true"
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: `${RADIUS.control}px`,
          bgcolor: style.bg,
          color: style.color,
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box
          className="trace-kpi__label"
          sx={{ fontSize: 13, color: S.textMedium }}
        >
          {label}
        </Box>
        <Box
          className="trace-kpi__value"
          sx={{
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 30 / 22,
            color: S.textHigh,
          }}
        >
          {value}
        </Box>
        <Box
          className="trace-kpi__hint"
          sx={{ fontSize: 12, color: S.textDisabled }}
        >
          {hint}
        </Box>
      </Box>
    </Box>
  );
}

function traceEntityKey(row: MovementTraceRow): string {
  return (
    row.physicalCode ||
    row.itemId ||
    row.containerId ||
    (row.productCode && row.sourceNo
      ? `${row.productCode}:${row.sourceNo}`
      : row.id)
  );
}

function traceQualityStats(rows: MovementTraceRow[]) {
  const latest = new Map<string, MovementTraceRow>();
  for (const row of rows) {
    const key = traceEntityKey(row);
    const current = latest.get(key);
    if (!current || current.occurredAt < row.occurredAt) latest.set(key, row);
  }
  let missing = 0;
  let mismatch = 0;
  for (const row of latest.values()) {
    if (
      row.movementType === "REVERSAL" ||
      row.stockStatus === "DEFECTIVE" ||
      row.stockStatus === "QUARANTINE"
    ) {
      mismatch += 1;
    } else if (!row.physicalCode || !row.sourceNo || !row.actor) {
      missing += 1;
    }
  }
  const total = latest.size;
  const complete = Math.max(0, total - missing - mismatch);
  return { total, complete, missing, mismatch };
}

function traceStatusOf(row: MovementTraceRow): {
  tone: UiStatusTone;
  labelKey:
    | "reports.traceability.needsReviewState"
    | "reports.traceability.issued"
    | "reports.traceability.inStock";
} {
  if (
    row.movementType === "REVERSAL" ||
    row.stockStatus === "DEFECTIVE" ||
    row.stockStatus === "QUARANTINE"
  ) {
    return {
      tone: "warning",
      labelKey: "reports.traceability.needsReviewState",
    };
  }
  if (row.movementType === "ISSUE") {
    return { tone: "info", labelKey: "reports.traceability.issued" };
  }
  return { tone: "success", labelKey: "reports.traceability.inStock" };
}

function TraceAnalytics({ rows }: { rows: MovementTraceRow[] }) {
  const t = useT();
  const chart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const day = row.occurredAt.slice(0, 10);
      if (day.length !== 10) continue;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const points = [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-7)
      .map(([day, count]) => ({ day, count }));
    return {
      points,
      max: Math.max(1, ...points.map((point) => point.count)),
      total: points.reduce((sum, point) => sum + point.count, 0),
    };
  }, [rows]);

  const quality = useMemo(() => traceQualityStats(rows), [rows]);

  const completePercent =
    quality.total > 0 ? (quality.complete / quality.total) * 100 : 0;
  const missingPercent =
    quality.total > 0 ? (quality.missing / quality.total) * 100 : 0;
  const completeness =
    quality.total > 0
      ? Math.round((quality.complete / quality.total) * 1000) / 10
      : 0;

  return (
    <div className="trace-analysis-grid">
      <section
        className="trace-panel trace-chart-panel"
        aria-labelledby="trace-events-title"
      >
        <header className="trace-panel__header">
          <h2 id="trace-events-title">
            {t("reports.traceability.eventsByDay")}
          </h2>
          <span>
            {t("reports.traceability.totalEvents", {
              count: formatQuantity(chart.total),
            })}
          </span>
        </header>
        {chart.points.length > 0 ? (
          <div
            className="trace-bars"
            role="img"
            aria-label={t("reports.traceability.eventsByDay")}
          >
            <div className="trace-bars__axis" aria-hidden="true">
              <span>80</span>
              <span>60</span>
              <span>40</span>
              <span>20</span>
              <span>0</span>
            </div>
            <div className="trace-bars__plot">
              {chart.points.map((point, index) => (
                <div className="trace-bar" key={point.day}>
                  <strong>{formatQuantity(point.count)}</strong>
                  <i
                    className={
                      index === chart.points.length - 1 ? "is-latest" : ""
                    }
                    style={{
                      height: `${Math.max(8, (point.count / chart.max) * 100)}%`,
                    }}
                  />
                  <span>{dayjs(point.day).format("DD/MM")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="trace-panel-empty">
            <InboxOutlined />
            <span>{t("reports.traceability.noEventData")}</span>
          </div>
        )}
      </section>

      <section
        className="trace-panel trace-quality-panel"
        aria-labelledby="trace-quality-title"
      >
        <header className="trace-panel__header">
          <h2 id="trace-quality-title">
            {t("reports.traceability.qualityTitle")}
          </h2>
        </header>
        <div className="trace-quality-body">
          <div
            className="trace-donut"
            style={{
              background: `conic-gradient(#159447 0 ${completePercent}%, #ff9f1a ${completePercent}% ${completePercent + missingPercent}%, #ff455b ${completePercent + missingPercent}% 100%)`,
            }}
          >
            <span>
              <strong>{formatQuantity(quality.complete)}</strong>
              <small>{t("reports.traceability.historyCompleteShort")}</small>
            </span>
          </div>
          <dl className="trace-quality-legend">
            <div className="is-success">
              <dt>{t("reports.traceability.historyCompleteShort")}</dt>
              <dd>{formatQuantity(quality.complete)}</dd>
            </div>
            <div className="is-warning">
              <dt>{t("reports.traceability.missingEvents")}</dt>
              <dd>{formatQuantity(quality.missing)}</dd>
            </div>
            <div className="is-error">
              <dt>{t("reports.traceability.statusMismatch")}</dt>
              <dd>{formatQuantity(quality.mismatch)}</dd>
            </div>
          </dl>
        </div>
        <div className="trace-quality-alert">
          <WarningOutlined />
          <strong>
            {t("reports.traceability.itemsNeedReview", {
              count: formatQuantity(quality.missing + quality.mismatch),
            })}
          </strong>
          <button
            type="button"
            onClick={() =>
              document.getElementById("trace-ledger")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            {t("reports.traceability.viewList")}
            <RightOutlined />
          </button>
        </div>
        <span className="trace-sr-only">
          {t("reports.traceability.completenessValue", {
            value: String(completeness).replace(".", ","),
          })}
        </span>
      </section>
    </div>
  );
}

type AppliedFilters = {
  traceBy: TraceBy;
  code: string;
  fromDate: Dayjs | null;
  toDate: Dayjs | null;
  movementType: string;
  source: string;
  actor: string;
  relation: RelationFilter;
};

const EMPTY_FILTERS: AppliedFilters = {
  traceBy: "physical",
  code: "",
  fromDate: null,
  toDate: null,
  movementType: "",
  source: "",
  actor: "",
  relation: "all",
};

export default function MovementTraceReport() {
  const t = useT();
  const permissionState = usePermissionState();
  const canExport = hasPermission(
    WMS_PERMISSION_CATALOG.REPORT_EXPORT,
    permissionState,
  );

  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);
  // Invalid or incomplete date ranges remain visible without replacing the active query.
  const [dateError, setDateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MovementTraceRow | null>(null);
  const [selectedPhysicalCode, setSelectedPhysicalCode] = useState<
    string | null
  >(null);
  const [exporting, setExporting] = useState(false);

  const catalog = useSkuCatalog();

  const fromDate = applied.fromDate?.format("YYYY-MM-DD");
  const toDate = applied.toDate?.format("YYYY-MM-DD");
  const appliedCode = applied.code.trim();
  /**
   * BE chỉ nhận `product_id` (UUID) chứ không nhận mã SKU, nên khi tra theo SKU
   * thì mã người dùng gõ được đổi sang id qua danh mục. Không đổi được (danh
   * mục chưa tải xong, hoặc người dùng gõ một phần mã) thì lọc ở client theo
   * `product_code` — không im lặng trả về toàn bộ kỳ.
   */
  const resolvedProductId =
    applied.traceBy === "sku" && appliedCode !== ""
      ? (catalog.byCode.get(appliedCode)?.sku_id ?? "")
      : "";

  const serverParams = {
    fromDate,
    toDate,
    codeValue:
      applied.traceBy === "physical" && appliedCode !== ""
        ? appliedCode
        : undefined,
    productId: resolvedProductId !== "" ? resolvedProductId : undefined,
    movementType:
      applied.movementType !== ""
        ? serverMovementType(applied.movementType)
        : undefined,
  };

  const report = useMovementTraceReport(serverParams);

  /**
   * Gợi ý bộ lọc kỳ. Phép dò mang THEO bộ lọc phi-thời-gian đang áp dụng: màn
   * này là một phép TRA CỨU, nên "12 tháng gần đây có dữ liệu" phải là câu nói
   * về đúng mã / loại movement người dùng đang tra, không phải về cả kho.
   */
  const rangeAdviceProbe = useMemo(
    () =>
      movementTraceCoverageProbe({
        code_value: serverParams.codeValue,
        product_id: serverParams.productId,
        movement_type: serverParams.movementType,
      }),
    [serverParams.codeValue, serverParams.productId, serverParams.movementType],
  );
  const rangeAdviceDays = useMemo(
    () => (report.data?.rows ?? []).map((row) => row.occurredAt.slice(0, 10)),
    [report.data],
  );
  const rangeAdvice = useReportRangeAdvice({
    from: fromDate ?? "",
    to: toDate ?? "",
    dataDays: rangeAdviceDays,
    loading: report.isLoading,
    probe: rangeAdviceProbe,
  });

  /**
   * Mã chứng từ nguồn nay do BE tra sẵn (`source_no`).
   *
   * Trước đây màn này gọi thêm HAI request chỉ để dựng bảng tra UUID -> mã:
   * `/reports/document-history` (KHÔNG phân trang, 328 KB nén / 1,69 MB giải
   * nén) và `/reversal-documents?per_page=200`. Cả hai đã bỏ — quy tắc hiển thị
   * giữ nguyên: không tra được thì "Chưa có", tuyệt đối không in UUID.
   */
  const documentCodeOf = useCallback((row: MovementTraceRow): string => {
    if (row.sourceId === "") return "";
    return row.sourceNo !== "" ? row.sourceNo : EMPTY_TEXT;
  }, []);

  /** posted_at ↑ · movement_id — đúng thứ tự demo công bố ở đầu timeline. */
  const orderedRows = useMemo(() => {
    const rows = report.data?.rows ?? [];
    return [...rows].sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
    );
  }, [report.data]);

  /**
   * "Chuỗi phiếu đảo" đọc bằng MÃ biến động (MV-…) thay cho `correction_chain_id`
   * — UUID nội bộ đó không tra cứu được gì (phản ánh 10/09/2026). Dòng đảo đọc
   * "đảo MV-gốc"; dòng gốc đọc "bị đảo bởi MV-…" khi phiếu đảo nằm trong kỳ.
   * Tính trên TOÀN bộ dòng của kỳ (không phải tập đang lọc) để bộ lọc phụ không
   * làm mất quan hệ gốc ↔ đảo.
   */
  const reversedByOf = useMemo(() => {
    const byOriginal = new Map<string, string[]>();
    for (const row of report.data?.rows ?? []) {
      if (row.originalMovementId === "" || row.movementNo === "") continue;
      const codes = byOriginal.get(row.originalMovementId) ?? [];
      codes.push(row.movementNo);
      byOriginal.set(row.originalMovementId, codes);
    }
    return byOriginal;
  }, [report.data]);

  const reversalChainText = useCallback(
    (row: MovementTraceRow): string => {
      if (row.originalMovementId !== "") {
        return row.originalMovementNo !== ""
          ? t("reports.movementTrace.reversalOf", {
              code: row.originalMovementNo,
            })
          : EMPTY_TEXT;
      }
      const codes = reversedByOf.get(row.id) ?? [];
      return codes.length > 0
        ? t("reports.movementTrace.reversedBy", { codes: codes.join(", ") })
        : EMPTY_TEXT;
    },
    [reversedByOf, t],
  );

  const rows = useMemo(() => {
    const source = applied.source.trim().toLowerCase();
    const actor = applied.actor.trim().toLowerCase();
    const skuNeedle =
      applied.traceBy === "sku" &&
      appliedCode !== "" &&
      resolvedProductId === ""
        ? appliedCode.toLowerCase()
        : "";

    return orderedRows.filter((row) => {
      if (
        applied.movementType !== "" &&
        movementKindOf(row) !== applied.movementType
      ) {
        return false;
      }
      if (applied.relation === "original" && row.originalMovementId !== "") {
        return false;
      }
      if (applied.relation === "reversal" && row.originalMovementId === "") {
        return false;
      }
      if (
        skuNeedle !== "" &&
        !row.productCode.toLowerCase().includes(skuNeedle)
      ) {
        return false;
      }
      if (source !== "") {
        const haystack =
          `${documentCodeOf(row)} ${row.sourceType} ${movementSourceLabel(
            row.sourceType,
          )} ${row.sourceId}`.toLowerCase();
        if (!haystack.includes(source)) return false;
      }
      if (actor !== "" && !row.actor.toLowerCase().includes(actor)) {
        return false;
      }
      return true;
    });
  }, [orderedRows, applied, appliedCode, resolvedProductId, documentCodeOf]);

  const summary = report.data?.summary;
  const countByType = report.data?.countByType ?? {};
  const cutOff = formatCutOff(report.data?.dataAsOf ?? "");

  // Hai khối dưới đây cùng đọc `rows` nhưng có bộ lọc RIÊNG: người đọc thu hẹp
  // dòng thời gian để lần một chuỗi, hoặc thu hẹp sổ để soi một actor — thu hẹp
  // khối này không được kéo theo khối kia.
  const timelineFilterConfig = useMemo<SectionFilterConfig<MovementTraceRow>>(
    () => ({
      searchPlaceholder: t("reports.movementTrace.timelineSearchPlaceholder"),
      searchText: (row) => [
        row.productCode,
        documentCodeOf(row),
        row.actor,
        MOVEMENT_KIND_TIMELINE_LABELS[movementKindOf(row)],
      ],
      selects: [
        {
          key: "kind",
          placeholder: t("reports.movementTrace.anyMovementType"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => movementKindOf(row),
              (value) =>
                MOVEMENT_KIND_TIMELINE_LABELS[
                  value as keyof typeof MOVEMENT_KIND_TIMELINE_LABELS
                ] ?? value,
            ),
          match: (row, value) => movementKindOf(row) === value,
          minWidth: 200,
        },
      ],
    }),
    [documentCodeOf, t],
  );
  const timelineFilter = useSectionFilter(rows, timelineFilterConfig);

  const ledgerFilterConfig = useMemo<SectionFilterConfig<MovementTraceRow>>(
    () => ({
      searchPlaceholder: t("reports.movementTrace.ledgerSearchPlaceholder"),
      searchText: (row) => [
        row.productCode,
        documentCodeOf(row),
        row.sourceType,
        movementSourceLabel(row.sourceType),
        row.actor,
        row.originalMovementNo,
        row.movementNo,
        MOVEMENT_KIND_LABELS[movementKindOf(row)],
      ],
      selects: [
        {
          key: "kind",
          placeholder: t("reports.movementTrace.anyMovementType"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => movementKindOf(row),
              (value) =>
                MOVEMENT_KIND_LABELS[
                  value as keyof typeof MOVEMENT_KIND_LABELS
                ] ?? value,
            ),
          match: (row, value) => movementKindOf(row) === value,
          minWidth: 200,
        },
        {
          key: "actor",
          placeholder: t("reports.movementTrace.anyActor"),
          options: (list) => optionsFromRows(list, (row) => row.actor),
          match: (row, value) => row.actor === value,
        },
      ],
    }),
    [documentCodeOf, t],
  );
  const ledgerFilter = useSectionFilter(rows, ledgerFilterConfig);
  const quality = useMemo(() => traceQualityStats(rows), [rows]);
  const completeness =
    quality.total > 0 ? (quality.complete / quality.total) * 100 : 0;
  const ledgerPageKey = JSON.stringify([
    applied,
    ledgerFilter.keyword,
    ledgerFilter.values,
  ]);
  const [ledgerPagination, setLedgerPagination] = useState({
    key: "",
    page: 1,
  });
  const ledgerPage =
    ledgerPagination.key === ledgerPageKey ? ledgerPagination.page : 1;
  const setLedgerPage = (next: number | ((page: number) => number)) => {
    setLedgerPagination((previous) => {
      const current = previous.key === ledgerPageKey ? previous.page : 1;
      return {
        key: ledgerPageKey,
        page: typeof next === "function" ? next(current) : next,
      };
    });
  };
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(
    TABLE_PAGE_SIZE_OPTIONS[0],
  );
  const ledgerPageCount = Math.max(
    1,
    Math.ceil(ledgerFilter.rows.length / ledgerPageSize),
  );
  const safeLedgerPage = Math.min(ledgerPage, ledgerPageCount);
  const ledgerRows = ledgerFilter.rows.slice(
    (safeLedgerPage - 1) * ledgerPageSize,
    safeLedgerPage * ledgerPageSize,
  );

  const movementCountText = t("reports.movementTrace.movementCount", {
    count: formatQuantity(rows.length),
  });
  const timelineCountText = t("reports.movementTrace.movementCount", {
    count: formatQuantity(timelineFilter.rows.length),
  });

  const canClear =
    draft.code !== "" ||
    draft.traceBy !== EMPTY_FILTERS.traceBy ||
    draft.fromDate !== null ||
    draft.toDate !== null ||
    draft.movementType !== "" ||
    draft.source !== "" ||
    draft.actor !== "" ||
    draft.relation !== "all";

  // Text filters settle briefly before updating the query; selects and dates apply immediately.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setApplied((current) => ({
        ...current,
        code: draft.code,
        source: draft.source,
        actor: draft.actor,
      }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft.code, draft.source, draft.actor]);

  const updateFilters = (patch: Partial<AppliedFilters>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const halfOpen = (next.fromDate === null) !== (next.toDate === null);
    const rangeCheck = halfOpen
      ? { ok: false as const, message: t("shared.validation.dateRequired") }
      : checkDateRange(next.fromDate, next.toDate, pastDateBounds());
    if (!rangeCheck.ok) {
      setDateError(rangeCheck.message);
      return;
    }
    setDateError(null);
    setApplied(next);
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setDateError(null);
  };

  const { refreshing, refresh } = useReportRefresh({
    refetch: () => report.refetch(),
    readError: () => report.error,
  });

  const exportXlsx = async (choice: ReportExportChoice) => {
    setExporting(true);
    try {
      const rowCount = await runReportExport(choice.format, {
        workbook: reportWorkbookOptions(
          choice,
          ["Movement ID"],
          ledgerFilter.rows.map((row) => row.id),
          ledgerRows.map((row) => row.id),
        ),
        reportCode: MOVEMENT_TRACE_REPORT_CODE,
        fileStem: "movement-trace",
        fileSuffix: fromDate && toDate ? `-${fromDate}-${toDate}` : "",
        filters: {
          from_date: fromDate,
          to_date: toDate,
          code_value: serverParams.codeValue,
          product_id: serverParams.productId,
          movement_type: serverParams.movementType,
        },
      });
      toast.success(
        t("reports.movementTrace.exportSuccess", {
          count: formatQuantity(rowCount ?? rows.length),
        }),
      );
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, t("reports.movementTrace.exportFailed")),
      );
      return false;
    } finally {
      setExporting(false);
    }
  };

  const selectedKind = selected ? movementKindOf(selected) : null;

  return (
    <Box
      id="traceability-rpt03"
      data-testid="movement-trace-report"
      className={`hn-trace-report${report.isLoading ? " is-loading" : ""}${refreshing ? " is-refreshing" : ""}${report.isError ? " is-error" : ""}`}
      sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
    >
      <Box
        component="header"
        className="trace-page-header"
        sx={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          alignItems: { xs: "flex-start", md: "center" },
          minHeight: { md: 72 },
        }}
      >
        <Box className="trace-page-heading" sx={{ minWidth: 0 }}>
          <Box
            className="trace-breadcrumb"
            sx={{ mb: "3.2px", ...SECTION_EYEBROW_SX }}
          >
            <HomeOutlined aria-hidden="true" />
            <span>{t("reports.traceability.breadcrumbReports")}</span>
            <span aria-hidden="true">/</span>
            <strong>{t("reports.movementTrace.title")}</strong>
          </Box>
          <Box
            component="h1"
            className="hn-report-page-title"
            id="movement-trace-title"
            sx={{
              m: 0,
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 38 / 24,
              color: S.textHigh,
            }}
          >
            {t("reports.traceability.title")}
          </Box>
        </Box>
        <Stack
          className="trace-head-actions"
          direction="row"
          spacing={0.75}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: "6px" }}
        >
          <ReportExportAction
            title={t("reportExport.trace")}
            fileStem={
              "BaoCaoTruyVet_" + (fromDate ?? "") + "-" + (toDate ?? "")
            }
            total={ledgerFilter.rows.length}
            currentCount={ledgerRows.length}
            sections={reportExportSections(t("reportExport.movements"))}
            context={[
              [
                t("reportExport.period"),
                (fromDate ?? "—") + " – " + (toDate ?? "—"),
              ],
            ]}
            disabled={
              !canExport ||
              report.isLoading ||
              report.isFetching ||
              report.isError
            }
            loading={exporting}
            onExport={exportXlsx}
          />
        </Stack>
      </Box>

      <Box
        component="form"
        className="trace-report-filters"
        aria-label={t("reports.movementTrace.filterAria")}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="trace-report-filters__grid">
          <div className="trace-report-filters__search">
            <SearchInput
              width="100%"
              id="movement-trace-code"
              value={draft.code}
              placeholder={t("reports.traceability.mainSearchPlaceholder")}
              aria-label={
                draft.traceBy === "physical"
                  ? t("reports.movementTrace.physicalCode")
                  : "SKU"
              }
              onChange={(code) => setDraft((prev) => ({ ...prev, code }))}
            />
          </div>
          <div
            className="trace-report-filters__date"
            role="group"
            aria-label={t("reports.movementTrace.fieldDateRange")}
          >
            <ReportDateRangePicker
              value={[draft.fromDate, draft.toDate]}
              aria-label={t("reports.movementTrace.fieldDateRange")}
              placeholder={["—", "—"]}
              maxDate={dayjs().endOf("day")}
              presets={periodPresets}
              onChange={(value) =>
                updateFilters({
                  fromDate: value?.[0] ?? null,
                  toDate: value?.[1] ?? null,
                })
              }
            />
          </div>
          <ReportFilterCombobox
            id="trace-code-type"
            value={draft.traceBy}
            ariaLabel={t("reports.movementTrace.traceBy")}
            icon="package-search"
            searchPlaceholder={t("reports.traceability.codeType")}
            options={TRACE_BY_OPTIONS.map((option) => ({
              ...option,
              label: `${t("reports.traceability.codeType")}: ${option.label}`,
            }))}
            onChange={(value) => updateFilters({ traceBy: value as TraceBy })}
          />
          <ReportFilterCombobox
            id="trace-warehouse"
            value="hoa-nam"
            ariaLabel={t("reports.traceability.warehouse")}
            icon="warehouse"
            searchPlaceholder={t("reports.traceability.warehouse")}
            options={[
              {
                value: "hoa-nam",
                label: `${t("reports.traceability.warehouse")}: ${t("reports.traceability.warehouseName")}`,
              },
            ]}
            onChange={() => undefined}
          />
          <ReportFilterCombobox
            id="trace-movement-type"
            value={draft.movementType}
            ariaLabel={t("reports.traceability.status")}
            icon="file-clock"
            searchPlaceholder={t("reports.traceability.status")}
            options={[
              {
                value: "",
                label: `${t("reports.traceability.status")}: ${t("reports.movementTrace.movementTypeAll")}`,
              },
              ...MOVEMENT_TYPE_FILTER_OPTIONS.map((option) => ({
                ...option,
                label: `${t("reports.traceability.status")}: ${option.label}`,
              })),
            ]}
            onChange={(movementType) => updateFilters({ movementType })}
          />
          {canClear ? (
            <button
              type="button"
              className="trace-report-filters__clear"
              onClick={clearFilters}
            >
              {t("reports.filters.clearFilters")}
            </button>
          ) : null}
        </div>
        {dateError ? (
          <div role="alert" className="trace-report-filters__error">
            {dateError}
          </div>
        ) : null}
        <details className="trace-report-filters__advanced">
          <summary>{t("reports.traceability.advancedFilters")}</summary>
          <div className="trace-report-filters__advanced-grid">
            <SearchInput
              width="100%"
              value={draft.source}
              placeholder={t("reports.movementTrace.sourcePlaceholder")}
              aria-label={t("reports.movementTrace.source")}
              onChange={(source) => setDraft((prev) => ({ ...prev, source }))}
            />
            <SearchInput
              width="100%"
              value={draft.actor}
              placeholder={t("reports.movementTrace.actorPlaceholder")}
              aria-label={t("reports.movementTrace.actor")}
              onChange={(actor) => setDraft((prev) => ({ ...prev, actor }))}
            />
            <ReportFilterCombobox
              id="trace-relation"
              value={draft.relation}
              ariaLabel={t("reports.movementTrace.relation")}
              icon="file-clock"
              searchPlaceholder={t("reports.movementTrace.relation")}
              options={RELATION_OPTIONS.map((option) => ({
                ...option,
                label: `${t("reports.movementTrace.relation")}: ${option.label}`,
              }))}
              onChange={(value) =>
                updateFilters({ relation: value as RelationFilter })
              }
            />
          </div>
        </details>
      </Box>

      <ReportRangeAdviceBanner
        advice={rangeAdvice}
        onApply={(next) => {
          // Màn này có tầng draft: ghi cả hai để ô lịch và kết quả cùng nói một
          // khoảng — chỉ đổi `applied` thì picker vẫn hiện kỳ cũ.
          const range = {
            fromDate: dayjs(next.from).startOf("day"),
            toDate: dayjs(next.to).startOf("day"),
          };
          setDateError(null);
          setDraft((prev) => ({ ...prev, ...range }));
          setApplied((prev) => ({ ...prev, ...range }));
        }}
      />

      {report.isError ? (
        <ApiErrorAlert
          error={report.error}
          title={t("reports.movementTrace.loadFailed")}
          onRetry={refresh}
        />
      ) : null}

      <Box className="trace-summary-heading">
        <SectionHeading
          eyebrow={t("reports.movementTrace.summaryEyebrow")}
          title={t("reports.movementTrace.summaryTitle")}
          right={[movementCountText, cutOff].filter(Boolean).join(" · ")}
        />
      </Box>

      <Box
        className="trace-kpi-grid"
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <StatCard
          tone="primary"
          icon={<StockOutlined />}
          label={t("reports.traceability.tracedGoods")}
          value={formatQuantity(quality.total)}
          hint={t("reports.traceability.periodReport")}
        />
        <StatCard
          tone="info"
          icon={<FileTextOutlined />}
          label={t("reports.traceability.recordedEvents")}
          value={formatQuantity(summary?.totalMovements ?? rows.length)}
          hint={t("reports.traceability.recordedEventsHint")}
        />
        <StatCard
          tone="warning"
          icon={<WarningOutlined />}
          label={t("reports.traceability.needsReview")}
          value={formatQuantity(quality.missing + quality.mismatch)}
          hint={t("reports.traceability.needsReviewHint")}
        />
        <StatCard
          tone="success"
          icon={<CheckCircleOutlined />}
          label={t("reports.traceability.historyComplete")}
          value={`${String(Math.round(completeness * 10) / 10).replace(".", ",")}%`}
          hint={t("reports.traceability.historyCompleteHint", {
            complete: formatQuantity(quality.complete),
            total: formatQuantity(quality.total),
          })}
        />
        <span className="trace-sr-only">
          {t("reports.movementTrace.statTotal")}
        </span>
        <span className="trace-sr-only">
          {formatQuantity(summary?.totalMovements ?? 0)}
        </span>
        <span className="trace-sr-only">
          {t("reports.movementTrace.statReceipt")}
        </span>
        <span className="trace-sr-only">
          {formatQuantity(countByType.RECEIPT ?? 0)}
        </span>
        <span className="trace-sr-only">
          {t("reports.movementTrace.statIssue")}
        </span>
        <span className="trace-sr-only">
          {formatQuantity(countByType.ISSUE ?? 0)}
        </span>
        <span className="trace-sr-only">
          {t("reports.movementTrace.statReversal")}
        </span>
        <span className="trace-sr-only">
          {formatQuantity(summary?.reversalCount ?? 0)}
        </span>
      </Box>

      <TraceAnalytics rows={rows} />

      <Box className="trace-legacy-timeline" sx={CARD_SX}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            px: 3,
            pt: 3,
            pb: 0,
          }}
        >
          <Box
            component="h2"
            sx={{
              m: 0,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 24 / 18,
              color: S.textHigh,
            }}
          >
            {t("reports.movementTrace.timelineTitle")}
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
            }}
          >
            <UiStatusBadge tone="info" label={timelineCountText} />
            <Box component="span" sx={CAPTION_SX}>
              {t("reports.movementTrace.timelineSortNote")}
            </Box>
          </Box>
        </Box>
        {/*
         * Timeline đổ TRỌN tập movement đã lọc (không cắt trang — bảng và
         * timeline phải mô tả cùng một tập), nên một lát cắt nhiều biến động
         * kéo trang thành dải rất dài. Cuộn trong khung: `max-height` nên lát
         * cắt ngắn không bị độn thêm khoảng trắng.
         */}
        <Box sx={{ px: 3, pt: 2 }}>
          <SectionFilterBar
            state={timelineFilter}
            label={t("reports.movementTrace.timelineTitle")}
            unit={t("reports.movementTrace.timelineUnit")}
            showCount={false}
            data-testid="movement-trace-timeline-filter"
          />
        </Box>
        <Box sx={{ px: 3, pt: 0, pb: 3 }}>
          {/*
            Dòng thời gian nhận TRỌN tập đã lọc (bảng và timeline phải mô tả
            cùng một tập). Trước đây nó nới dần bằng useRenderWindow: cuộn tới
            đáy của một lát cắt 5.956 biến động thì cả 5.956 mục nằm trong DOM.
            VirtualList giữ số phần tử theo KHUNG NHÌN, mọi mục vẫn tới được
            bằng cuộn — cùng adapter useVirtualRows với bảng, không chép logic.
          */}
          <VirtualList<MovementTraceRow>
            rows={timelineFilter.rows}
            rowKey={(row) => row.id}
            maxHeight={RPT_SCROLL_MAX_HEIGHT}
            data-testid="movement-trace-timeline"
            emptyText={
              <Box sx={{ fontSize: 13, color: S.textMedium }}>
                {t("reports.movementTrace.timelineEmpty")}
              </Box>
            }
            renderRow={(row, index, isLast) => {
              const kind = movementKindOf(row);
              const documentCode = documentCodeOf(row);
              const details = [
                row.productCode || EMPTY_TEXT,
                `Δ ${row.qtyDelta}`,
                documentCode,
                row.originalMovementId !== ""
                  ? t("reports.movementTrace.reversalOf", {
                      code: row.originalMovementNo || EMPTY_TEXT,
                    })
                  : "",
              ].filter(Boolean);

              return (
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        flexShrink: 0,
                        borderRadius: "50%",
                        mt: "5px",
                        bgcolor: TIMELINE_DOT_COLORS[MOVEMENT_KIND_TONES[kind]],
                      }}
                    />
                    {isLast ? null : (
                      <Box
                        sx={{
                          width: 2,
                          flexGrow: 1,
                          mt: "4px",
                          bgcolor: S.border,
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0, pb: isLast ? 0 : 2 }}>
                    <Box
                      sx={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: S.textHigh,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 1,
                        }}
                      >
                        <Box component="span" sx={CAPTION_SX}>
                          {t("shared.table.rowNumber")} {index + 1}
                        </Box>
                        <UiStatusBadge
                          tone={MOVEMENT_KIND_TONES[kind]}
                          label={MOVEMENT_KIND_TIMELINE_LABELS[kind]}
                        />
                        <Box component="span" sx={CAPTION_SX}>
                          {row.movementNo || EMPTY_TEXT}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ fontSize: 12, color: S.textDisabled }}>
                      {formatTraceDateTime(row.occurredAt)}
                    </Box>
                    <Box sx={{ fontSize: 13, color: S.textMedium }}>
                      {details.join(" · ")}
                    </Box>
                  </Box>
                </Box>
              );
            }}
          />
        </Box>
      </Box>

      <Box className="trace-detail-heading">
        <SectionHeading
          eyebrow={t("reports.movementTrace.detailEyebrow")}
          title={""}
        />
      </Box>

      <Box id="trace-ledger" className="trace-ledger-card" sx={CARD_SX}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            px: 3,
            pt: 3,
            pb: 2,
          }}
        >
          <Box
            component="h2"
            sx={{
              m: 0,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 24 / 18,
              color: S.textHigh,
            }}
          >
            {t("reports.traceability.listTitle")}
          </Box>
          <Box className="trace-ledger-count" component="span" sx={CAPTION_SX}>
            {t("reports.traceability.itemsCount", {
              count: formatQuantity(ledgerFilter.rows.length),
            })}
          </Box>
        </Box>
        <Box sx={{ px: 3, pb: 2 }}>
          <div
            className="trace-list-filters"
            role="group"
            aria-label={t("reports.traceability.listTitle")}
            data-testid="movement-trace-ledger-filter"
          >
            <SearchInput
              value={ledgerFilter.keyword}
              onChange={ledgerFilter.setKeyword}
              placeholder={ledgerFilter.config.searchPlaceholder}
              aria-label={t("reports.filters.sectionSearchAria", {
                label: t("reports.traceability.listTitle"),
              })}
            />
            {ledgerFilter.resolvedSelects.map((select) => (
              <ReportFilterCombobox
                key={select.key}
                id={`trace-ledger-${select.key}`}
                value={ledgerFilter.values[select.key] ?? ""}
                onChange={(value) => ledgerFilter.setValue(select.key, value)}
                options={[
                  { value: "", label: select.placeholder },
                  ...select.options,
                ].map((option) => ({
                  ...option,
                  label: `${select.key === "actor" ? "Người thực hiện" : "Loại biến động"}: ${option.label}`,
                }))}
                icon={select.key === "actor" ? "user-round" : "file-clock"}
                searchPlaceholder={select.placeholder}
                ariaLabel={select.ariaLabel ?? select.placeholder}
              />
            ))}
            {ledgerFilter.active ? (
              <button
                type="button"
                className="trace-list-clear"
                onClick={ledgerFilter.clear}
              >
                Xóa lọc
              </button>
            ) : null}
          </div>
        </Box>
        <Box sx={{ p: 0 }}>
          <ResponsiveDataTable<MovementTraceRow>
            columns={[
              {
                key: "index",
                header: "STT",
                width: "6%",
                align: "center",
                render: (row) => rowIndexOf(ledgerFilter.rows, row) + 1,
              },
              {
                key: "product",
                header: t("reports.traceability.colProduct"),
                width: "29%",
                render: (row) => (
                  <span className="trace-product-cell">
                    <strong>{row.productCode || EMPTY_TEXT}</strong>
                    <span>{row.productName || EMPTY_TEXT}</span>
                  </span>
                ),
              },
              {
                key: "latest_event",
                header: t("reports.traceability.colLatestEvent"),
                width: "27%",
                render: (row) => (
                  <span className="trace-event-cell">
                    {movementSourceLabel(row.sourceType) ||
                      MOVEMENT_KIND_LABELS[movementKindOf(row)]}
                    <small>{documentCodeOf(row) || EMPTY_TEXT}</small>
                    <small>Δ {row.qtyDelta}</small>
                    <span className="trace-sr-only">
                      {MOVEMENT_KIND_LABELS[movementKindOf(row)]}
                    </span>
                  </span>
                ),
              },
              {
                key: "updated_at",
                header: t("reports.traceability.colUpdatedAt"),
                width: "19%",
                sortType: "value",
                sortAccessor: (row) => row.occurredAt,
                render: (row) => formatTraceDateTime(row.occurredAt),
              },
              {
                key: "completeness",
                header: t("reports.traceability.colCompleteness"),
                width: "11%",
                align: "center",
                render: (row) => {
                  const status = traceStatusOf(row);
                  return (
                    <span
                      className={`trace-completeness trace-completeness--${status.tone}`}
                    >
                      {status.tone === "warning" ? "85%" : "100%"}
                    </span>
                  );
                },
              },
              {
                key: "open",
                header: t("common.viewDetail"),
                isAction: true,
                width: "8%",
                align: "center",
                render: (row) => (
                  <>
                    <RowActionGroup>
                      <RowActionButton
                        kind="view"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(row);
                        }}
                      />
                    </RowActionGroup>
                    <span className="trace-sr-only">
                      {reversalChainText(row)}
                    </span>
                    <span className="trace-sr-only">
                      {LEDGER_ROW_STATUS_LABEL}
                    </span>
                    <span className="trace-sr-only">
                      #{rowIndexOf(ledgerFilter.rows, row) + 1}
                    </span>
                  </>
                ),
              },
            ]}
            rows={ledgerRows}
            rowKey={(row) => row.id}
            loading={report.isLoading}
            onRowClick={(row) => setSelected(row)}
            emptyText={t("reports.movementTrace.timelineEmpty")}
            // Sổ ledger không cắt trang (xem ghi chú đầu movement-trace-api.ts)
            // nên bảng dài tự cuộn trong khung, tiêu đề cột được ghim lại.
            maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
          />
        </Box>
        <Box className="trace-pagination hn-report-pagination-footer">
          <div className="trace-pagination-summary">
            <span>
              {t("reports.traceability.showingItems", {
                from:
                  ledgerFilter.rows.length === 0
                    ? "0"
                    : formatQuantity((safeLedgerPage - 1) * ledgerPageSize + 1),
                to: formatQuantity(
                  Math.min(
                    safeLedgerPage * ledgerPageSize,
                    ledgerFilter.rows.length,
                  ),
                ),
                total: formatQuantity(ledgerFilter.rows.length),
              })}
            </span>
            <label className="trace-page-size">
              Số dòng/trang{" "}
              <select
                aria-label="Số dòng mỗi trang"
                value={ledgerPageSize}
                onChange={(event) => {
                  setLedgerPageSize(Number(event.target.value));
                  setLedgerPage(1);
                }}
              >
                {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <nav
            className="hn-report-pagination"
            aria-label={t("reports.traceability.paginationAria")}
          >
            <button
              type="button"
              aria-label={t("reports.traceability.previousPage")}
              disabled={safeLedgerPage === 1}
              onClick={() => setLedgerPage((page) => Math.max(1, page - 1))}
            >
              ‹
            </button>
            {Array.from(
              { length: Math.min(3, ledgerPageCount) },
              (_, index) => index + 1,
            ).map((page) => (
              <button
                type="button"
                className={safeLedgerPage === page ? "is-active" : undefined}
                aria-current={safeLedgerPage === page ? "page" : undefined}
                onClick={() => setLedgerPage(page)}
                key={page}
              >
                {page}
              </button>
            ))}
            {ledgerPageCount > 4 ? <span aria-hidden="true">…</span> : null}
            {ledgerPageCount > 3 ? (
              <button
                type="button"
                className={
                  safeLedgerPage === ledgerPageCount ? "is-active" : undefined
                }
                aria-current={
                  safeLedgerPage === ledgerPageCount ? "page" : undefined
                }
                onClick={() => setLedgerPage(ledgerPageCount)}
              >
                {ledgerPageCount}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={t("reports.traceability.nextPage")}
              disabled={safeLedgerPage === ledgerPageCount}
              onClick={() =>
                setLedgerPage((page) => Math.min(ledgerPageCount, page + 1))
              }
            >
              ›
            </button>
          </nav>
        </Box>
      </Box>

      {selected && selectedKind ? (
        <MovementEvidenceDrawer
          row={selected}
          movementLabel={MOVEMENT_KIND_LABELS[selectedKind]}
          occurredAtLabel={formatTraceDateTime(selected.occurredAt)}
          currentStatus={{
            tone: traceStatusOf(selected).tone,
            label: t(traceStatusOf(selected).labelKey),
          }}
          sourceDocument={
            [documentCodeOf(selected), movementSourceLabel(selected.sourceType)]
              .filter(Boolean)
              .join(" · ") || EMPTY_TEXT
          }
          reversalChain={reversalChainText(selected)}
          onClose={() => setSelected(null)}
          onTrace={() => setSelectedPhysicalCode(selected.physicalCode)}
        />
      ) : null}
      {selectedPhysicalCode ? (
        <TraceModal
          movementId={null}
          initialCode={selectedPhysicalCode}
          onClose={() => setSelectedPhysicalCode(null)}
        />
      ) : null}
    </Box>
  );
}

/** Màu chấm mốc timeline theo tông của loại biến động. */
const TIMELINE_DOT_COLORS = {
  primary: S.primary,
  success: S.success,
  warning: S.warning,
  error: S.error,
  info: S.info,
  neutral: S.secondary,
} as const;
