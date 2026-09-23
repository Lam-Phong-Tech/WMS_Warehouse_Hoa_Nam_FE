import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useTabView } from "@/shared/ui/use-tab-view";
import { toast } from "sonner";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiSelect,
  UiSpinner,
  UiStatusBadge,
  UiVuexyDateRangePicker,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
  FILTER_GRID_COLUMNS_SX,
  filterGridColumnSx,
} from "@/shared/ui";
import {
  BarChartOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  StockOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { ActionButton } from "@/shared/components/actions";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { useT } from "@/shared/i18n/useT";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  IMPORT_MATCH_ERROR_LABELS,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import {
  API_DATE,
  axisDayLabel,
  fmt,
  fmtDateTime,
  listOf,
  n,
  pct,
  presetRange,
  text,
  type ItemKind,
  type Raw,
} from "@/modules/reports/operations/report-format";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import {
  useImportMatch,
  useSkuCatalog,
  useSkuImportReports,
  useUserDirectory,
} from "@/modules/reports/operations/report-data";
import {
  RPT_CONTROL_MOTION_SX,
  RPT_SCROLL_MAX_HEIGHT,
} from "@/modules/reports/operations/report-tokens";
import { reportStatusLabel } from "@/modules/reports/operations/report-labels";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { useReportRangeAdvice } from "@/modules/reports/operations/report-coverage";
import { IMPORT_MATCH_COVERAGE_PROBE } from "@/modules/reports/operations/report-probes";
import { ReportRangeAdviceBanner } from "@/modules/reports/operations/ReportRangeAdviceBanner";
import { ReportStatusBadge } from "@/modules/reports/operations/report-drilldown";
import { ReportPaginationBar } from "@/modules/reports/operations/report-table";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { useClientPagination } from "@/modules/reports/operations/report-columns";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import { ExportButtons } from "@/modules/reports/operations/report-filters";
import { useReportExport } from "@/modules/reports/operations/report-export";
import {
  buildImportBatches,
  buildMatchBatches,
  errorCodeCounts,
  filterBatches,
  firstBatchWithErrorCode,
  sortByNewest,
  totalsOf,
  trendByDay,
  CONTEXT_KEY_LABEL,
  CONTEXT_LABEL,
  type BatchErrorLine,
  type ImportMatchBatch,
  type ImportMatchContext,
  type ImportMatchResultFilter,
} from "./import-match-model";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

/** Ngày hiển thị theo chuẩn dự án (dd-MM-yyyy), không phải dd/MM của bản HTML. */
const DISPLAY_DATE = "DD-MM-YYYY";

const REPORT_SURFACE_SX = {
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: 10,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
} as const;

const KPI_TONES = {
  primary: { accent: S.primary, surface: S.primarySoft, text: S.primaryDark },
  success: { accent: S.success, surface: S.successSoft, text: S.successText },
  warning: { accent: S.warning, surface: S.warningSoft, text: S.warningText },
  error: { accent: S.error, surface: S.errorSoft, text: S.errorText },
} as const;

type MetricTone = keyof typeof KPI_TONES;

const tabSx = (active: boolean) => ({
  flex: 1,
  minWidth: 0,
  height: 38,
  px: 1.5,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 0.75,
  border: 0,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: active ? S.primary : "transparent",
  color: active ? S.onPrimary : S.textMedium,
  boxShadow: active ? S.shadowCard : "none",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  // `transition: all` sẽ animate cả thuộc tính layout khi tab đổi trạng thái
  // (gây giật) — dùng bộ transition liệt kê tường minh dùng chung của module.
  ...RPT_CONTROL_MOTION_SX,
  "&:hover": {
    bgcolor: active ? S.primaryDark : S.primarySoft,
    color: active ? S.onPrimary : S.primaryDark,
  },
  "&:focus-visible": { outline: `2px solid ${S.primary}`, outlineOffset: 2 },
});

/** Tiêu đề khối "eyebrow + h2 + mô tả", chú thích phụ nằm bên phải. */
function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  meta,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: { xs: "flex-start", sm: "flex-end" },
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1,
        mb: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: S.primaryDark,
          }}
        >
          {eyebrow}
        </Box>
        <Box
          component="h2"
          id={id}
          sx={{
            m: 0,
            mt: 0.25,
            fontSize: TYPOGRAPHY.cardTitle.fontSize,
            fontWeight: 700,
            lineHeight: 1.3,
            color: S.textHigh,
          }}
        >
          {title}
        </Box>
        <Box sx={{ mt: 0.5, fontSize: 12, color: S.textMedium }}>
          {description}
        </Box>
      </Box>
      {meta ? (
        <Box sx={{ fontSize: 12, fontWeight: 600, color: S.textMedium }}>
          {meta}
        </Box>
      ) : null}
    </Stack>
  );
}

/**
 * Thẻ KPI của baseline 8.5: nhãn + icon, số lớn, dòng chú thích và dấu màu
 * nhận diện trạng thái.
 */
function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  onActivate,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactElement;
  tone: MetricTone;
  onActivate?: () => void;
}) {
  const style = KPI_TONES[tone];
  const actionable = Boolean(onActivate);
  return (
    <Box
      {...(actionable
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onActivate,
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate?.();
              }
            },
          }
        : {})}
      sx={{
        ...REPORT_SURFACE_SX,
        position: "relative",
        overflow: "hidden",
        p: { xs: 1.5, sm: 1.75, md: 2 },
        minHeight: { xs: 118, md: 126 },
        display: "flex",
        flexDirection: "column",
        bgcolor: S.bgSurface,
        cursor: actionable ? "pointer" : "default",
        transition: "transform 140ms ease, box-shadow 140ms ease",
        ...(actionable
          ? {
              "&:hover, &:focus-visible": {
                transform: "translateY(-2px)",
                outline: 0,
                boxShadow: S.shadowFloating,
              },
            }
          : {}),
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Box
          sx={{
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            fontWeight: 700,
            letterSpacing: "0.025em",
            textTransform: "uppercase",
            color: S.textHigh,
          }}
        >
          {label}
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: 34,
            height: 34,
            flex: "none",
            display: "grid",
            placeItems: "center",
            borderRadius: `${RADIUS.control}px`,
            bgcolor: style.surface,
            color: style.text,
            fontSize: 17,
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Box
        sx={{
          mt: 1,
          fontSize: "clamp(24px, 2vw, 30px)",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.025em",
          color: S.textHigh,
        }}
      >
        {value}
      </Box>
      <Stack
        direction="row"
        sx={{
          mt: "auto",
          pt: 1.25,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ fontSize: 12, lineHeight: 1.35, color: S.textMedium }}>
          {hint}
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: 8,
            height: 8,
            flex: "none",
            borderRadius: "50%",
            bgcolor: style.accent,
          }}
        />
      </Stack>
    </Box>
  );
}

function PanelCard({
  title,
  description,
  icon,
  iconTone = "primary",
  toolbar,
  loading,
  error,
  onRetry,
  empty,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  icon: ReactElement;
  iconTone?: "primary" | "error";
  toolbar?: ReactNode;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  const t = useT();
  const iconStyle =
    iconTone === "error"
      ? { bgcolor: S.errorSoft, color: S.errorText }
      : { bgcolor: S.primarySoft, color: S.primaryDark };
  return (
    <Box
      component="article"
      sx={{
        ...REPORT_SURFACE_SX,
        p: { xs: 2, md: 2.5 },
        minHeight: { md: 360 },
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 34,
              height: 34,
              flex: "none",
              display: "grid",
              placeItems: "center",
              borderRadius: `${RADIUS.control}px`,
              fontSize: 16,
              ...iconStyle,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                fontSize: TYPOGRAPHY.fontSizeBody,
                fontWeight: 700,
                color: S.textHigh,
              }}
            >
              {title}
            </Box>
            <Box
              sx={{
                mt: 0.25,
                fontSize: 12,
                lineHeight: 1.45,
                color: S.textMedium,
              }}
            >
              {description}
            </Box>
          </Box>
        </Stack>
        {toolbar ? <Box sx={{ flex: "none" }}>{toolbar}</Box> : null}
      </Stack>
      {error ? (
        <ApiErrorAlert
          error={error}
          title={t("reports.importMatchReport.panelLoadFailed", { title })}
          onRetry={onRetry}
        />
      ) : loading ? (
        <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}>
          <UiSpinner />
        </Box>
      ) : empty ? (
        <Box
          sx={{
            minHeight: 260,
            display: "grid",
            placeItems: "center",
            px: 3,
            textAlign: "center",
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          {emptyText}
        </Box>
      ) : (
        <Box
          sx={{ flex: 1, minWidth: 0, display: "grid", alignItems: "stretch" }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}

function FilterField({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: ReactNode;
  span?: number;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        // Ô `span 2` của mockup (khoảng ngày, ô tìm dài) chiếm 2 cột lưới.
        gridColumn: filterGridColumnSx(span >= 2),
        "& .MuiFormControl-root, & .MuiTextField-root, & .ant-picker": {
          width: "100%",
          minWidth: 0,
        },
        "& .MuiTextField-root": { maxWidth: "none" },
      }}
    >
      <Box
        sx={{
          mb: 0.65,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: "18px",
          color: S.textMedium,
        }}
      >
        {label}
      </Box>
      {children}
    </Box>
  );
}

/** Thẻ "Lát cắt" — bản card của đúng những con số đang có trong bảng. */
function SliceCard({
  batch,
  index,
  onOpen,
}: {
  batch: ImportMatchBatch;
  index: number;
  onOpen: () => void;
}) {
  const t = useT();
  const values: Array<[string, string]> = [
    [t("reports.importMatchReport.cardTotal"), fmt(batch.total)],
    [t("reports.importMatchReport.cardValid"), fmt(batch.success)],
    [t("reports.importMatchReport.cardFailed"), fmt(batch.failed)],
    [t("reports.importMatchReport.cardDuplicate"), fmt(batch.duplicate)],
    [t("reports.importMatchReport.cardRate"), pct(batch.success, batch.total)],
  ];
  return (
    <Box
      component="article"
      sx={{
        ...REPORT_SURFACE_SX,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              fontSize: TYPOGRAPHY.fontSizeSecondary,
              fontWeight: 700,
              color: S.textHigh,
              overflowWrap: "anywhere",
            }}
          >
            {t("reports.importMatchReport.cardSliceLabel", {
              index: String(index + 1).padStart(2, "0"),
              code: batch.batchNo || EMPTY_TEXT,
            })}
          </Box>
          <Box sx={{ mt: 0.25, fontSize: 12, color: S.textMedium }}>
            {`${batch.at ? fmtDateTime(batch.at) : EMPTY_TEXT} · ${batch.actor || EMPTY_TEXT}`}
          </Box>
        </Box>
        <ReportStatusBadge
          value={batch.status}
          label={reportStatusLabel(batch.status)}
        />
      </Stack>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(78px, 1fr))",
          gap: 1,
        }}
      >
        {values.map(([term, value]) => (
          <Box key={term} sx={{ display: "grid", gap: 0.25 }}>
            <Box component="dt" sx={{ fontSize: 11, color: S.textMedium }}>
              {term}
            </Box>
            <Box
              component="dd"
              sx={{
                m: 0,
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                fontWeight: 700,
                color: S.textHigh,
              }}
            >
              {value}
            </Box>
          </Box>
        ))}
      </Box>
      <Box>
        <RowActionGroup>
          <RowActionButton kind="detail" onClick={onOpen}>
            {t("reports.importMatchReport.viewDetail")}
          </RowActionButton>
        </RowActionGroup>
      </Box>
    </Box>
  );
}

/**
 * RPT-04 — Báo cáo Import & Match (route `/reports/import-quality`).
 *
 * Port 1:1 giao diện đã duyệt `8.5.WMS_Hoa_Nam_Bao_Cao_Import_Match.html`:
 * hai ngữ cảnh Import/Migration ↔ Đối soát yêu cầu xuất, dải "lát cắt đang
 * xem", bộ lọc phân tích, 4 KPI (2 KPI lọc được), biểu đồ diễn biến + Top mã
 * lỗi, và nhật ký batch xem theo Bảng hoặc Lát cắt với drill-down từng batch.
 * Toàn bộ số liệu đến từ API thật; không có ô nào dựng sẵn.
 */
export default function ImportMatchReport() {
  const t = useT();
  const resultOptions = useMemo(
    () => [
      { value: "", label: t("reports.importMatchReport.optResultAll") },
      {
        value: "SUCCESS",
        label: t("reports.importMatchReport.optResultSuccess"),
      },
      {
        value: "FAILED",
        label: t("reports.importMatchReport.optResultFailed"),
      },
      {
        value: "DUPLICATE",
        label: t("reports.importMatchReport.optResultDuplicate"),
      },
    ],
    [t],
  );
  const kindOptions = useMemo(
    () => [
      { value: "all", label: t("reports.importMatchReport.optKindAll") },
      {
        value: "PRODUCT",
        label: t("reports.importMatchReport.optKindProduct"),
      },
      {
        value: "COMPONENT",
        label: t("reports.importMatchReport.optKindComponent"),
      },
    ],
    [t],
  );
  const topOptions = useMemo(
    () => [
      { value: "10", label: t("reports.importMatchReport.optTop10") },
      { value: "20", label: t("reports.importMatchReport.optTop20") },
    ],
    [t],
  );
  const [context, setContext] = useState<ImportMatchContext>("IMPORT");
  /**
   * Đổi tab KHÔNG khoá luồng chính: `shownView` (tab đang sáng) cập nhật ở mức GẤP
   * nên người dùng thấy phản hồi ngay, còn `view` — thứ quyết định panel nào
   * được dựng — cập nhật trong transition để React nhường luồng chính. Xem
   * @/shared/ui/use-tab-view.
   */
  const viewTab = useTabView<"table" | "snapshot">("table");
  const view = viewTab.view;
  const shownView = viewTab.shown;
  const setView = viewTab.select;
  /**
   * Tab đổi view: nút bấm đọc `view` (cập nhật GẤP → tô sáng tức thì), còn các
   * PANEL nặng đọc `deferredView` (bản trễ, React vẽ ở lượt ngắt được). Đo trước khi
   * sửa (Playwright, CPU x4): một cú bấm "Dạng hộp" khoá luồng chính tới ~930 ms
   * vì panel mới (bảng hàng trăm dòng / lưới thẻ) phải layout + paint trọn một
   * lượt cùng lúc với việc tô sáng tab. Tách hai lượt thì tab phản hồi ngay,
   * panel theo sau.
   */
  const deferredView = useDeferredValue(view);

  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() =>
    presetRange("this-month"),
  );
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const [result, setResult] = useState<ImportMatchResultFilter>("");
  const [status, setStatus] = useState("");
  const [actor, setActor] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sku, setSku] = useState("");
  const [kind, setKind] = useState<ItemKind>("all");
  const [top, setTop] = useState<"10" | "20">("10");
  const [openBatch, setOpenBatch] = useState<ImportMatchBatch | null>(null);
  const [dayDrill, setDayDrill] = useState<{
    day: string;
    seriesName: string;
  } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const from = range[0].format(API_DATE);
  const to = range[1].format(API_DATE);
  const invalid = range[0].isAfter(range[1], "day");

  const catalog = useSkuCatalog();
  const users = useUserDirectory();
  const exporter = useReportExport();
  const importMatch = useImportMatch({ from, to, enabled: !invalid });
  const skuImports = useSkuImportReports({ enabled: !invalid });

  const activeQuery = context === "IMPORT" ? skuImports : importMatch;
  const loading = activeQuery.isLoading;

  const contextBatches = useMemo<ImportMatchBatch[]>(() => {
    if (context === "IMPORT") {
      return sortByNewest(
        buildImportBatches(
          listOf(skuImports.data?.data),
          (actorId) =>
            users.entries.find((entry) => entry.user_id === actorId)?.name ??
            "",
        ),
      );
    }
    return sortByNewest(buildMatchBatches(importMatch.data));
  }, [context, skuImports.data, importMatch.data, users.entries]);

  const batches = useMemo(
    () =>
      filterBatches(
        contextBatches,
        { from, to, result, status, actor, keyword, sku, kind },
        (code) => catalog.kindOfCode(code),
      ),
    [
      contextBatches,
      from,
      to,
      result,
      status,
      actor,
      keyword,
      sku,
      kind,
      catalog,
    ],
  );

  /**
   * Gợi ý bộ lọc kỳ, tính trên `contextBatches` — tức TRƯỚC các bộ lọc phụ
   * (kết quả, trạng thái, người thực hiện, từ khoá). Lọc phụ ra rỗng là do
   * người dùng chọn, không phải do kỳ chọn sai.
   *
   * Ngữ cảnh IMPORT đọc `/skus/import-reports` — endpoint KHÔNG nhận tham số
   * ngày, màn tự cắt kỳ ở client — nên tập mốc ngoài kỳ đã nằm sẵn trong tay
   * và không cần dò thêm. Ngữ cảnh MATCH thì endpoint đã cắt theo kỳ, phải dò.
   */
  const rangeAdviceDays = useMemo(
    () => contextBatches.map((batch) => batch.at.slice(0, 10)),
    [contextBatches],
  );
  const rangeAdvice = useReportRangeAdvice({
    from,
    to,
    dataDays: rangeAdviceDays,
    loading,
    probe: IMPORT_MATCH_COVERAGE_PROBE,
    knownCoverageDays: context === "IMPORT" ? rangeAdviceDays : null,
  });

  // Tách ra biến để cột STT của drill-down theo ngày đánh số được theo đúng
  // thứ tự dòng đang hiển thị (render của cột chỉ nhận `row`).
  const dayDrillRows = useMemo(
    () =>
      dayDrill === null
        ? []
        : batches.filter((batch) => batch.at.slice(0, 10) === dayDrill.day),
    [batches, dayDrill],
  );

  const totals = useMemo(() => totalsOf(batches), [batches]);
  const trend = useMemo(() => trendByDay(batches), [batches]);
  const errorCodes = useMemo(() => errorCodeCounts(batches), [batches]);
  const topErrorCodes = useMemo(
    () => errorCodes.slice(0, Number(top)),
    [errorCodes, top],
  );
  /**
   * Bộ lọc RIÊNG của khối nhật ký. Đặt SAU khi KPI/biểu đồ đã tính trên
   * batches: thu hẹp danh sách để soi một batch không được làm tụt luôn các
   * con số tổng của kỳ ở phía trên.
   */
  const logFilterConfig = useMemo<SectionFilterConfig<ImportMatchBatch>>(
    () => ({
      searchPlaceholder: t("reports.importMatchReport.logSearchPlaceholder"),
      searchText: (row) => [
        row.batchNo,
        row.caption,
        row.sourceFile,
        row.actor,
      ],
      selects: [
        {
          key: "status",
          placeholder: t("reports.importMatchReport.anyBatchStatus"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.status,
              (value) => reportStatusLabel(value),
            ),
          match: (row, value) => row.status === value,
          minWidth: 195,
        },
        {
          key: "issue",
          placeholder: t("reports.importMatchReport.anyIssue"),
          options: [
            {
              value: "FAILED",
              label: t("reports.importMatchReport.issueFailed"),
            },
            {
              value: "DUPLICATE",
              label: t("reports.importMatchReport.issueDuplicate"),
            },
            {
              value: "CLEAN",
              label: t("reports.importMatchReport.issueClean"),
            },
          ],
          match: (row, value) => {
            if (value === "FAILED") return row.failed > 0;
            if (value === "DUPLICATE") return row.duplicate > 0;
            return row.failed === 0 && row.duplicate === 0;
          },
          minWidth: 200,
        },
      ],
    }),
    [t],
  );
  const logFilter = useSectionFilter(batches, logFilterConfig);
  const pagination = useClientPagination(logFilter.rows, 15);

  const statusOptions = useMemo(
    () => [
      { value: "", label: t("reports.importMatchReport.allStatuses") },
      ...[
        ...new Set(
          contextBatches
            .map((batch) => batch.status)
            .filter((value) => value !== ""),
        ),
      ]
        .sort()
        .map((value) => ({ value, label: reportStatusLabel(value) })),
    ],
    [contextBatches, t],
  );

  const actorOptions = useMemo(
    () => [
      { value: "", label: t("reports.importMatchReport.allActors") },
      ...[
        ...new Set(
          contextBatches
            .map((batch) => batch.actor)
            .filter((value) => value !== ""),
        ),
      ]
        .sort((a, b) => a.localeCompare(b, "vi"))
        .map((value) => ({ value, label: value })),
    ],
    [contextBatches, t],
  );

  const resetContextFilters = () => {
    setResult("");
    setStatus("");
    setActor("");
    setKeyword("");
    setSku("");
    setKind("all");
  };

  const switchContext = (next: ImportMatchContext) => {
    setContext(next);
    resetContextFilters();
    pagination.reset();
  };

  const resetFilters = () => {
    setRange(presetRange("this-month"));
    resetContextFilters();
    setTop("10");
    pagination.reset();
  };

  const { refreshing, refresh } = useReportRefresh({
    refetch: () => Promise.all([importMatch.refetch(), skuImports.refetch()]),
    readError: () => activeQuery.error,
  });

  const applyResultFilter = (next: ImportMatchResultFilter) => {
    setResult(next);
    setView("table");
    setFiltersExpanded(true);
    pagination.reset();
  };

  const openErrorCode = (code: string) => {
    const hit = firstBatchWithErrorCode(batches, code);
    if (hit) setOpenBatch(hit);
  };

  const downloadErrorFile = async (batch: ImportMatchBatch) => {
    setDownloading(batch.id);
    try {
      const { blob, fileName } = await http.downloadFile(
        API_ENDPOINTS.SKU_IMPORT_REPORT_ERROR_FILE.replace(":id", batch.id),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName ?? `loi-nhap-du-lieu-${batch.batchNo}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t("reports.importMatchReport.downloadSuccess"));
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          t("reports.importMatchReport.downloadFailed"),
        ),
      );
    } finally {
      setDownloading(null);
    }
  };

  const showFilters = view === "table" || filtersExpanded;
  const periodLabel = `${range[0].format(DISPLAY_DATE)} → ${range[1].format(DISPLAY_DATE)}`;
  const matchRemaining = Math.max(0, totals.required - totals.matched);
  const keyLabel = CONTEXT_KEY_LABEL[context];
  const maxErrorCount = topErrorCodes[0]?.value ?? 0;

  const series = [
    {
      name: t("reports.importMatchReport.seriesValid"),
      data: trend.map((point) => point.success),
      color: CHART_COLORS.success,
    },
    {
      name: t("reports.importMatchReport.seriesFailed"),
      data: trend.map((point) => point.failed),
      color: CHART_COLORS.danger,
    },
    {
      name: t("reports.importMatchReport.seriesDuplicate"),
      data: trend.map((point) => point.duplicate),
      color: CHART_COLORS.warning,
    },
  ];

  return (
    <Box
      data-testid="rpt-tab-import-quality"
      data-report-screen="RPT-04"
      sx={{
        width: "100%",
        minWidth: 0,
        display: "grid",
        gap: { xs: 1.5, sm: 1.75, md: 2 },
        fontSize: { xs: 13, md: 14 },
        "& > *": { minWidth: 0 },
        "& .hn-vuexy-date-range.ant-picker": {
          borderColor: S.border,
          boxShadow: "none",
        },
        "& .hn-vuexy-date-range.ant-picker:hover": {
          borderColor: S.primary,
        },
        "& .hn-vuexy-date-range.ant-picker-focused": {
          borderColor: S.primary,
          boxShadow: `0 0 0 2px ${S.primarySoft}`,
        },
        "& .hn-vuexy-date-range .ant-picker-active-bar": {
          background: S.primary,
        },
      }}
    >
      {/* ── Tiêu đề trang ────────────────────────────────────────────── */}
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "flex-start", minWidth: 0 }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 42,
              height: 42,
              flex: "none",
              display: "grid",
              placeItems: "center",
              borderRadius: `${RADIUS.card}px`,
              bgcolor: S.primarySoft,
              color: S.primaryDark,
              fontSize: 19,
            }}
          >
            <BarChartOutlined />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: S.primaryDark,
              }}
            >
              {t("reports.importMatchReport.eyebrow")}
            </Box>
            <Box
              component="h1"
              id="rpt-04-title"
              sx={{
                m: 0,
                mt: 0.25,
                fontSize: { xs: 20, sm: 22, md: 24 },
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
                color: S.textHigh,
              }}
            >
              {t("reports.importMatchReport.title")}
            </Box>
            <Box
              sx={{
                mt: 0.5,
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                color: S.textMedium,
              }}
            >
              {t("reports.importMatchReport.subtitle")}
            </Box>
          </Box>
        </Stack>
        <UiStatusBadge
          tone={
            activeQuery.isFetching
              ? "warning"
              : activeQuery.isError
                ? "error"
                : "success"
          }
          label={
            activeQuery.isFetching
              ? t("reports.importMatchReport.syncing")
              : activeQuery.isError
                ? t("reports.importMatchReport.loadError")
                : t("reports.importMatchReport.dataLoaded")
          }
        />
      </Box>

      {/* ── Ngữ cảnh báo cáo ─────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label={t("reports.importMatchReport.contextAria")}
        sx={{
          display: "flex",
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
        }}
      >
        <Box
          role="tablist"
          aria-label={t("reports.importMatchReport.contextAria")}
          sx={{
            width: { xs: "100%", sm: "min(100%, 460px)" },
            p: 0.5,
            display: "flex",
            flexDirection: "row",
            gap: 0.5,
            border: `1px solid ${S.border}`,
            borderRadius: `${RADIUS.card}px`,
            bgcolor: S.bgSubtle,
          }}
        >
          {(["IMPORT", "MATCH"] as const).map((value) => (
            <Box
              key={value}
              component="button"
              type="button"
              role="tab"
              data-report-context={value}
              aria-selected={context === value}
              tabIndex={context === value ? 0 : -1}
              onClick={() => switchContext(value)}
              sx={tabSx(context === value)}
            >
              {CONTEXT_LABEL[value]}
            </Box>
          ))}
        </Box>
        <UiButton
          appearance="outlined"
          startIcon={<ReloadOutlined />}
          loading={refreshing}
          onClick={refresh}
          disabled={invalid || activeQuery.isFetching}
        >
          {t("reports.importMatchReport.refresh")}
        </UiButton>
      </Box>

      {/* ── Dải "lát cắt đang xem" ───────────────────────────────────── */}
      <Box
        component="section"
        aria-label={t("reports.importMatchReport.sliceAria")}
        sx={{
          ...REPORT_SURFACE_SX,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          minHeight: 64,
          px: { xs: 1.75, md: 2 },
          py: 1.5,
          bgcolor: S.bgSurface,
          backgroundImage: "none",
          color: S.textHigh,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            width: 190,
            height: 190,
            right: -64,
            top: -98,
            border: `24px solid ${S.primarySoft}`,
            borderRadius: "50%",
            opacity: 0.45,
          }}
        />
        <Box sx={{ position: "relative", display: "grid", gap: 0.5 }}>
          <Box
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: S.textMedium,
            }}
          >
            {t("reports.importMatchReport.sliceEyebrow")}
          </Box>
          <Box sx={{ fontSize: 18, fontWeight: 700, lineHeight: "26px" }}>
            {CONTEXT_LABEL[context]}
          </Box>
        </Box>
        <Stack
          direction="row"
          sx={{
            position: "relative",
            flexWrap: "wrap",
            justifyContent: { xs: "flex-start", md: "flex-end" },
            gap: "8px 26px",
            fontSize: 13,
          }}
        >
          <Box>
            {t("reports.importMatchReport.periodLabel")}:{" "}
            <strong>{periodLabel}</strong>
          </Box>
          <Box>
            <strong>{fmt(batches.length)}</strong>{" "}
            {t("reports.importMatchReport.batchesInScope")}
          </Box>
        </Stack>
      </Box>

      {/* ── Bộ lọc phân tích ─────────────────────────────────────────── */}
      <Box
        component="section"
        aria-labelledby="rpt-04-filters"
        sx={{
          ...REPORT_SURFACE_SX,
          p: { xs: 1.75, sm: 2, md: 2.25 },
          overflow: "visible",
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 2.25,
          }}
        >
          <Box>
            <Box
              id="rpt-04-filters"
              sx={{
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                fontWeight: 700,
                lineHeight: "22px",
                color: S.textHigh,
              }}
            >
              {t("reports.importMatchReport.filterTitle")}
            </Box>
            <Box sx={{ fontSize: 12, lineHeight: "18px", color: S.textMedium }}>
              {t("reports.importMatchReport.filterMatchCount", {
                count: fmt(batches.length),
                kind:
                  context === "IMPORT"
                    ? t("reports.importMatchReport.importRuns")
                    : t("reports.importMatchReport.matchRuns"),
              })}
            </Box>
          </Box>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 0.75, alignItems: "center" }}
          >
            <ExportButtons
              exporting={exporter.exporting}
              disabled={invalid || loading}
              onExport={(format) =>
                void exporter.exportReport(format, {
                  reportCode: "import-match",
                  fileStem:
                    context === "IMPORT"
                      ? "nhap-du-lieu"
                      : "doi-soat-yeu-cau-xuat",
                  fileSuffix: `-${from}-${to}`,
                  filters: {
                    from_date: from,
                    to_date: to,
                    ...(status ? { status } : {}),
                    ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
                    ...(sku.trim() ? { sku_code: sku.trim() } : {}),
                  },
                })
              }
            />
            {deferredView === "snapshot" ? (
              <UiButton
                appearance="text"
                aria-expanded={filtersExpanded}
                aria-controls="rpt-04-filter-fields"
                onClick={() => setFiltersExpanded((current) => !current)}
              >
                {filtersExpanded
                  ? t("reports.importMatchReport.hideFilters")
                  : t("reports.importMatchReport.showFilters")}
              </UiButton>
            ) : null}
            <UiButton appearance="text" onClick={resetFilters}>
              {t("reports.importMatchReport.reset")}
            </UiButton>
          </Stack>
        </Stack>
        <Box
          id="rpt-04-filter-fields"
          hidden={!showFilters}
          sx={{
            display: showFilters ? "grid" : "none",
            gridTemplateColumns: FILTER_GRID_COLUMNS_SX,
            gap: { xs: "12px", sm: "14px 12px", md: "16px 12px" },
            alignItems: "end",
          }}
        >
          <FilterField label={t("reports.importMatchReport.fieldResult")}>
            <UiSelect
              fullWidth
              aria-label={t("reports.importMatchReport.resultAria")}
              value={result}
              placeholder={t("reports.importMatchReport.optResultAll")}
              onChange={(value) => {
                setResult(value as ImportMatchResultFilter);
                pagination.reset();
              }}
              options={resultOptions.filter((option) => option.value !== "")}
            />
          </FilterField>
          {/*
           * Một bộ chọn KHOẢNG chiếm chỗ hai ô cũ (span 2) — đồng bộ với các
           * màn Báo cáo khác. Picker tự khoá chéo nên kỳ đảo chiều vẫn không
           * dựng ra được (BE trả 422).
           */}
          <FilterField
            label={t("reports.importMatchReport.fieldDateRange")}
            span={2}
          >
            <UiVuexyDateRangePicker
              aria-label={t("reports.importMatchReport.fieldDateRange")}
              value={range}
              format="DD/MM/YYYY"
              placeholder={[
                t("reports.importMatchReport.fromDate"),
                t("reports.importMatchReport.toDate"),
              ]}
              allowClear={false}
              // Dữ liệu chỉ có trong quá khứ: khoá ngày tương lai (mốc dưới giữ mặc định 2000).
              maxDate={dayjs().endOf("day")}
              presets={periodPresets}
              className="hn-vuexy-date-range"
              popupClassName="hn-vuexy-date-popup"
              onChange={(value) => {
                if (value?.[0] && value[1]) setRange([value[0], value[1]]);
              }}
            />
          </FilterField>
          <FilterField label={t("reports.importMatchReport.fieldStatus")}>
            <UiSelect
              fullWidth
              aria-label={t("reports.importMatchReport.statusAria")}
              value={status}
              placeholder={t("reports.importMatchReport.allStatuses")}
              onChange={(value) => {
                setStatus(value);
                pagination.reset();
              }}
              options={statusOptions.filter((option) => option.value !== "")}
            />
          </FilterField>
          <FilterField label={t("reports.importMatchReport.fieldActor")}>
            <UiSelect
              fullWidth
              aria-label={t("reports.importMatchReport.actorAria")}
              value={actor}
              placeholder={t("reports.importMatchReport.allActors")}
              onChange={(value) => {
                setActor(value);
                pagination.reset();
              }}
              options={actorOptions.filter((option) => option.value !== "")}
            />
          </FilterField>
          {context === "MATCH" ? (
            <FilterField label={t("reports.importMatchReport.fieldKind")}>
              <UiSelect
                fullWidth
                aria-label={t("reports.importMatchReport.kindAria")}
                value={kind}
                onChange={(value) => {
                  setKind(value as ItemKind);
                  pagination.reset();
                }}
                options={kindOptions}
              />
            </FilterField>
          ) : null}
          <FilterField label={keyLabel} span={2}>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label={keyLabel}
              placeholder={
                context === "IMPORT"
                  ? t("reports.importMatchReport.importFilePlaceholder")
                  : keyLabel
              }
              onChange={(value) => {
                setKeyword(value);
                pagination.reset();
              }}
            />
          </FilterField>
          {context === "MATCH" ? (
            <FilterField label={t("reports.importMatchReport.fieldSku")}>
              <SearchInput
                width="100%"
                value={sku}
                aria-label={t("reports.importMatchReport.skuAria")}
                placeholder={t("reports.importMatchReport.fieldSku")}
                onChange={(value) => {
                  setSku(value);
                  pagination.reset();
                }}
              />
            </FilterField>
          ) : null}
        </Box>
      </Box>

      {invalid ? (
        <UiAlert tone="error">{t("reports.common.dateOrderError")}</UiAlert>
      ) : null}

      <ReportRangeAdviceBanner
        advice={rangeAdvice}
        onApply={(next) => {
          setRange([dayjs(next.from), dayjs(next.to)]);
          pagination.reset();
        }}
      />

      {/* ── Tổng quan ────────────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="rpt-04-kpi-title">
        <SectionHeading
          id="rpt-04-kpi-title"
          eyebrow={t("reports.importMatchReport.kpiEyebrow")}
          title={
            context === "IMPORT"
              ? t("reports.importMatchReport.kpiTitleImport")
              : t("reports.importMatchReport.kpiTitleMatch")
          }
          description={
            context === "IMPORT"
              ? t("reports.importMatchReport.kpiDescImport")
              : t("reports.importMatchReport.kpiDescMatch")
          }
          meta={t("reports.importMatchReport.kpiMeta", {
            from: range[0].format(DISPLAY_DATE),
            to: range[1].format(DISPLAY_DATE),
          })}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {context === "IMPORT" ? (
            <>
              <MetricCard
                label={t("reports.importMatchReport.mcTotalImported")}
                value={fmt(totals.total)}
                hint={t("reports.importMatchReport.mcTotalImportedHint", {
                  count: fmt(batches.length),
                })}
                icon={<BarChartOutlined />}
                tone="primary"
              />
              <MetricCard
                label={t("reports.importMatchReport.mcValid")}
                value={fmt(totals.success)}
                hint={t("reports.importMatchReport.mcValidHint", {
                  pct: pct(totals.success, totals.total),
                })}
                icon={<CheckCircleOutlined />}
                tone="success"
              />
              <MetricCard
                label={t("reports.importMatchReport.mcInvalid")}
                value={fmt(totals.failed)}
                hint={t("reports.importMatchReport.mcInvalidHint", {
                  pct: pct(totals.failed, totals.total),
                })}
                icon={<WarningOutlined />}
                tone="error"
                onActivate={() => applyResultFilter("FAILED")}
              />
              <MetricCard
                label={t("reports.importMatchReport.mcDuplicate")}
                value={fmt(totals.duplicate)}
                hint={t("reports.importMatchReport.mcDuplicateHint", {
                  pct: pct(totals.duplicate, totals.total),
                })}
                icon={<CopyOutlined />}
                tone="warning"
                onActivate={() => applyResultFilter("DUPLICATE")}
              />
            </>
          ) : (
            <>
              <MetricCard
                label={t("reports.importMatchReport.mcTotalRequests")}
                value={fmt(totals.total)}
                hint={t("reports.importMatchReport.mcTotalRequestsHint", {
                  count: fmt(batches.length),
                })}
                icon={<BarChartOutlined />}
                tone="primary"
              />
              <MetricCard
                label={t("reports.importMatchReport.mcRequiredQty")}
                value={fmt(totals.required)}
                hint={t("reports.importMatchReport.mcRequiredQtyHint", {
                  count: fmt(totals.total),
                })}
                icon={<StockOutlined />}
                tone="primary"
              />
              <MetricCard
                label={t("reports.importMatchReport.mcMatchedQty")}
                value={fmt(totals.matched)}
                hint={t("reports.importMatchReport.mcMatchedQtyHint", {
                  pct: pct(totals.matched, totals.required),
                })}
                icon={<CheckCircleOutlined />}
                tone="success"
              />
              <MetricCard
                label={t("reports.importMatchReport.mcUnmatchedQty")}
                value={fmt(matchRemaining)}
                hint={t("reports.importMatchReport.mcUnmatchedQtyHint", {
                  pct: pct(matchRemaining, totals.required),
                })}
                icon={<WarningOutlined />}
                tone="warning"
              />
            </>
          )}
        </Box>
      </Box>

      {/* ── Phân tích ────────────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="rpt-04-analysis-title">
        <SectionHeading
          id="rpt-04-analysis-title"
          eyebrow={t("reports.importMatchReport.analysisEyebrow")}
          title={t("reports.importMatchReport.analysisTitle")}
          description={t("reports.importMatchReport.analysisDesc")}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
            gap: { xs: 1.5, md: 2 },
          }}
        >
          <PanelCard
            title={
              context === "IMPORT"
                ? t("reports.importMatchReport.trendTitleImport")
                : t("reports.importMatchReport.trendTitleMatch")
            }
            description={t("reports.importMatchReport.trendDesc")}
            icon={<BarChartOutlined />}
            loading={loading}
            error={activeQuery.error}
            onRetry={refresh}
            empty={trend.length === 0}
            emptyText={t("reports.importMatchReport.trendEmpty")}
          >
            <MultiSeriesBarChart
              categories={trend.map((point) => axisDayLabel(point.day))}
              series={series}
              stacked
              showValues
              height={290}
              valueFormatter={fmt}
              onSelect={(payload) =>
                setDayDrill({
                  day: trend[payload.categoryIndex]?.day ?? "",
                  seriesName: payload.seriesName,
                })
              }
            />
          </PanelCard>

          <PanelCard
            title={t("reports.importMatchReport.topErrorTitle")}
            description={t("reports.importMatchReport.topErrorDesc")}
            icon={<WarningOutlined />}
            iconTone="error"
            loading={loading}
            error={activeQuery.error}
            onRetry={refresh}
            empty={topErrorCodes.length === 0}
            emptyText={t("reports.importMatchReport.topErrorEmpty")}
            toolbar={
              // Không ép 122px: nhãn "10 mã nhiều nhất" cần ~208px, UiSelect tự
              // nới theo nhãn (fitSelectMinWidth) nên để nó tự quyết bề rộng.
              <UiSelect
                aria-label={t("reports.importMatchReport.topCountAria")}
                value={top}
                onChange={(value) => setTop(value as "10" | "20")}
                options={topOptions}
              />
            }
          >
            <Box
              sx={{ display: "grid", alignContent: "center", gap: 2.5, py: 1 }}
            >
              {topErrorCodes.map((item, index) => (
                <Box
                  key={item.code}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr auto",
                      sm: "minmax(120px, 0.8fr) minmax(100px, 1.8fr) 34px",
                    },
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={() => openErrorCode(item.code)}
                    sx={{
                      p: 0,
                      border: 0,
                      bgcolor: "transparent",
                      color: S.textHigh,
                      font: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: "left",
                      cursor: "pointer",
                      overflowWrap: "anywhere",
                      transition: RPT_CONTROL_MOTION_SX.transition,
                      "&:hover": {
                        color: S.primaryDark,
                        textDecoration: "underline",
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${S.primary}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Box component="span" aria-hidden="true">
                      {index + 1}.{" "}
                    </Box>
                    {/* UAT TC_UI_19: nhãn tiếng Việt; mã máy giữ ở tooltip
                        cho người cần tra soát kỹ thuật. */}
                    <Box component="span" title={item.code}>
                      {enumLabelOrText(IMPORT_MATCH_ERROR_LABELS, item.code)}
                    </Box>
                  </Box>
                  <Box
                    aria-hidden="true"
                    sx={{
                      height: 10,
                      overflow: "hidden",
                      borderRadius: 999,
                      bgcolor: S.errorSoft,
                      gridColumn: { xs: "1 / -1", sm: "auto" },
                      gridRow: { xs: 2, sm: "auto" },
                    }}
                  >
                    <Box
                      sx={{
                        width: `${maxErrorCount > 0 ? (item.value / maxErrorCount) * 100 : 0}%`,
                        height: "100%",
                        borderRadius: "inherit",
                        bgcolor: S.error,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: S.textMedium,
                      textAlign: "right",
                    }}
                  >
                    {fmt(item.value)}
                  </Box>
                </Box>
              ))}
            </Box>
          </PanelCard>
        </Box>
      </Box>

      {/* ── Chi tiết dữ liệu ─────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="rpt-04-detail-title">
        <SectionHeading
          id="rpt-04-detail-title"
          eyebrow={t("reports.importMatchReport.detailEyebrow")}
          title={
            context === "IMPORT"
              ? t("reports.importMatchReport.logTitleImport")
              : t("reports.importMatchReport.logTitleMatch")
          }
          description={t("reports.importMatchReport.logDesc")}
          meta={t("reports.importMatchReport.logMeta", {
            count: fmt(batches.length),
          })}
        />
        <Box
          component="article"
          sx={{
            ...REPORT_SURFACE_SX,
            pt: { xs: 1.75, md: 2 },
            overflow: "hidden",
          }}
        >
          <Box
            role="tablist"
            aria-label={t("reports.importMatchReport.viewAria")}
            sx={{
              mx: { xs: 2, md: 3 },
              mb: 2,
              p: 0.5,
              display: "flex",
              gap: 0.5,
              width: "fit-content",
              maxWidth: "100%",
              border: `1px solid ${S.border}`,
              borderRadius: `${RADIUS.card}px`,
              bgcolor: S.bgSubtle,
            }}
          >
            {(
              [
                ["table", t("reports.importMatchReport.viewTable")],
                ["snapshot", t("reports.importMatchReport.viewSnapshot")],
              ] as const
            ).map(([value, label]) => (
              <Box
                key={value}
                component="button"
                type="button"
                role="tab"
                data-report-view={value}
                aria-selected={shownView === value}
                tabIndex={shownView === value ? 0 : -1}
                onClick={() => {
                  setView(value);
                  setFiltersExpanded(value === "table");
                }}
                sx={{
                  ...tabSx(shownView === value),
                  flex: "0 0 auto",
                  minWidth: 108,
                }}
              >
                {label}
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              mx: { xs: 2, md: 3 },
              mb: 2,
              px: 1.5,
              py: 1.25,
              borderRadius: `${RADIUS.card}px`,
              bgcolor: S.bgSubtle,
              fontSize: 12,
              lineHeight: "18px",
              color: S.textMedium,
            }}
          >
            {view === "table"
              ? context === "IMPORT"
                ? t("reports.importMatchReport.noteImport")
                : t("reports.importMatchReport.noteMatch")
              : t("reports.importMatchReport.noteSnapshot")}
          </Box>

          <Box sx={{ mx: { xs: 2, md: 3 } }}>
            <SectionFilterBar
              state={logFilter}
              label={
                context === "IMPORT"
                  ? t("reports.importMatchReport.logTitleImport")
                  : t("reports.importMatchReport.logTitleMatch")
              }
              unit={t("reports.importMatchReport.logUnit")}
              data-testid="rpt-04-log-section-filter"
            />
          </Box>

          {deferredView === "table" ? (
            /* UAT TC_UI_20: các khối anh em (tablist, ghi chú, bộ lọc) đều
               inset mx 2/3 — riêng bảng từng dính sát mép thẻ bo góc
               overflow:hidden, cột STT bị xén. */
            <Box sx={{ px: { xs: 1.5, sm: 2, md: 2.5 } }}>
              <ResponsiveDataTable<ImportMatchBatch>
                columns={[
                  {
                    key: "stt",
                    header: t("shared.table.rowNumber"),
                    align: "center",
                    width: 56,
                    render: (row) =>
                      mvpRowNumber(
                        pagination.page,
                        pagination.perPage,
                        rowIndexOf(pagination.pageRows, row),
                      ),
                  },
                  {
                    key: "batchNo",
                    header: keyLabel,
                    sortAccessor: (row) => row.batchNo,
                    render: (row) => (
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                          {row.batchNo || EMPTY_TEXT}
                        </Box>
                        <Box sx={{ fontSize: 12, color: S.textMedium }}>
                          {row.caption}
                        </Box>
                      </Box>
                    ),
                  },
                  {
                    key: "at",
                    header: t("reports.importMatchReport.colTime"),
                    width: 165,
                    sortAccessor: (row) => row.at,
                    render: (row) =>
                      row.at ? fmtDateTime(row.at) : EMPTY_TEXT,
                  },
                  {
                    key: "total",
                    header: t("reports.importMatchReport.colTotalRows"),
                    align: "right",
                    width: 110,
                    sortAccessor: (row) => row.total,
                    render: (row) => fmt(row.total),
                  },
                  {
                    key: "success",
                    header: t("reports.importMatchReport.colValid"),
                    align: "right",
                    width: 100,
                    sortAccessor: (row) => row.success,
                    render: (row) => fmt(row.success),
                  },
                  {
                    key: "failed",
                    header: t("reports.importMatchReport.colFailed"),
                    align: "right",
                    width: 90,
                    sortAccessor: (row) => row.failed,
                    render: (row) => fmt(row.failed),
                  },
                  {
                    key: "duplicate",
                    header: t("reports.importMatchReport.colDuplicate"),
                    align: "right",
                    width: 95,
                    sortAccessor: (row) => row.duplicate,
                    render: (row) => fmt(row.duplicate),
                  },
                  {
                    key: "rate",
                    header: t("reports.importMatchReport.colValidRate"),
                    align: "right",
                    width: 125,
                    sortAccessor: (row) =>
                      row.total > 0 ? row.success / row.total : 0,
                    render: (row) => pct(row.success, row.total),
                  },
                  {
                    key: "actor",
                    header: t("reports.importMatchReport.colActor"),
                    hideOnMobile: true,
                    render: (row) => row.actor || EMPTY_TEXT,
                  },
                  {
                    key: "status",
                    header: t("reports.importMatchReport.colStatus"),
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
                rowKey={(row) => `${row.context}:${row.id}`}
                loading={loading}
                onRowClick={(row) => setOpenBatch(row)}
                emptyText={t("reports.importMatchReport.logEmpty")}
                renderRowActions={(row) => (
                  <RowActionGroup>
                    <RowActionButton
                      kind="detail"
                      aria-label={t("reports.importMatchReport.rowDetailAria", {
                        code: row.batchNo,
                      })}
                      onClick={() => setOpenBatch(row)}
                    >
                      {t("reports.importMatchReport.detail")}
                    </RowActionButton>
                  </RowActionGroup>
                )}
                // Trang có thể đặt tới 100 dòng/trang: cuộn trong khung và ghim
                // tiêu đề cột thay vì kéo trang thành một dải rất dài.
                maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
              />
            </Box>
          ) : (
            <Box sx={{ px: { xs: 1.5, sm: 2, md: 2.5 }, pb: 1 }}>
              {loading ? (
                <Box
                  sx={{ minHeight: 220, display: "grid", placeItems: "center" }}
                >
                  <UiSpinner />
                </Box>
              ) : pagination.pageRows.length === 0 ? (
                <Box
                  sx={{
                    minHeight: 220,
                    display: "grid",
                    placeItems: "center",
                    color: S.textMedium,
                    fontSize: TYPOGRAPHY.fontSizeSecondary,
                  }}
                >
                  {t("reports.importMatchReport.snapshotEmpty")}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      xl: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: { xs: 1.5, md: 2 },
                  }}
                >
                  {pagination.pageRows.map((batch, index) => (
                    <SliceCard
                      key={`${batch.context}:${batch.id}`}
                      batch={batch}
                      index={(pagination.page - 1) * pagination.perPage + index}
                      onOpen={() => setOpenBatch(batch)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* UAT TC_UI_20: footer cần inset + đệm đáy riêng, không dựa vào
              mt 12px mặc định (đè lên thanh cuộn ngang của bảng). */}
          <Box sx={{ px: { xs: 1.5, sm: 2, md: 2.5 }, pb: 2.5 }}>
            <ReportPaginationBar
              page={pagination.page}
              perPage={pagination.perPage}
              total={pagination.total}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPerPage}
            />
          </Box>
        </Box>
      </Box>

      {exporter.exportDenied ? (
        <Box role="alert">
          <UiAlert
            tone="error"
            title={t("reports.importMatchReport.exportDeniedTitle")}
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      {/* ── Drill-down: một ngày trên biểu đồ diễn biến ──────────────── */}
      {dayDrill ? (
        <DrillDownDialog
          title={t("reports.importMatchReport.dayDrillTitle", {
            series: dayDrill.seriesName,
            date: dayjs(dayDrill.day).format(DISPLAY_DATE),
          })}
          subtitle={t("reports.importMatchReport.dayDrillSubtitle")}
          onClose={() => setDayDrill(null)}
        >
          <ResponsiveDataTable<ImportMatchBatch>
            columns={[
              {
                key: "stt",
                header: t("shared.table.rowNumber"),
                align: "center",
                width: 56,
                render: (row) => rowIndexOf(dayDrillRows, row) + 1,
              },
              {
                key: "batchNo",
                header: keyLabel,
                render: (row) => row.batchNo || EMPTY_TEXT,
              },
              {
                key: "success",
                header: t("reports.importMatchReport.colValid"),
                align: "right",
                render: (row) => fmt(row.success),
              },
              {
                key: "failed",
                header: t("reports.importMatchReport.colFailed"),
                align: "right",
                render: (row) => fmt(row.failed),
              },
              {
                key: "duplicate",
                header: t("reports.importMatchReport.colDuplicate"),
                align: "right",
                render: (row) => fmt(row.duplicate),
              },
              {
                key: "actor",
                header: t("reports.importMatchReport.colActor"),
                render: (row) => row.actor || EMPTY_TEXT,
              },
            ]}
            rows={dayDrillRows}
            rowKey={(row) => `${row.context}:${row.id}`}
            emptyText={t("reports.importMatchReport.dayDrillEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {/* ── Drill-down: chi tiết một batch ──────────────────────────── */}
      {openBatch ? (
        <DrillDownDialog
          title={t("reports.importMatchReport.batchDialogTitle", {
            code: openBatch.batchNo || EMPTY_TEXT,
          })}
          subtitle={t("reports.importMatchReport.batchDialogSubtitle", {
            context: CONTEXT_LABEL[openBatch.context],
            rows: fmt(openBatch.total),
            pct: pct(openBatch.success, openBatch.total),
          })}
          onClose={() => setOpenBatch(null)}
        >
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}
          >
            <UiStatusBadge
              tone="success"
              label={t("reports.importMatchReport.badgeValid", {
                count: fmt(openBatch.success),
              })}
            />
            <UiStatusBadge
              tone="error"
              label={t("reports.importMatchReport.badgeFailed", {
                count: fmt(openBatch.failed),
              })}
            />
            <UiStatusBadge
              tone="warning"
              label={t("reports.importMatchReport.badgeDuplicate", {
                count: fmt(openBatch.duplicate),
              })}
            />
            {openBatch.errorFileAvailable ? (
              <ActionButton
                kind="download"
                loading={downloading === openBatch.id}
                onClick={() => void downloadErrorFile(openBatch)}
              >
                {t("reports.importMatchReport.downloadErrorFile")}
              </ActionButton>
            ) : null}
          </Stack>

          <Box
            sx={{
              mt: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1.25,
            }}
          >
            {[
              [
                t("reports.importMatchReport.colTime"),
                openBatch.at ? fmtDateTime(openBatch.at) : EMPTY_TEXT,
              ],
              [
                t("reports.importMatchReport.colActor"),
                openBatch.actor || EMPTY_TEXT,
              ],
              [
                t("reports.importMatchReport.colStatus"),
                reportStatusLabel(openBatch.status),
              ],
              ...(openBatch.context === "IMPORT"
                ? ([
                    [
                      t("reports.importMatchReport.fieldSourceFile"),
                      openBatch.sourceFile || EMPTY_TEXT,
                    ],
                    // Không hiện mã băm SHA-256 của tệp: chuỗi hex 64 ký tự không
                    // tra cứu được gì với người dùng kho (phản ánh 10/09/2026). Giá
                    // trị vẫn nằm ở import_reports để quản trị đối soát trùng tệp.
                    [
                      t("reports.importMatchReport.fieldSourceVersion"),
                      openBatch.sourceVersion || EMPTY_TEXT,
                    ],
                  ] as Array<[string, string]>)
                : []),
            ].map(([label, value]) => (
              <Box
                key={label}
                sx={{
                  display: "grid",
                  gap: 0.5,
                  p: 1.5,
                  borderRadius: `${RADIUS.card}px`,
                  bgcolor: S.bgSubtle,
                }}
              >
                <Box sx={{ fontSize: 11, color: S.textMedium }}>{label}</Box>
                <Box
                  sx={{
                    fontSize: TYPOGRAPHY.fontSizeSecondary,
                    fontWeight: 700,
                    color: S.textHigh,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </Box>
              </Box>
            ))}
          </Box>

          <Box
            component="h3"
            sx={{
              mt: 2.5,
              mb: 1.25,
              fontSize: TYPOGRAPHY.fontSizeBody,
              fontWeight: 700,
              color: S.textHigh,
            }}
          >
            {t("reports.importMatchReport.errorLinesTitle")}
          </Box>
          <ResponsiveDataTable<BatchErrorLine>
            columns={[
              {
                key: "stt",
                header: t("shared.table.rowNumber"),
                align: "center",
                width: 56,
                render: (row) => rowIndexOf(openBatch.errors, row) + 1,
              },
              {
                key: "rowNo",
                header: t("reports.importMatchReport.colRowNo"),
                width: 80,
                render: (row) => row.rowNo,
              },
              {
                key: "code",
                header: t("reports.importMatchReport.colErrorCode"),
                // UAT TC_UI_19: nhãn Việt + mã máy ở tooltip.
                render: (row) => (
                  <Box sx={{ fontWeight: 700 }} title={row.code}>
                    {enumLabelOrText(IMPORT_MATCH_ERROR_LABELS, row.code)}
                  </Box>
                ),
              },
              {
                key: "message",
                header: t("reports.importMatchReport.colMessage"),
                render: (row) => row.message || EMPTY_TEXT,
              },
              {
                key: "reference",
                header: t("reports.importMatchReport.colReference"),
                render: (row) => row.reference || EMPTY_TEXT,
              },
            ]}
            rows={openBatch.errors}
            rowKey={(row) => `${row.rowNo}-${row.code}-${row.reference}`}
            emptyText={t("reports.importMatchReport.errorLinesEmpty")}
          />

          {openBatch.matchLines.length > 0 ? (
            <>
              <Box
                component="h3"
                sx={{
                  mt: 2.5,
                  mb: 1.25,
                  fontSize: TYPOGRAPHY.fontSizeBody,
                  fontWeight: 700,
                  color: S.textHigh,
                }}
              >
                {t("reports.importMatchReport.matchLinesTitle")}
              </Box>
              <ResponsiveDataTable<Raw>
                columns={[
                  {
                    key: "stt",
                    header: t("shared.table.rowNumber"),
                    align: "center",
                    width: 56,
                    render: (row) => rowIndexOf(openBatch.matchLines, row) + 1,
                  },
                  {
                    key: "row_no",
                    header: t("reports.importMatchReport.colRowNo"),
                    align: "right",
                    width: 80,
                    render: (row) => text(row.row_no),
                  },
                  {
                    key: "source_request_no",
                    header: t("reports.importMatchReport.colTicket"),
                    render: (row) => text(row.source_request_no),
                  },
                  {
                    key: "sku_code",
                    header: t("reports.importMatchReport.fieldSku"),
                    render: (row) => (
                      <Box sx={{ fontWeight: 700 }}>
                        <SkuLink code={text(row.sku_code)} />
                      </Box>
                    ),
                  },
                  {
                    key: "required_qty",
                    header: t("reports.importMatchReport.colRequired"),
                    align: "right",
                    width: 100,
                    render: (row) => fmt(n(row.required_qty)),
                  },
                  {
                    key: "matched_qty",
                    header: t("reports.importMatchReport.colMatched"),
                    align: "right",
                    width: 110,
                    render: (row) => fmt(n(row.matched_qty)),
                  },
                  {
                    key: "scanned_qty",
                    header: t("reports.importMatchReport.colScanned"),
                    align: "right",
                    width: 90,
                    render: (row) => fmt(n(row.scanned_qty)),
                  },
                  {
                    key: "error_code",
                    header: t("reports.importMatchReport.colFailed"),
                    render: (row) => text(row.error_code),
                  },
                ]}
                rows={openBatch.matchLines}
                rowKey={(row) => text(row.id, "")}
                emptyText={t("reports.importMatchReport.matchLinesEmpty")}
              />
            </>
          ) : null}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
