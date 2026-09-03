import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiSelect,
  UiSpinner,
  UiStatusBadge,
  UiVuexyDateField,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
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
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { EMPTY_TEXT } from "@/shared/constants/display";
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
import { ReportStatusBadge } from "@/modules/reports/operations/report-drilldown";
import { ReportPaginationBar } from "@/modules/reports/operations/report-table";
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

/** Ngày hiển thị theo chuẩn dự án (dd-MM-yyyy), không phải dd/MM của bản HTML. */
const DISPLAY_DATE = "DD-MM-YYYY";

const RESULT_OPTIONS = [
  { value: "", label: "Tất cả kết quả" },
  { value: "SUCCESS", label: "Thành công" },
  { value: "FAILED", label: "Lỗi" },
  { value: "DUPLICATE", label: "Trùng lặp" },
];

const KIND_OPTIONS = [
  { value: "all", label: "Tất cả loại hàng" },
  { value: "PRODUCT", label: "Sản phẩm" },
  { value: "COMPONENT", label: "Linh kiện" },
];

const TOP_OPTIONS = [
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
];

const REPORT_SURFACE_SX = {
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  boxShadow: S.shadowCard,
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
 * Thẻ KPI của baseline 8.5: nhãn + icon, số lớn, dòng chú thích và một thanh
 * tỷ trọng. Bản HTML vẽ sparkline TĨNH ở góc phải; ở đây thay bằng thanh tỷ
 * trọng tính từ chính số liệu đang lọc để không có pixel nào là số giả.
 */
function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  share,
  onActivate,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactElement;
  tone: MetricTone;
  share: number;
  onActivate?: () => void;
}) {
  const style = KPI_TONES[tone];
  const safeShare = Math.max(0, Math.min(100, share));
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
        p: { xs: 1.75, md: 2 },
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
        backgroundImage: `linear-gradient(145deg, ${S.bgSurface} 30%, ${style.surface})`,
        borderTop: `2px solid ${style.accent}`,
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
            width: 36,
            height: 36,
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
          mt: 1.25,
          fontSize: "clamp(24px, 2.15vw, 30px)",
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
            width: 46,
            height: 6,
            flex: "none",
            overflow: "hidden",
            borderRadius: 999,
            bgcolor: style.surface,
          }}
        >
          <Box
            sx={{
              width: `${safeShare}%`,
              height: "100%",
              borderRadius: "inherit",
              bgcolor: style.accent,
            }}
          />
        </Box>
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
        minHeight: { md: 410 },
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
          title={`Không tải được "${title}"`}
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
        gridColumn: { xs: "span 1", sm: `span ${span}`, xl: `span ${span}` },
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
  const values: Array<[string, string]> = [
    ["Tổng dòng", fmt(batch.total)],
    ["Hợp lệ", fmt(batch.success)],
    ["Lỗi", fmt(batch.failed)],
    ["Trùng", fmt(batch.duplicate)],
    ["Tỷ lệ", pct(batch.success, batch.total)],
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
            {`Lát cắt ${String(index + 1).padStart(2, "0")} · ${batch.batchNo || EMPTY_TEXT}`}
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
        <ActionButton kind="detail" onClick={onOpen}>
          Xem chi tiết
        </ActionButton>
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
  const [context, setContext] = useState<ImportMatchContext>("IMPORT");
  const [view, setView] = useState<"table" | "snapshot">("table");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() =>
    presetRange("this-month"),
  );
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

  const totals = useMemo(() => totalsOf(batches), [batches]);
  const trend = useMemo(() => trendByDay(batches), [batches]);
  const errorCodes = useMemo(() => errorCodeCounts(batches), [batches]);
  const topErrorCodes = useMemo(
    () => errorCodes.slice(0, Number(top)),
    [errorCodes, top],
  );
  const pagination = useClientPagination(batches, 15);

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Tất cả trạng thái" },
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
    [contextBatches],
  );

  const actorOptions = useMemo(
    () => [
      { value: "", label: "Tất cả người thực hiện" },
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
    [contextBatches],
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
      link.download = fileName ?? `loi-import-${batch.batchNo}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Đã tải tệp lỗi của batch.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tải được tệp lỗi."));
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
      name: "Hợp lệ",
      data: trend.map((point) => point.success),
      color: CHART_COLORS.success,
    },
    {
      name: "Lỗi",
      data: trend.map((point) => point.failed),
      color: CHART_COLORS.danger,
    },
    {
      name: "Trùng lặp",
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
        gap: { xs: 1.5, md: 2.25 },
        "& > *": { minWidth: 0 },
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
              BÁO CÁO VẬN HÀNH · RPT-04
            </Box>
            <Box
              component="h1"
              id="rpt-04-title"
              sx={{
                m: 0,
                mt: 0.25,
                fontSize: { xs: 22, md: 25 },
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
                color: S.textHigh,
              }}
            >
              Nhập liệu, đối chiếu &amp; lỗi
            </Box>
            <Box
              sx={{
                mt: 0.5,
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                color: S.textMedium,
              }}
            >
              Theo dõi chất lượng dữ liệu theo từng luồng nghiệp vụ, khoanh vùng
              lỗi nhanh và đi thẳng tới batch cần xử lý.
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
              ? "Đang đồng bộ"
              : activeQuery.isError
                ? "Lỗi tải dữ liệu"
                : "Dữ liệu đã tải"
          }
        />
      </Box>

      {/* ── Ngữ cảnh báo cáo ─────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Ngữ cảnh báo cáo"
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
          aria-label="Ngữ cảnh báo cáo"
          sx={{
            width: { xs: "100%", md: "min(100%, 500px)" },
            p: 0.5,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
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
          Làm mới
        </UiButton>
      </Box>

      {/* ── Dải "lát cắt đang xem" ───────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Lát cắt đang xem"
        sx={{
          ...REPORT_SURFACE_SX,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          minHeight: 76,
          px: { xs: 2, md: 2.5 },
          py: 2,
          bgcolor: S.primary,
          backgroundImage: `linear-gradient(118deg, ${S.primaryDark}, ${S.primary})`,
          color: S.onPrimary,
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
            border: `32px solid ${S.primaryLight}`,
            borderRadius: "50%",
            opacity: 0.2,
          }}
        />
        <Box sx={{ position: "relative", display: "grid", gap: 0.5 }}>
          <Box
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              opacity: 0.76,
            }}
          >
            LÁT CẮT ĐANG XEM
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
            Kỳ: <strong>{periodLabel}</strong>
          </Box>
          <Box>
            <strong>{fmt(batches.length)}</strong> batch trong phạm vi
          </Box>
        </Stack>
      </Box>

      {/* ── Bộ lọc phân tích ─────────────────────────────────────────── */}
      <Box
        component="section"
        aria-labelledby="rpt-04-filters"
        sx={{ ...REPORT_SURFACE_SX, p: 2.5, overflow: "visible" }}
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
              Bộ lọc phân tích
            </Box>
            <Box sx={{ fontSize: 12, lineHeight: "18px", color: S.textMedium }}>
              {`${fmt(batches.length)} ${context === "IMPORT" ? "lần import" : "lần đối soát"} phù hợp điều kiện`}
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
                    context === "IMPORT" ? "import-batch" : "outbound-match",
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
            {view === "snapshot" ? (
              <UiButton
                appearance="text"
                aria-expanded={filtersExpanded}
                aria-controls="rpt-04-filter-fields"
                onClick={() => setFiltersExpanded((current) => !current)}
              >
                {filtersExpanded ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
              </UiButton>
            ) : null}
            <UiButton appearance="text" onClick={resetFilters}>
              Đặt lại
            </UiButton>
          </Stack>
        </Stack>
        <Box
          id="rpt-04-filter-fields"
          hidden={!showFilters}
          sx={{
            display: showFilters ? "grid" : "none",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(3, minmax(0, 1fr))",
              xl: "repeat(5, minmax(0, 1fr))",
            },
            gap: "16px 12px",
          }}
        >
          <FilterField label="Kết quả">
            <UiSelect
              fullWidth
              aria-label="Lọc theo kết quả xử lý"
              value={result}
              placeholder="Tất cả kết quả"
              onChange={(value) => {
                setResult(value as ImportMatchResultFilter);
                pagination.reset();
              }}
              options={RESULT_OPTIONS.filter((option) => option.value !== "")}
            />
          </FilterField>
          {/*
           * `maxDate` / `minDate` khoá chéo hai ô để không chọn ra được kỳ đảo
           * chiều (BE trả 422).
           */}
          <FilterField label="Từ ngày">
            <UiVuexyDateField
              id="rpt-04-from-date"
              field="from"
              aria-label="Từ ngày"
              value={range[0]}
              maxDate={range[1]}
              onChange={(value) => {
                if (value) setRange([value, range[1]]);
              }}
            />
          </FilterField>
          <FilterField label="Đến ngày">
            <UiVuexyDateField
              id="rpt-04-to-date"
              field="to"
              aria-label="Đến ngày"
              value={range[1]}
              minDate={range[0]}
              onChange={(value) => {
                if (value) setRange([range[0], value]);
              }}
            />
          </FilterField>
          <FilterField label="Trạng thái">
            <UiSelect
              fullWidth
              aria-label="Lọc theo trạng thái batch"
              value={status}
              placeholder="Tất cả trạng thái"
              onChange={(value) => {
                setStatus(value);
                pagination.reset();
              }}
              options={statusOptions.filter((option) => option.value !== "")}
            />
          </FilterField>
          <FilterField label="Người thực hiện">
            <UiSelect
              fullWidth
              aria-label="Lọc theo người thực hiện"
              value={actor}
              placeholder="Tất cả người thực hiện"
              onChange={(value) => {
                setActor(value);
                pagination.reset();
              }}
              options={actorOptions.filter((option) => option.value !== "")}
            />
          </FilterField>
          {context === "MATCH" ? (
            <FilterField label="Loại hàng">
              <UiSelect
                fullWidth
                aria-label="Lọc theo loại hàng"
                value={kind}
                onChange={(value) => {
                  setKind(value as ItemKind);
                  pagination.reset();
                }}
                options={KIND_OPTIONS}
              />
            </FilterField>
          ) : null}
          <FilterField label={keyLabel} span={2}>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label={keyLabel}
              placeholder={context === "IMPORT" ? "Tên tệp import" : keyLabel}
              onChange={(value) => {
                setKeyword(value);
                pagination.reset();
              }}
            />
          </FilterField>
          {context === "MATCH" ? (
            <FilterField label="Mã SKU">
              <SearchInput
                width="100%"
                value={sku}
                aria-label="Lọc theo mã SKU"
                placeholder="Mã SKU"
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
        <UiAlert tone="error">
          Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
        </UiAlert>
      ) : null}

      {/* ── Tổng quan ────────────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="rpt-04-kpi-title">
        <SectionHeading
          id="rpt-04-kpi-title"
          eyebrow="TỔNG QUAN"
          title={
            context === "IMPORT"
              ? "Sức khỏe dữ liệu import"
              : "Tiến độ đối soát"
          }
          description={
            context === "IMPORT"
              ? "Bấm vào nhóm lỗi hoặc trùng lặp để lọc nhật ký phía dưới."
              : "Tổng hợp theo dòng SKU trong kỳ đang xem."
          }
          meta={`Kỳ ${range[0].format(DISPLAY_DATE)} – ${range[1].format(DISPLAY_DATE)}`}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(4, minmax(0, 1fr))",
            },
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {context === "IMPORT" ? (
            <>
              <MetricCard
                label="Tổng dòng import"
                value={fmt(totals.total)}
                hint={`${fmt(batches.length)} batch trong kỳ`}
                icon={<BarChartOutlined />}
                tone="primary"
                share={totals.total > 0 ? 100 : 0}
              />
              <MetricCard
                label="Dòng hợp lệ"
                value={fmt(totals.success)}
                hint={`${pct(totals.success, totals.total)} qua kiểm tra`}
                icon={<CheckCircleOutlined />}
                tone="success"
                share={
                  totals.total > 0 ? (totals.success / totals.total) * 100 : 0
                }
              />
              <MetricCard
                label="Dòng không hợp lệ"
                value={fmt(totals.failed)}
                hint={`${pct(totals.failed, totals.total)} cần xử lý`}
                icon={<WarningOutlined />}
                tone="error"
                share={
                  totals.total > 0 ? (totals.failed / totals.total) * 100 : 0
                }
                onActivate={() => applyResultFilter("FAILED")}
              />
              <MetricCard
                label="Trùng lặp"
                value={fmt(totals.duplicate)}
                hint={`${pct(totals.duplicate, totals.total)} thuộc nhóm lỗi`}
                icon={<CopyOutlined />}
                tone="warning"
                share={
                  totals.total > 0 ? (totals.duplicate / totals.total) * 100 : 0
                }
                onActivate={() => applyResultFilter("DUPLICATE")}
              />
            </>
          ) : (
            <>
              <MetricCard
                label="Tổng dòng yêu cầu"
                value={fmt(totals.total)}
                hint={`${fmt(batches.length)} batch đối soát`}
                icon={<BarChartOutlined />}
                tone="primary"
                share={totals.total > 0 ? 100 : 0}
              />
              <MetricCard
                label="SL yêu cầu"
                value={fmt(totals.required)}
                hint={`${fmt(totals.total)} dòng SKU`}
                icon={<StockOutlined />}
                tone="primary"
                share={totals.required > 0 ? 100 : 0}
              />
              <MetricCard
                label="SL đã đối chiếu"
                value={fmt(totals.matched)}
                hint={`${pct(totals.matched, totals.required)} khớp yêu cầu`}
                icon={<CheckCircleOutlined />}
                tone="success"
                share={
                  totals.required > 0
                    ? (totals.matched / totals.required) * 100
                    : 0
                }
              />
              <MetricCard
                label="SL chưa đối chiếu"
                value={fmt(matchRemaining)}
                hint={`${pct(matchRemaining, totals.required)} còn xử lý`}
                icon={<WarningOutlined />}
                tone="warning"
                share={
                  totals.required > 0
                    ? (matchRemaining / totals.required) * 100
                    : 0
                }
              />
            </>
          )}
        </Box>
      </Box>

      {/* ── Phân tích ────────────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="rpt-04-analysis-title">
        <SectionHeading
          id="rpt-04-analysis-title"
          eyebrow="PHÂN TÍCH"
          title="Diễn biến và điểm cần xử lý"
          description="Nhận diện ngày bất thường và drill-down vào batch nguồn."
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
                ? "Kết quả Import theo thời gian"
                : "Kết quả đối soát theo thời gian"
            }
            description="Hợp lệ, lỗi và trùng lặp theo ngày."
            icon={<BarChartOutlined />}
            loading={loading}
            error={activeQuery.error}
            onRetry={refresh}
            empty={trend.length === 0}
            emptyText="Kỳ này chưa có dữ liệu để vẽ biểu đồ."
          >
            <MultiSeriesBarChart
              categories={trend.map((point) => axisDayLabel(point.day))}
              series={series}
              height={300}
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
            title="Top mã lỗi"
            description="Bấm mã lỗi để xem batch liên quan."
            icon={<WarningOutlined />}
            iconTone="error"
            loading={loading}
            error={activeQuery.error}
            onRetry={refresh}
            empty={topErrorCodes.length === 0}
            emptyText="Kỳ này không phát sinh mã lỗi nào."
            toolbar={
              <Box sx={{ width: 122 }}>
                <UiSelect
                  fullWidth
                  aria-label="Số mã lỗi hiển thị"
                  value={top}
                  onChange={(value) => setTop(value as "10" | "20")}
                  options={TOP_OPTIONS}
                />
              </Box>
            }
          >
            <Box
              sx={{ display: "grid", alignContent: "center", gap: 2.5, py: 1 }}
            >
              {topErrorCodes.map((item) => (
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
                    {item.code}
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
          eyebrow="CHI TIẾT DỮ LIỆU"
          title={
            context === "IMPORT"
              ? "Nhật ký Import/Migration"
              : "Nhật ký đối soát yêu cầu xuất"
          }
          description="Chọn một batch để xem nguyên nhân lỗi và dữ liệu tầng dòng."
          meta={`${fmt(batches.length)} batch`}
        />
        <Box
          component="article"
          sx={{ ...REPORT_SURFACE_SX, pt: 2.5, overflow: "hidden" }}
        >
          <Box
            role="tablist"
            aria-label="Cách xem dữ liệu"
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
                ["table", "Bảng"],
                ["snapshot", "Lát cắt"],
              ] as const
            ).map(([value, label]) => (
              <Box
                key={value}
                component="button"
                type="button"
                role="tab"
                data-report-view={value}
                aria-selected={view === value}
                tabIndex={view === value ? 0 : -1}
                onClick={() => {
                  setView(value);
                  setFiltersExpanded(value === "table");
                }}
                sx={{
                  ...tabSx(view === value),
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
                ? "Nhật ký lấy từ Import báo cáo SKU (/skus/import-reports); tỷ lệ hợp lệ = dòng hợp lệ ÷ tổng dòng của chính batch đó."
                : "Nhật ký lấy từ đối soát toa yêu cầu xuất (/reports/import-match); tỷ lệ hợp lệ = dòng hợp lệ ÷ tổng dòng của chính batch đó."
              : "Lát cắt dùng cùng dữ liệu và bộ lọc với bảng."}
          </Box>

          {view === "table" ? (
            <ResponsiveDataTable<ImportMatchBatch>
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
                      pagination.pageRows.indexOf(row),
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
                  header: "Thời gian",
                  width: 165,
                  sortAccessor: (row) => row.at,
                  render: (row) => (row.at ? fmtDateTime(row.at) : EMPTY_TEXT),
                },
                {
                  key: "total",
                  header: "Tổng dòng",
                  align: "right",
                  width: 110,
                  sortAccessor: (row) => row.total,
                  render: (row) => fmt(row.total),
                },
                {
                  key: "success",
                  header: "Hợp lệ",
                  align: "right",
                  width: 100,
                  sortAccessor: (row) => row.success,
                  render: (row) => fmt(row.success),
                },
                {
                  key: "failed",
                  header: "Lỗi",
                  align: "right",
                  width: 90,
                  sortAccessor: (row) => row.failed,
                  render: (row) => fmt(row.failed),
                },
                {
                  key: "duplicate",
                  header: "Trùng",
                  align: "right",
                  width: 95,
                  sortAccessor: (row) => row.duplicate,
                  render: (row) => fmt(row.duplicate),
                },
                {
                  key: "rate",
                  header: "Tỷ lệ hợp lệ",
                  align: "right",
                  width: 125,
                  sortAccessor: (row) =>
                    row.total > 0 ? row.success / row.total : 0,
                  render: (row) => pct(row.success, row.total),
                },
                {
                  key: "actor",
                  header: "Người thực hiện",
                  hideOnMobile: true,
                  render: (row) => row.actor || EMPTY_TEXT,
                },
                {
                  key: "status",
                  header: "Trạng thái",
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
              emptyText="Không có batch nào theo bộ lọc."
              renderRowActions={(row) => (
                <ActionButton
                  kind="detail"
                  aria-label={`Chi tiết batch ${row.batchNo}`}
                  sx={{ whiteSpace: "nowrap" }}
                  onClick={() => setOpenBatch(row)}
                >
                  Chi tiết
                </ActionButton>
              )}
              // Trang có thể đặt tới 100 dòng/trang: cuộn trong khung và ghim
              // tiêu đề cột thay vì kéo trang thành một dải rất dài.
              maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
            />
          ) : (
            <Box sx={{ px: { xs: 2, md: 3 }, pb: 1 }}>
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
                  Không có batch nào theo bộ lọc.
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

          <ReportPaginationBar
            page={pagination.page}
            perPage={pagination.perPage}
            total={pagination.total}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPerPage}
          />
        </Box>
      </Box>

      {exporter.exportDenied ? (
        <Box role="alert">
          <UiAlert
            tone="error"
            title="Không có quyền xuất báo cáo"
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      {/* ── Drill-down: một ngày trên biểu đồ diễn biến ──────────────── */}
      {dayDrill ? (
        <DrillDownDialog
          title={`${dayDrill.seriesName} · ngày ${dayjs(dayDrill.day).format(DISPLAY_DATE)}`}
          subtitle="Các batch đã phát sinh trong ngày, theo đúng bộ lọc đang áp dụng."
          onClose={() => setDayDrill(null)}
        >
          <ResponsiveDataTable<ImportMatchBatch>
            columns={[
              {
                key: "batchNo",
                header: keyLabel,
                render: (row) => row.batchNo || EMPTY_TEXT,
              },
              {
                key: "success",
                header: "Hợp lệ",
                align: "right",
                render: (row) => fmt(row.success),
              },
              {
                key: "failed",
                header: "Lỗi",
                align: "right",
                render: (row) => fmt(row.failed),
              },
              {
                key: "duplicate",
                header: "Trùng",
                align: "right",
                render: (row) => fmt(row.duplicate),
              },
              {
                key: "actor",
                header: "Người thực hiện",
                render: (row) => row.actor || EMPTY_TEXT,
              },
            ]}
            rows={batches.filter(
              (batch) => batch.at.slice(0, 10) === dayDrill.day,
            )}
            rowKey={(row) => `${row.context}:${row.id}`}
            emptyText="Ngày này không còn batch nào theo bộ lọc."
          />
        </DrillDownDialog>
      ) : null}

      {/* ── Drill-down: chi tiết một batch ──────────────────────────── */}
      {openBatch ? (
        <DrillDownDialog
          title={`Chi tiết batch · ${openBatch.batchNo || EMPTY_TEXT}`}
          subtitle={`${CONTEXT_LABEL[openBatch.context]} · ${fmt(openBatch.total)} dòng · ${pct(openBatch.success, openBatch.total)} hợp lệ`}
          onClose={() => setOpenBatch(null)}
        >
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}
          >
            <UiStatusBadge
              tone="success"
              label={`Hợp lệ ${fmt(openBatch.success)}`}
            />
            <UiStatusBadge
              tone="error"
              label={`Lỗi ${fmt(openBatch.failed)}`}
            />
            <UiStatusBadge
              tone="warning"
              label={`Trùng ${fmt(openBatch.duplicate)}`}
            />
            {openBatch.errorFileAvailable ? (
              <ActionButton
                kind="download"
                loading={downloading === openBatch.id}
                onClick={() => void downloadErrorFile(openBatch)}
              >
                Tải tệp lỗi
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
                "Thời gian",
                openBatch.at ? fmtDateTime(openBatch.at) : EMPTY_TEXT,
              ],
              ["Người thực hiện", openBatch.actor || EMPTY_TEXT],
              ["Trạng thái", reportStatusLabel(openBatch.status)],
              ...(openBatch.context === "IMPORT"
                ? ([
                    ["Tệp nguồn", openBatch.sourceFile || EMPTY_TEXT],
                    ["Checksum", openBatch.checksum || EMPTY_TEXT],
                    ["Phiên bản nguồn", openBatch.sourceVersion || EMPTY_TEXT],
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
            Dòng lỗi của batch
          </Box>
          <ResponsiveDataTable<BatchErrorLine>
            columns={[
              {
                key: "rowNo",
                header: "Dòng",
                width: 80,
                render: (row) => row.rowNo,
              },
              {
                key: "code",
                header: "Mã lỗi",
                render: (row) => <Box sx={{ fontWeight: 700 }}>{row.code}</Box>,
              },
              {
                key: "message",
                header: "Nội dung",
                render: (row) => row.message || EMPTY_TEXT,
              },
              {
                key: "reference",
                header: "SKU / khóa nghiệp vụ",
                render: (row) => row.reference || EMPTY_TEXT,
              },
            ]}
            rows={openBatch.errors}
            rowKey={(row) => `${row.rowNo}-${row.code}-${row.reference}`}
            emptyText="Batch này không có dòng lỗi nào."
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
                Đối soát tầng dòng SKU
              </Box>
              <ResponsiveDataTable<Raw>
                columns={[
                  {
                    key: "row_no",
                    header: "Dòng",
                    align: "right",
                    width: 80,
                    render: (row) => text(row.row_no),
                  },
                  {
                    key: "source_request_no",
                    header: "Phiếu toa",
                    render: (row) => text(row.source_request_no),
                  },
                  {
                    key: "sku_code",
                    header: "Mã SKU",
                    render: (row) => (
                      <Box sx={{ fontWeight: 700 }}>{text(row.sku_code)}</Box>
                    ),
                  },
                  {
                    key: "required_qty",
                    header: "Yêu cầu",
                    align: "right",
                    width: 100,
                    render: (row) => fmt(n(row.required_qty)),
                  },
                  {
                    key: "matched_qty",
                    header: "Đối chiếu",
                    align: "right",
                    width: 110,
                    render: (row) => fmt(n(row.matched_qty)),
                  },
                  {
                    key: "scanned_qty",
                    header: "Quét",
                    align: "right",
                    width: 90,
                    render: (row) => fmt(n(row.scanned_qty)),
                  },
                  {
                    key: "error_code",
                    header: "Lỗi",
                    render: (row) => text(row.error_code),
                  },
                ]}
                rows={openBatch.matchLines}
                rowKey={(row) => text(row.id, "")}
                emptyText="Batch này không có dòng SKU nào."
              />
            </>
          ) : null}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
