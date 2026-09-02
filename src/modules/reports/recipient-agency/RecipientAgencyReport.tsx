import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiVuexyDateRangePicker,
  UiSelect,
  UiSpinner,
  UiStatusBadge,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import {
  AppstoreOutlined,
  BarChartOutlined,
  FilterOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  SwapOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from "@/shared/components/icons";
import { EMPTY_TEXT, orEmpty } from "@/shared/constants/display";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { MultiSelectFilter } from "@/modules/reports/operations/report-table";
import { usePeriodFilter } from "@/modules/reports/operations/report-period";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import type { ClientSortState } from "@/shared/components/data-display/useClientSort";
import {
  DEFAULT_RECIPIENT_AGENCY_FILTERS,
  exportRecipientAgencyReport,
  RECIPIENT_AGENCY_TIMEZONE,
  useRecipientAgencyDetails,
  useRecipientAgencyFilterOptions,
  useRecipientAgencySummary,
  type RecipientAgencyChartPoint,
  type RecipientAgencyDetails,
  type RecipientAgencyMetrics,
  type RecipientAgencySummaryRow,
} from "./recipient-agency-api";

const RECIPIENT_TYPE_OPTIONS = [
  { value: "DISTRIBUTOR", label: "Nhà phân phối" },
  { value: "AGENCY", label: "Đại lý" },
  { value: "PROJECT_CUSTOMER", label: "Khách công trình" },
  { value: "RETAIL_CUSTOMER", label: "Khách lẻ" },
];

const PRODUCT_TYPE_OPTIONS = [
  { value: "PRODUCT", label: "Sản phẩm" },
  { value: "COMPONENT", label: "Linh kiện" },
];

const REVERSAL_STATE_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái hoàn tác" },
  { value: "NOT_REVERSED", label: "Chưa hoàn tác" },
  { value: "PARTIALLY_REVERSED", label: "Hoàn tác một phần" },
  { value: "FULLY_REVERSED", label: "Hoàn tác toàn bộ" },
];

const EMPTY_METRICS: RecipientAgencyMetrics = {
  gross_issue_posted_qty: "0",
  reversed_issue_qty: "0",
  net_issued_qty: "0",
  posted_document_count: 0,
  reversed_document_count: 0,
  fully_reversed_document_count: 0,
};

function quantity(value: string | number | null | undefined): string {
  const parsed = Number(value);
  return formatQuantity(Number.isFinite(parsed) ? parsed : null);
}

function percentage(part: string | number, total: string | number): number {
  const numerator = Number(part);
  const denominator = Number(total);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  if (denominator <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((numerator / denominator) * 100)),
  );
}

function chartItems(points: RecipientAgencyChartPoint[]) {
  return points.map((point) => ({
    label: point.label || EMPTY_TEXT,
    value: Number(point.net_issued_qty) || 0,
  }));
}

function optionLabel(code: string | null, name: string): string {
  return code ? `${code} · ${name}` : name;
}

function partyLabel(
  party: { code: string | null; name: string | null } | null,
) {
  if (!party) return "Không áp dụng";
  const name = orEmpty(party.name);
  return party.code ? `${party.code} · ${name}` : name;
}

function recipientTypeLabel(type: string | null | undefined) {
  const labels: Record<string, string> = {
    DISTRIBUTOR: "Nhà phân phối",
    AGENCY: "Đại lý",
    PROJECT_CUSTOMER: "Khách hàng công trình",
    RETAIL_CUSTOMER: "Khách hàng bán lẻ",
  };
  return type ? (labels[type] ?? "Nhóm người nhận khác") : EMPTY_TEXT;
}

function eventTypeLabel(type: "ISSUE_POSTED" | "ISSUE_REVERSED") {
  return type === "ISSUE_POSTED" ? "Ghi nhận xuất" : "Hoàn tác xuất";
}

function PiiSummary({
  details,
  canViewPii,
}: {
  details: RecipientAgencyDetails | undefined;
  canViewPii: boolean;
}) {
  const firstPii = details?.rows.find((row) => row.pii)?.pii;
  if (!firstPii) {
    return (
      <UiAlert tone="info">
        Không có thông tin liên hệ trong lát cắt này.
      </UiAlert>
    );
  }
  if (firstPii.masked || !canViewPii) {
    return (
      <UiAlert tone="info">
        Thông tin liên hệ đã được máy chủ che theo quyền của tài khoản.
      </UiAlert>
    );
  }
  return (
    <Box sx={{ display: "grid", gap: 0.5, mt: 1.5, typography: "body2" }}>
      <Box>
        <b>Liên hệ:</b> {orEmpty(firstPii.contact_name)}
      </Box>
      <Box>
        <b>Điện thoại:</b> {orEmpty(firstPii.phone)}
      </Box>
      <Box>
        <b>Email:</b> {orEmpty(firstPii.email)}
      </Box>
      <Box>
        <b>Địa chỉ:</b> {orEmpty(firstPii.address)}
      </Box>
    </Box>
  );
}

const REPORT_SURFACE_SX = {
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  boxShadow: S.shadowCard,
} as const;

const viewTabSx = (active: boolean) => ({
  minWidth: { xs: 0, sm: 132 },
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
  boxShadow: active ? "0 4px 12px rgba(115, 103, 240, 0.25)" : "none",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 140ms cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    bgcolor: active ? S.primaryDark : S.primarySoft,
    color: active ? S.onPrimary : S.primaryDark,
  },
  "&:focus-visible": {
    outline: `2px solid ${S.primary}`,
    outlineOffset: 2,
  },
});

const KPI_TONES = {
  primary: { accent: S.primary, surface: S.primarySoft, text: S.primaryDark },
  success: { accent: S.success, surface: S.successSoft, text: S.successText },
  warning: { accent: S.warning, surface: S.warningSoft, text: S.warningText },
  info: { accent: S.info, surface: S.infoSoft, text: S.infoText },
  neutral: {
    accent: S.secondary,
    surface: S.secondarySoft,
    text: S.secondaryDark,
  },
} as const;

type MetricTone = keyof typeof KPI_TONES;

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  metaLabel,
  metaValue,
  progress,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: ReactElement;
  tone: MetricTone;
  metaLabel: string;
  metaValue: string;
  progress: number;
}) {
  const style = KPI_TONES[tone];
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <Box
      sx={{
        ...REPORT_SURFACE_SX,
        position: "relative",
        overflow: "hidden",
        p: { xs: 1.75, md: 2 },
        minHeight: 166,
        display: "flex",
        flexDirection: "column",
        bgcolor: S.bgSurface,
        backgroundImage: `linear-gradient(145deg, ${S.bgSurface} 30%, ${style.surface})`,
        borderTop: `2px solid ${style.accent}`,
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
            display: "grid",
            placeItems: "center",
            flex: "none",
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
      <Box
        sx={{
          mt: 1,
          minHeight: 18,
          fontSize: 12,
          lineHeight: 1.35,
          color: S.textMedium,
        }}
      >
        {hint}
      </Box>
      <Box sx={{ mt: 1.25 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
        >
          <Box sx={{ fontSize: 11.5, color: S.textMedium }}>{metaLabel}</Box>
          <Box sx={{ fontSize: 11.5, fontWeight: 700, color: style.text }}>
            {metaValue}
          </Box>
        </Stack>
        <Box
          aria-hidden="true"
          sx={{
            mt: 0.75,
            height: 4,
            overflow: "hidden",
            borderRadius: 999,
            bgcolor: style.surface,
          }}
        >
          <Box
            sx={{
              width: `${safeProgress}%`,
              height: "100%",
              borderRadius: "inherit",
              bgcolor: style.accent,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

function SliceReconciliationCard({
  row,
  index,
  onOpen,
}: {
  row: RecipientAgencySummaryRow;
  index: number;
  onOpen: () => void;
}) {
  const netIssued = Number(row.net_issued_qty) || 0;
  return (
    <Box
      data-offline-drill-key={row.drill_key}
      data-offline-drill-title={`${partyLabel(row.recipient)} · ${partyLabel(row.sku)}`}
      sx={{
        ...REPORT_SURFACE_SX,
        minWidth: 0,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        borderTop: `3px solid ${netIssued > 0 ? S.success : S.warning}`,
        backgroundImage: `linear-gradient(145deg, ${S.bgSurface} 58%, ${
          netIssued > 0 ? S.successSoft : S.warningSoft
        })`,
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Box
          sx={{
            px: 1,
            py: 0.45,
            borderRadius: 999,
            bgcolor: S.primarySoft,
            color: S.primaryDark,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.035em",
            textTransform: "uppercase",
          }}
        >
          Lát cắt {String(index + 1).padStart(2, "0")}
        </Box>
        <UiStatusBadge
          tone="neutral"
          label={recipientTypeLabel(row.recipient.type)}
        />
      </Stack>

      <Box sx={{ minWidth: 0 }}>
        <Box
          title={partyLabel(row.recipient)}
          sx={{
            overflow: "hidden",
            color: S.textHigh,
            fontSize: 14,
            fontWeight: 700,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {partyLabel(row.recipient)}
        </Box>
        <Box
          title={partyLabel(row.sku)}
          sx={{
            mt: 0.45,
            overflow: "hidden",
            color: S.primaryDark,
            fontSize: 13,
            fontWeight: 650,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {partyLabel(row.sku)}
        </Box>
        <Box
          sx={{
            mt: 0.65,
            color: S.textMedium,
            fontSize: 11.5,
            lineHeight: 1.45,
          }}
        >
          {row.agency
            ? `Tuyến đại lý: ${partyLabel(row.agency)}`
            : "Xuất trực tiếp, không qua đại lý"}
          <Box component="span" sx={{ mx: 0.75, color: S.border }}>
            •
          </Box>
          Phòng ban: {partyLabel(row.requesting_department)}
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          overflow: "hidden",
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.control}px`,
          bgcolor: S.bgSurface,
        }}
      >
        {[
          ["Tổng xuất", row.gross_issue_posted_qty, S.infoText],
          ["Hoàn tác", row.reversed_issue_qty, S.warningText],
          [
            "Xuất thuần",
            row.net_issued_qty,
            netIssued > 0 ? S.successText : S.textMedium,
          ],
        ].map(([label, value, color], metricIndex) => (
          <Box
            key={String(label)}
            sx={{
              minWidth: 0,
              px: 1.25,
              py: 1.1,
              textAlign: "center",
              borderLeft: metricIndex > 0 ? `1px solid ${S.border}` : undefined,
            }}
          >
            <Box sx={{ color: S.textMedium, fontSize: 10.5 }}>{label}</Box>
            <Box
              sx={{
                mt: 0.3,
                color,
                fontSize: 18,
                fontWeight: 750,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {quantity(value as string | number)}
            </Box>
          </Box>
        ))}
      </Box>

      <Stack
        direction="row"
        sx={{
          mt: "auto",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ color: S.textMedium, fontSize: 11.5 }}>
          {quantity(row.posted_document_count)} chứng từ đã ghi nhận
        </Box>
        <ActionButton kind="detail" onClick={onOpen}>
          Đối soát
        </ActionButton>
      </Stack>
    </Box>
  );
}

function FilterField({
  label,
  children,
  desktopSpan = 3,
  tabletSpan = 1,
}: {
  label: string;
  children: ReactNode;
  desktopSpan?: number;
  tabletSpan?: number;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        position: "relative",
        gridColumn: {
          xs: "span 1",
          sm: `span ${tabletSpan}`,
          xl: `span ${desktopSpan}`,
        },
        "& .MuiFormControl-root, & .MuiButton-root, & .ant-picker": {
          width: "100%",
          minWidth: 0,
        },
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

function ChartPanel({
  title,
  description,
  marker,
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  title: string;
  description: string;
  marker: ReactElement;
  loading: boolean;
  error: unknown;
  empty: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        ...REPORT_SURFACE_SX,
        p: { xs: 2, md: 2.5 },
        minHeight: { md: 420 },
        display: "flex",
        flexDirection: "column",
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
        <Box>
          <Box
            sx={{
              fontSize: TYPOGRAPHY.cardTitle.fontSize,
              fontWeight: 700,
              color: S.textHigh,
            }}
          >
            {title}
          </Box>
          <Box
            sx={{
              mt: 0.5,
              fontSize: 12,
              lineHeight: 1.45,
              color: S.textMedium,
            }}
          >
            {description}
          </Box>
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
            bgcolor: S.primarySoft,
            color: S.primaryDark,
            fontSize: 16,
          }}
        >
          {marker}
        </Box>
      </Stack>
      {error ? (
        <ApiErrorAlert
          error={error}
          title={`Không tải được "${title}"`}
          onRetry={onRetry}
        />
      ) : loading ? (
        <Box sx={{ minHeight: 236, display: "grid", placeItems: "center" }}>
          <UiSpinner />
        </Box>
      ) : empty ? (
        <Box
          sx={{
            minHeight: 236,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            px: 3,
            color: S.textMedium,
            fontSize: TYPOGRAPHY.fontSizeSecondary,
          }}
        >
          Không có dữ liệu theo bộ lọc hiện tại.
        </Box>
      ) : (
        <Box
          sx={{
            minHeight: 300,
            mt: "auto",
            display: "grid",
            alignItems: "stretch",
            "& > div, & .apexcharts-canvas, & svg": {
              width: "100% !important",
            },
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}

/**
 * Report 08 reads one server-side snapshot. It intentionally does not join
 * generic outbound/reversal/user endpoints in the browser: that would alter
 * the ledger formula, department snapshot and document dedupe semantics.
 */
export default function RecipientAgencyReport() {
  // Kỳ mặc định giữ nguyên "tháng này" như 7 báo cáo vận hành còn lại.
  const period = usePeriodFilter("this-month");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [recipientTypes, setRecipientTypes] = useState<string[]>([]);
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [skuIds, setSkuIds] = useState<string[]>([]);
  const [productTypes, setProductTypes] = useState<("PRODUCT" | "COMPONENT")[]>(
    [],
  );
  const [reversalState, setReversalState] = useState<
    "ALL" | "NOT_REVERSED" | "PARTIALLY_REVERSED" | "FULLY_REVERSED"
  >("ALL");
  const [sort, setSort] = useState({
    sortBy: DEFAULT_RECIPIENT_AGENCY_FILTERS.sortBy,
    sortDir: DEFAULT_RECIPIENT_AGENCY_FILTERS.sortDir,
  });
  const [page, setPage] = useState(1);
  const [activeDrill, setActiveDrill] = useState<{
    key: string;
    title: string;
    snapshotId: string;
  } | null>(null);
  const [exporting, setExporting] = useState<"XLSX" | "CSV" | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "snapshot">("table");

  const filters = useMemo(
    () => ({
      ...DEFAULT_RECIPIENT_AGENCY_FILTERS,
      dateFrom: period.from,
      dateTo: period.to,
      timezone: RECIPIENT_AGENCY_TIMEZONE,
      recipientIds,
      recipientTypes,
      agencyIds,
      departmentIds,
      skuIds,
      productTypes,
      reversalState,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
      page,
    }),
    [
      agencyIds,
      departmentIds,
      page,
      period.from,
      period.to,
      productTypes,
      recipientIds,
      recipientTypes,
      reversalState,
      skuIds,
      sort.sortBy,
      sort.sortDir,
    ],
  );
  const summaryQuery = useRecipientAgencySummary(filters);
  const optionQuery = useRecipientAgencyFilterOptions(period.from, period.to);
  const detailsQuery = useRecipientAgencyDetails(
    activeDrill?.snapshotId ?? null,
    activeDrill?.key ?? null,
  );

  const summary = summaryQuery.data;
  const metrics = summary?.kpis ?? EMPTY_METRICS;
  const reversedRate = percentage(
    metrics.reversed_issue_qty,
    metrics.gross_issue_posted_qty,
  );
  const netRate = percentage(
    metrics.net_issued_qty,
    metrics.gross_issue_posted_qty,
  );
  const reversedDocumentRate = percentage(
    metrics.reversed_document_count,
    metrics.posted_document_count,
  );
  const rows = summary?.rows ?? [];
  const options = optionQuery.data;
  const activeFilterCount =
    recipientIds.length +
    recipientTypes.length +
    agencyIds.length +
    departmentIds.length +
    skuIds.length +
    productTypes.length +
    (reversalState === "ALL" ? 0 : 1);

  const sortState: ClientSortState = {
    key: sort.sortBy,
    direction: sort.sortDir === "ASC" ? "asc" : "desc",
  };

  const onSort = (key: string) => {
    const fields: Record<string, string> = {
      recipient: "RECIPIENT_NAME",
      sku: "SKU_CODE",
      gross: "GROSS_ISSUE_POSTED_QTY",
      reversed: "REVERSED_ISSUE_QTY",
      net: "NET_ISSUED_QTY",
      documents: "POSTED_DOCUMENT_COUNT",
    };
    const nextSortBy = fields[key];
    if (!nextSortBy) return;
    setPage(1);
    setSort((current) => ({
      sortBy: nextSortBy,
      sortDir:
        current.sortBy === nextSortBy && current.sortDir === "DESC"
          ? "ASC"
          : "DESC",
    }));
  };

  const resetFilters = () => {
    setRecipientIds([]);
    setRecipientTypes([]);
    setAgencyIds([]);
    setDepartmentIds([]);
    setSkuIds([]);
    setProductTypes([]);
    setReversalState("ALL");
    setPage(1);
  };

  const startExport = async (format: "XLSX" | "CSV", includePii: boolean) => {
    if (!summary?.snapshot_id) return;
    setExporting(format);
    try {
      await exportRecipientAgencyReport({
        snapshotId: summary.snapshot_id,
        format,
        scope: "DETAIL",
        includePii,
      });
      toast.success(`Đã tạo tệp ${format} từ đúng lát cắt đang xem.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Xuất báo cáo thất bại."));
    } finally {
      setExporting(null);
    }
  };

  const tableColumns = [
    {
      key: "recipient",
      header: "Người nhận / đại lý",
      width: 175,
      sortable: true,
      sortType: "text" as const,
      render: (row: RecipientAgencySummaryRow) => (
        <Box sx={{ minWidth: 0, width: "100%" }}>
          <Box
            title={partyLabel(row.recipient)}
            sx={{
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {partyLabel(row.recipient)}
          </Box>
          <Box
            title={`${recipientTypeLabel(row.recipient.type)} · ${
              row.agency
                ? `Tuyến đại lý: ${partyLabel(row.agency)}`
                : "Không qua đại lý"
            }`}
            sx={{
              mt: 0.25,
              typography: "caption",
              color: "text.secondary",
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {recipientTypeLabel(row.recipient.type)} ·{" "}
            {row.agency
              ? `Tuyến đại lý: ${partyLabel(row.agency)}`
              : "Không qua đại lý"}
          </Box>
        </Box>
      ),
    },
    {
      key: "sku",
      header: "Mã hàng / phòng ban",
      width: 175,
      sortable: true,
      sortType: "text" as const,
      render: (row: RecipientAgencySummaryRow) => (
        <Box sx={{ minWidth: 0, width: "100%" }}>
          <Box
            title={partyLabel(row.sku)}
            sx={{
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {partyLabel(row.sku)}
          </Box>
          <Box
            title={`${
              row.sku.product_type === "COMPONENT" ? "Linh kiện" : "Sản phẩm"
            } · ${partyLabel(row.requesting_department)}`}
            sx={{
              mt: 0.25,
              typography: "caption",
              color: "text.secondary",
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.sku.product_type === "COMPONENT" ? "Linh kiện" : "Sản phẩm"}
            {" · "}
            {partyLabel(row.requesting_department)}
          </Box>
        </Box>
      ),
    },
    {
      key: "gross",
      header: "Tổng xuất",
      width: 80,
      align: "right" as const,
      sortable: true,
      sortType: "value" as const,
      render: (row: RecipientAgencySummaryRow) =>
        quantity(row.gross_issue_posted_qty),
    },
    {
      key: "reversed",
      header: "Hoàn tác",
      width: 80,
      align: "right" as const,
      sortable: true,
      sortType: "value" as const,
      render: (row: RecipientAgencySummaryRow) =>
        quantity(row.reversed_issue_qty),
    },
    {
      key: "net",
      header: "Xuất thuần",
      width: 80,
      align: "right" as const,
      sortable: true,
      sortType: "value" as const,
      render: (row: RecipientAgencySummaryRow) => (
        <Box
          sx={{
            display: "inline-flex",
            minWidth: 54,
            justifyContent: "flex-end",
            px: 1,
            py: 0.45,
            borderRadius: `${RADIUS.control}px`,
            bgcolor:
              Number(row.net_issued_qty) > 0 ? S.successSoft : S.secondarySoft,
            color:
              Number(row.net_issued_qty) > 0 ? S.successText : S.textMedium,
            fontWeight: 700,
          }}
        >
          {quantity(row.net_issued_qty)}
        </Box>
      ),
    },
    {
      key: "documents",
      header: "Chứng từ",
      width: 80,
      align: "right" as const,
      sortable: true,
      sortType: "value" as const,
      hideOnMobile: true,
      render: (row: RecipientAgencySummaryRow) =>
        quantity(row.posted_document_count),
    },
  ];

  return (
    <Box
      data-testid="report-08-recipient-agency"
      sx={{
        width: "100%",
        minWidth: 0,
        position: "relative",
        display: "grid",
        gap: { xs: 1.5, md: 2.25 },
        "& > *": { minWidth: 0 },
      }}
    >
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          minHeight: { md: 68 },
          px: { md: 0.25 },
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
              BÁO CÁO VẬN HÀNH
            </Box>
            <Box
              component="h1"
              id="report-08-title"
              sx={{
                m: 0.25,
                fontSize: { xs: 22, md: 25 },
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
                color: S.textHigh,
              }}
            >
              Xuất theo người nhận / đại lý
            </Box>
            <Box
              sx={{
                mt: 0.5,
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                color: S.textMedium,
              }}
            >
              Theo dõi lượng xuất đã ghi nhận, lượng hoàn tác và lượng xuất
              thuần trong cùng một lát cắt dữ liệu.
            </Box>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
        >
          <UiStatusBadge
            tone={
              summaryQuery.isFetching
                ? "warning"
                : summary
                  ? "success"
                  : "neutral"
            }
            label={
              summaryQuery.isFetching
                ? "Đang đồng bộ"
                : summary
                  ? "Đã chốt dữ liệu"
                  : "Chờ dữ liệu"
            }
          />
          <UiButton
            appearance="outlined"
            startIcon={<ReloadOutlined />}
            onClick={() => {
              void summaryQuery.refetch();
              void optionQuery.refetch();
            }}
            disabled={period.invalid || summaryQuery.isFetching}
          >
            Làm mới
          </UiButton>
        </Stack>
      </Box>

      <Box
        component="section"
        aria-label="Ngữ cảnh lát cắt báo cáo"
        sx={{
          ...REPORT_SURFACE_SX,
          position: "relative",
          overflow: "hidden",
          p: { xs: 2, md: 2.25 },
          minHeight: { md: 112 },
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
        <Box
          sx={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
            gap: 2,
            alignItems: "center",
          }}
        >
          <Box>
            <Box
              sx={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                opacity: 0.82,
              }}
            >
              LÁT CẮT ĐANG XEM
            </Box>
            <Box
              sx={{
                mt: 0.5,
                fontSize: { xs: 19, md: 22 },
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              {period.label}
            </Box>
            <Box
              sx={{
                mt: 1,
                maxWidth: 640,
                fontSize: 13,
                lineHeight: 1.5,
                opacity: 0.9,
              }}
            >
              Xuất thuần = tổng lượng xuất đã ghi nhận − lượng hoàn tác phát
              sinh trong cùng kỳ. Đại lý là chiều thống kê, không phải kho.
            </Box>
          </Box>
          <Stack
            direction={{ xs: "row", md: "column" }}
            spacing={1}
            sx={{
              alignItems: { xs: "stretch", md: "flex-end" },
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: `${RADIUS.control}px`,
                bgcolor: S.primaryDark,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {summary ? "Lát cắt đã khóa" : "Đang tạo lát cắt"}
            </Box>
            <Box
              sx={{
                fontSize: 12,
                opacity: 0.82,
                textAlign: { xs: "left", md: "right" },
              }}
            >
              {summary
                ? `Chốt lúc ${formatDateTime(summary.as_of)}`
                : "Múi giờ Việt Nam (UTC+7)"}
            </Box>
          </Stack>
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="report-08-filters"
        sx={{ ...REPORT_SURFACE_SX, overflow: "visible" }}
      >
        <Box
          sx={{
            px: { xs: 1.75, md: 2.5 },
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            borderBottom:
              viewMode === "table" || filtersExpanded
                ? `1px solid ${S.border}`
                : "none",
            minHeight: { md: 64 },
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 30,
                height: 30,
                display: "grid",
                placeItems: "center",
                borderRadius: `${RADIUS.control}px`,
                bgcolor: S.primarySoft,
                color: S.primaryDark,
                fontSize: 15,
              }}
            >
              <FilterOutlined />
            </Box>
            <Box>
              <Box
                id="report-08-filters"
                sx={{
                  fontSize: TYPOGRAPHY.fontSizeSecondary,
                  fontWeight: 700,
                  color: S.textHigh,
                }}
              >
                Bộ lọc báo cáo
              </Box>
              <Box sx={{ mt: 0.2, fontSize: 12, color: S.textMedium }}>
                Trong cùng bộ lọc dùng điều kiện HOẶC; giữa các bộ lọc dùng điều
                kiện VÀ.
              </Box>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flex: "none" }}
          >
            {viewMode === "snapshot" && !filtersExpanded ? (
              <UiStatusBadge tone="neutral" label={period.label} />
            ) : null}
            {activeFilterCount > 0 ? (
              <UiStatusBadge
                tone="primary"
                label={`${activeFilterCount} đang chọn`}
              />
            ) : null}
            <UiButton
              appearance={filtersExpanded ? "tonal" : "outlined"}
              startIcon={<FilterOutlined />}
              aria-expanded={filtersExpanded}
              aria-controls="report-08-filter-fields"
              onClick={() => setFiltersExpanded((current) => !current)}
              sx={{
                display: {
                  xs: "inline-flex",
                  md: viewMode === "snapshot" ? "inline-flex" : "none",
                },
              }}
            >
              {filtersExpanded ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
            </UiButton>
            <UiButton
              appearance="text"
              onClick={resetFilters}
              sx={{
                display: {
                  xs: filtersExpanded ? "inline-flex" : "none",
                  md:
                    viewMode === "table" || filtersExpanded
                      ? "inline-flex"
                      : "none",
                },
              }}
            >
              Đặt lại
            </UiButton>
          </Stack>
        </Box>
        <Box
          id="report-08-filter-fields"
          sx={{
            p: { xs: 1.75, md: 2.5 },
            pt: { md: 2.25 },
            display: {
              xs: filtersExpanded ? "grid" : "none",
              md: viewMode === "table" || filtersExpanded ? "grid" : "none",
            },
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(12, minmax(0, 1fr))",
            },
            columnGap: 1.5,
            rowGap: 1.75,
          }}
        >
          <FilterField label="Kỳ báo cáo" desktopSpan={3}>
            <UiSelect
              aria-label="Kỳ báo cáo"
              fullWidth
              value={period.preset}
              onChange={(value) =>
                period.setPreset(value as typeof period.preset)
              }
              options={[
                { value: "this-week", label: "Tuần này" },
                { value: "this-month", label: "Tháng này" },
                { value: "this-quarter", label: "Quý này" },
                { value: "this-year", label: "Năm này" },
                { value: "custom", label: "Tùy chọn" },
              ]}
            />
          </FilterField>
          <FilterField label="Trạng thái hoàn tác" desktopSpan={3}>
            <UiSelect
              aria-label="Trạng thái hoàn tác"
              fullWidth
              value={reversalState}
              onChange={(value) => {
                setReversalState(value as typeof reversalState);
                setPage(1);
              }}
              options={REVERSAL_STATE_OPTIONS}
            />
          </FilterField>
          <FilterField label="Khoảng ngày" desktopSpan={6} tabletSpan={2}>
            <UiVuexyDateRangePicker
              aria-label="Từ ngày đến ngày"
              value={period.range}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              allowClear={false}
              className="hn-vuexy-date-range"
              popupClassName="hn-vuexy-date-popup"
              onChange={(value) => {
                if (value?.[0] && value?.[1])
                  period.setRange([value[0], value[1]]);
              }}
            />
          </FilterField>
          <FilterField label="Loại người nhận">
            <MultiSelectFilter
              minWidth={0}
              ariaLabel="Lọc loại người nhận"
              placeholder="Tất cả loại người nhận"
              options={RECIPIENT_TYPE_OPTIONS}
              value={recipientTypes}
              onChange={(value) => {
                setRecipientTypes(value);
                setPage(1);
              }}
            />
          </FilterField>
          <FilterField label="Người nhận">
            <MultiSelectFilter
              minWidth={0}
              ariaLabel="Lọc người nhận"
              placeholder="Tất cả người nhận"
              options={(options?.recipients ?? []).map((item) => ({
                value: item.id,
                label: optionLabel(item.code, item.name),
              }))}
              value={recipientIds}
              onChange={(value) => {
                setRecipientIds(value);
                setPage(1);
              }}
            />
          </FilterField>
          <FilterField label="Đại lý">
            <MultiSelectFilter
              minWidth={0}
              ariaLabel="Lọc đại lý"
              placeholder="Tất cả đại lý"
              options={(options?.agencies ?? []).map((item) => ({
                value: item.id,
                label: optionLabel(item.code, item.name),
              }))}
              value={agencyIds}
              onChange={(value) => {
                setAgencyIds(value);
                setPage(1);
              }}
            />
          </FilterField>
          <FilterField label="Phòng ban yêu cầu">
            <MultiSelectFilter
              minWidth={0}
              ariaLabel="Lọc phòng ban yêu cầu"
              placeholder="Tất cả phòng ban"
              options={(options?.departments ?? []).map((item) => ({
                value: item.id,
                label: optionLabel(item.code, item.name),
              }))}
              value={departmentIds}
              onChange={(value) => {
                setDepartmentIds(value);
                setPage(1);
              }}
            />
          </FilterField>
          <FilterField label="Mã hàng (SKU)" desktopSpan={6}>
            <MultiSelectFilter
              minWidth={0}
              ariaLabel="Lọc SKU"
              placeholder="Tất cả mã hàng"
              options={(options?.skus ?? []).map((item) => ({
                value: item.id,
                label: optionLabel(item.code, item.name),
              }))}
              value={skuIds}
              onChange={(value) => {
                setSkuIds(value);
                setPage(1);
              }}
            />
          </FilterField>
          <FilterField label="Loại hàng" desktopSpan={6}>
            <MultiSelectFilter
              minWidth={0}
              ariaLabel="Lọc loại hàng"
              placeholder="Sản phẩm và linh kiện"
              options={PRODUCT_TYPE_OPTIONS}
              value={productTypes}
              onChange={(value) => {
                setProductTypes(
                  value.filter(
                    (item): item is "PRODUCT" | "COMPONENT" =>
                      item === "PRODUCT" || item === "COMPONENT",
                  ),
                );
                setPage(1);
              }}
            />
          </FilterField>
        </Box>
      </Box>

      {period.invalid ? (
        <UiAlert tone="error">Từ ngày không thể sau đến ngày.</UiAlert>
      ) : null}
      {summaryQuery.error ? (
        <ApiErrorAlert
          error={summaryQuery.error}
          title="Không thể tạo lát cắt báo cáo"
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}

      <Box component="section" aria-labelledby="report-08-kpis">
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1.25,
          }}
        >
          <Box>
            <Box
              id="report-08-kpis"
              sx={{
                fontSize: TYPOGRAPHY.cardTitle.fontSize,
                fontWeight: 700,
                color: S.textHigh,
              }}
            >
              Tổng quan vận hành
            </Box>
            <Box sx={{ mt: 0.25, fontSize: 12, color: S.textMedium }}>
              Số liệu theo lát cắt đã khóa, không suy diễn từ tồn kho hiện tại.
            </Box>
          </Box>
          <UiStatusBadge tone="neutral" label="Múi giờ Việt Nam (UTC+7)" />
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: "repeat(4, minmax(0, 1fr))",
            },
            gap: 1.5,
          }}
        >
          <MetricCard
            label="Tổng lượng xuất"
            value={quantity(metrics.gross_issue_posted_qty)}
            hint="Lượng xuất đã ghi nhận trong kỳ"
            tone="info"
            icon={<ShopOutlined />}
            metaLabel="Chuẩn đối chiếu"
            metaValue="100%"
            progress={100}
          />
          <MetricCard
            label="Đã hoàn tác"
            value={quantity(metrics.reversed_issue_qty)}
            hint="Lượng xuất đã hoàn tác trong kỳ"
            tone="warning"
            icon={<SwapOutlined />}
            metaLabel="Tỷ lệ hoàn tác"
            metaValue={`${reversedRate}%`}
            progress={reversedRate}
          />
          <MetricCard
            label="Xuất thuần"
            value={quantity(metrics.net_issued_qty)}
            hint="Tổng lượng xuất trừ lượng hoàn tác"
            tone="success"
            icon={<SafetyCertificateOutlined />}
            metaLabel="Tỷ lệ xuất thuần"
            metaValue={`${netRate}%`}
            progress={netRate}
          />
          <MetricCard
            label="Chứng từ đã ghi nhận"
            value={quantity(metrics.posted_document_count)}
            hint="Số chứng từ xuất không trùng"
            tone="neutral"
            icon={<TeamOutlined />}
            metaLabel="Chứng từ có hoàn tác"
            metaValue={`${reversedDocumentRate}%`}
            progress={reversedDocumentRate}
          />
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="report-08-common-analysis"
        sx={{
          display: "grid",
          gap: 1.25,
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box>
            <Box
              id="report-08-common-analysis"
              sx={{
                color: S.textHigh,
                fontSize: TYPOGRAPHY.cardTitle.fontSize,
                fontWeight: 700,
              }}
            >
              Phân tích xuất thuần
            </Box>
            <Box sx={{ mt: 0.25, color: S.textMedium, fontSize: 12 }}>
              Dữ liệu dùng chung theo người nhận và mã hàng trong lát cắt đang
              xem.
            </Box>
          </Box>
          <UiStatusBadge tone="neutral" label="Dữ liệu dùng chung" />
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          <ChartPanel
            title="Xuất thuần theo người nhận"
            description="Xếp hạng người nhận theo lượng xuất thuần. Chọn thanh dữ liệu để đối soát chứng từ nguồn."
            marker={<ShopOutlined />}
            loading={summaryQuery.isLoading}
            error={summaryQuery.error}
            onRetry={() => void summaryQuery.refetch()}
            empty={Boolean(summary && !summary.chart_by_recipient.length)}
          >
            <HorizontalBarChart
              items={chartItems(summary?.chart_by_recipient ?? [])}
              height={300}
              valueFormatter={quantity}
              color={CHART_COLORS.primary}
              onSelect={(item) => {
                const point = (summary?.chart_by_recipient ?? []).find(
                  (candidate) => candidate.label === item.label,
                );
                if (point)
                  setActiveDrill({
                    key: point.drill_key,
                    title: item.label,
                    snapshotId: summary?.snapshot_id ?? "",
                  });
              }}
            />
          </ChartPanel>
          <ChartPanel
            title="Xuất thuần theo mã hàng"
            description="So sánh sản phẩm và linh kiện theo đúng loại hàng tại thời điểm ghi nhận."
            marker={<FileTextOutlined />}
            loading={summaryQuery.isLoading}
            error={summaryQuery.error}
            onRetry={() => void summaryQuery.refetch()}
            empty={Boolean(summary && !summary.chart_by_sku.length)}
          >
            <HorizontalBarChart
              items={chartItems(summary?.chart_by_sku ?? [])}
              height={300}
              valueFormatter={quantity}
              color={CHART_COLORS.info}
              onSelect={(item) => {
                const point = (summary?.chart_by_sku ?? []).find(
                  (candidate) => candidate.label === item.label,
                );
                if (point)
                  setActiveDrill({
                    key: point.drill_key,
                    title: item.label,
                    snapshotId: summary?.snapshot_id ?? "",
                  });
              }}
            />
          </ChartPanel>
        </Box>
      </Box>

      <Box
        component="section"
        aria-label="Chọn chế độ đối soát"
        sx={{
          ...REPORT_SURFACE_SX,
          p: 1,
          display: "flex",
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.25,
          borderTop: `2px solid ${S.primary}`,
        }}
      >
        <Box sx={{ px: { xs: 0.5, sm: 1 } }}>
          <Box sx={{ color: S.textHigh, fontSize: 13, fontWeight: 700 }}>
            Chế độ đối soát
          </Box>
          <Box sx={{ mt: 0.2, color: S.textMedium, fontSize: 12 }}>
            Chuyển linh hoạt giữa bảng nghiệp vụ và thẻ lát cắt trực quan.
          </Box>
        </Box>
        <Box
          role="tablist"
          aria-label="Chế độ xem đối soát"
          sx={{
            p: 0.5,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 0.5,
            borderRadius: `${RADIUS.control}px`,
            bgcolor: S.bgSubtle,
          }}
        >
          <Box
            component="button"
            type="button"
            role="tab"
            id="report-08-view-table"
            data-report-view-switch="table"
            aria-controls="report-08-panel-table"
            aria-selected={viewMode === "table"}
            tabIndex={viewMode === "table" ? 0 : -1}
            onClick={() => setViewMode("table")}
            sx={viewTabSx(viewMode === "table")}
          >
            <UnorderedListOutlined aria-hidden="true" />
            Bảng
          </Box>
          <Box
            component="button"
            type="button"
            role="tab"
            id="report-08-view-snapshot"
            data-report-view-switch="snapshot"
            aria-controls="report-08-panel-snapshot"
            aria-selected={viewMode === "snapshot"}
            tabIndex={viewMode === "snapshot" ? 0 : -1}
            onClick={() => {
              setViewMode("snapshot");
              setFiltersExpanded(false);
            }}
            sx={viewTabSx(viewMode === "snapshot")}
          >
            <AppstoreOutlined aria-hidden="true" />
            Lát cắt
          </Box>
        </Box>
      </Box>

      <Box
        id="report-08-panel-snapshot"
        data-report-view-panel="snapshot"
        role="tabpanel"
        aria-labelledby="report-08-view-snapshot"
        sx={{
          display: viewMode === "snapshot" ? "block" : "none",
          minWidth: 0,
        }}
      >
        <Box
          component="section"
          aria-labelledby="report-08-snapshot-data"
          sx={{
            ...REPORT_SURFACE_SX,
            overflow: "hidden",
            borderTop: `3px solid ${S.primary}`,
          }}
        >
          <Box
            sx={{
              px: { xs: 1.75, md: 2.5 },
              py: { xs: 1.75, md: 2 },
              display: "flex",
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1.5,
              borderBottom: `1px solid ${S.border}`,
              bgcolor: S.bgSubtle,
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 30,
                  height: 30,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: `${RADIUS.control}px`,
                  bgcolor: S.primarySoft,
                  color: S.primaryDark,
                  fontSize: 15,
                }}
              >
                <AppstoreOutlined />
              </Box>
              <Box>
                <Box
                  id="report-08-snapshot-data"
                  sx={{
                    color: S.textHigh,
                    fontSize: TYPOGRAPHY.cardTitle.fontSize,
                    fontWeight: 700,
                  }}
                >
                  Dữ liệu lát cắt
                </Box>
                <Box sx={{ mt: 0.35, color: S.textMedium, fontSize: 12 }}>
                  Mỗi thẻ là một cặp người nhận – mã hàng từ đúng dữ liệu đã
                  chốt.
                </Box>
              </Box>
            </Stack>
            <UiStatusBadge tone="neutral" label={`${rows.length} lát cắt`} />
          </Box>

          <Box
            sx={{
              p: { xs: 1.5, md: 2.5 },
              maxHeight: { md: 560 },
              overflowY: { md: "auto" },
              bgcolor: S.bgSubtle,
            }}
          >
            {summaryQuery.isLoading ? (
              <Box
                sx={{
                  minHeight: 180,
                  display: "grid",
                  placeItems: "center",
                  color: S.textMedium,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <UiSpinner size={18} label={null} />
                  <Box>Đang tải dữ liệu lát cắt...</Box>
                </Stack>
              </Box>
            ) : rows.length ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    lg: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                {rows.map((row, index) => (
                  <SliceReconciliationCard
                    key={row.drill_key}
                    row={row}
                    index={index}
                    onOpen={() =>
                      setActiveDrill({
                        key: row.drill_key,
                        title: `${partyLabel(row.recipient)} · ${partyLabel(row.sku)}`,
                        snapshotId: summary?.snapshot_id ?? "",
                      })
                    }
                  />
                ))}
              </Box>
            ) : (
              <Box sx={{ py: 6, textAlign: "center", color: S.textMedium }}>
                Không có dữ liệu lát cắt phù hợp với bộ lọc hiện tại.
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box
        id="report-08-panel-table"
        data-report-view-panel="table"
        role="tabpanel"
        aria-labelledby="report-08-view-table"
        sx={{ display: viewMode === "table" ? "block" : "none", minWidth: 0 }}
      >
        <Box component="section" aria-labelledby="report-08-table">
          <Box
            sx={{
              ...REPORT_SURFACE_SX,
              overflow: "hidden",
              borderTop: `3px solid ${S.info}`,
            }}
          >
            <Box
              sx={{
                px: { xs: 1.75, md: 2.5 },
                py: { xs: 1.75, md: 2 },
                display: "flex",
                alignItems: { xs: "flex-start", md: "center" },
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1.5,
                borderBottom: `1px solid ${S.border}`,
                bgcolor: S.bgSubtle,
              }}
            >
              <Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 30,
                      height: 30,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: `${RADIUS.control}px`,
                      bgcolor: S.infoSoft,
                      color: S.infoText,
                      fontSize: 15,
                    }}
                  >
                    <BarChartOutlined />
                  </Box>
                  <Box
                    id="report-08-table"
                    sx={{
                      fontSize: TYPOGRAPHY.cardTitle.fontSize,
                      fontWeight: 700,
                      color: S.textHigh,
                    }}
                  >
                    Bảng đối soát xuất thuần
                  </Box>
                </Stack>
                <Box sx={{ mt: 0.75, fontSize: 12, color: S.textMedium }}>
                  {summary
                    ? `Lát cắt dữ liệu ${summary.snapshot_id} · chốt lúc ${formatDateTime(summary.as_of)}`
                    : "Chờ máy chủ trả lát cắt dữ liệu."}
                </Box>
              </Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", rowGap: 1 }}
              >
                <ActionButton
                  kind="exportExcel"
                  module="reports"
                  action="export"
                  permissionCode={WMS_PERMISSION_CATALOG.REPORT_EXPORT}
                  mode="disable"
                  loading={exporting === "XLSX"}
                  disabled={
                    Boolean(exporting) ||
                    !summary?.snapshot_id ||
                    !summary.permissions?.can_export
                  }
                  onClick={() => void startExport("XLSX", false)}
                >
                  Xuất XLSX
                </ActionButton>
                <ActionButton
                  kind="export"
                  module="reports"
                  action="export"
                  permissionCode={WMS_PERMISSION_CATALOG.REPORT_EXPORT}
                  mode="disable"
                  loading={exporting === "CSV"}
                  disabled={
                    Boolean(exporting) ||
                    !summary?.snapshot_id ||
                    !summary.permissions?.can_export_pii
                  }
                  disabledTooltip="Dự án chưa mở quyền xuất thông tin cá nhân của người nhận cho báo cáo này."
                  onClick={() => void startExport("CSV", true)}
                >
                  Xuất CSV có thông tin cá nhân
                </ActionButton>
              </Stack>
            </Box>
            <Box
              sx={{
                px: { xs: 1.25, md: 2.5 },
                py: { xs: 1.5, md: 2 },
                "& table": {
                  fontVariantNumeric: "tabular-nums",
                  tableLayout: "fixed",
                },
                "& th, & td": {
                  overflow: "hidden",
                  boxSizing: "border-box",
                  overflowWrap: "normal !important",
                  wordBreak: "normal",
                },
                "& th:nth-of-type(1), & td:nth-of-type(1)": {
                  width: "23% !important",
                },
                "& th:nth-of-type(2), & td:nth-of-type(2)": {
                  width: "23% !important",
                },
                "& th:nth-of-type(3), & td:nth-of-type(3), & th:nth-of-type(4), & td:nth-of-type(4), & th:nth-of-type(5), & td:nth-of-type(5)":
                  {
                    width: "10% !important",
                    whiteSpace: "nowrap",
                  },
                "& th:nth-of-type(6), & td:nth-of-type(6)": {
                  width: "9% !important",
                  whiteSpace: "nowrap",
                },
                "& th:nth-of-type(7), & td:nth-of-type(7)": {
                  width: "15% !important",
                  whiteSpace: "nowrap",
                },
                "& thead th": {
                  bgcolor: `${S.primarySoft} !important`,
                  color: `${S.primaryDark} !important`,
                  fontWeight: "700 !important",
                  whiteSpace: "normal !important",
                  lineHeight: "1.3 !important",
                },
                "& tbody tr:nth-of-type(even)": { bgcolor: S.bgSubtle },
                "& tbody tr:hover": { bgcolor: `${S.primarySoft} !important` },
                "& tbody td": {
                  py: "13px !important",
                  verticalAlign: "middle",
                },
                "& tbody td:nth-of-type(3), & tbody td:nth-of-type(4), & tbody td:nth-of-type(5), & tbody td:nth-of-type(6)":
                  {
                    fontWeight: 650,
                  },
                "& tbody td:last-of-type button": {
                  width: "100%",
                  minWidth: 0,
                  px: "8px !important",
                },
              }}
            >
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Box sx={{ fontSize: 12, color: S.textMedium }}>
                  Chọn một dòng để xem chứng từ nguồn, lịch sử hoàn tác và thông
                  tin cá nhân theo quyền.
                </Box>
                {summary ? (
                  <UiStatusBadge
                    tone="neutral"
                    label={`${summary.page.total} nhóm dữ liệu`}
                  />
                ) : null}
              </Stack>
              <ResponsiveDataTable
                columns={tableColumns}
                rows={rows}
                rowKey={(row) => row.drill_key}
                loading={summaryQuery.isLoading}
                sortState={sortState}
                onSortChange={onSort}
                onRowClick={(row) =>
                  setActiveDrill({
                    key: row.drill_key,
                    title: `${partyLabel(row.recipient)} · ${partyLabel(row.sku)}`,
                    snapshotId: summary?.snapshot_id ?? "",
                  })
                }
                emptyText="Không có nghiệp vụ xuất hoặc hoàn tác phù hợp với bộ lọc hiện tại."
                mobileBreakpoint="sm"
                renderRowActions={(row) => (
                  <Box
                    data-offline-drill-key={row.drill_key}
                    data-offline-drill-title={`${partyLabel(row.recipient)} · ${partyLabel(row.sku)}`}
                    sx={{
                      display: "flex",
                      width: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    <ActionButton
                      kind="detail"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveDrill({
                          key: row.drill_key,
                          title: `${partyLabel(row.recipient)} · ${partyLabel(row.sku)}`,
                          snapshotId: summary?.snapshot_id ?? "",
                        });
                      }}
                    >
                      Đối soát
                    </ActionButton>
                  </Box>
                )}
              />
            </Box>
            <Box
              sx={{
                px: { xs: 1.75, md: 2.5 },
                py: 1.25,
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                borderTop: `1px solid ${S.border}`,
                bgcolor: S.bgSubtle,
                fontSize: 12,
                lineHeight: 1.45,
                color: S.textMedium,
              }}
            >
              <SafetyCertificateOutlined aria-hidden="true" />
              <Box>
                <Box component="strong" sx={{ color: S.textHigh }}>
                  Cách tính đã khóa:
                </Box>{" "}
                Xuất thuần = tổng lượng xuất đã ghi nhận − lượng hoàn tác. Số
                chứng từ được đếm không trùng trong kỳ và không bị trừ khi hoàn
                tác.
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {activeDrill ? (
        <DrillDownDialog
          title={`Đối soát: ${activeDrill.title}`}
          subtitle={
            activeDrill.snapshotId
              ? `Lát cắt dữ liệu ${activeDrill.snapshotId}`
              : undefined
          }
          onClose={() => setActiveDrill(null)}
          maxWidth="xl"
        >
          {detailsQuery.error ? (
            <ApiErrorAlert
              error={detailsQuery.error}
              title="Không tải được chứng từ nguồn"
              onRetry={() => void detailsQuery.refetch()}
            />
          ) : null}
          <ResponsiveDataTable
            columns={[
              {
                key: "outbound",
                header: "Chứng từ",
                render: (row) => (
                  <Box>
                    <Box sx={{ fontWeight: 700 }}>{row.outbound_no}</Box>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      Toa nguồn: {orEmpty(row.source_request_no)}
                    </Box>
                  </Box>
                ),
              },
              {
                key: "event",
                header: "Nghiệp vụ / thời điểm",
                render: (row) =>
                  `${eventTypeLabel(row.event_type)} · ${formatDateTime(row.occurred_at)}`,
              },
              {
                key: "gross",
                header: "Tổng lượng xuất",
                align: "right",
                render: (row) => quantity(row.gross_issue_posted_qty),
              },
              {
                key: "reversed",
                header: "Đã hoàn tác",
                align: "right",
                render: (row) => quantity(row.reversed_issue_qty),
              },
              {
                key: "net",
                header: "Xuất thuần",
                align: "right",
                render: (row) => quantity(row.net_issued_qty),
              },
              {
                key: "reversal",
                header: "Mã nghiệp vụ gốc",
                hideOnMobile: true,
                render: (row) => orEmpty(row.reversal_of_event_id),
              },
            ]}
            rows={detailsQuery.data?.rows ?? []}
            rowKey={(row) => row.event_id}
            loading={detailsQuery.isLoading}
            emptyText="Không có nghiệp vụ nguồn cho lát cắt dữ liệu này."
          />
          <PiiSummary
            details={detailsQuery.data}
            canViewPii={Boolean(summary?.permissions?.can_view_pii)}
          />
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
