import { useRenderWindow } from "@/shared/components/data-display/useRenderWindow";
import { useTabView } from "@/shared/ui/use-tab-view";
import { WindowedMore } from "@/shared/components/data-display/WindowedMore";
import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
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
  FILTER_GRID_COLUMNS_SX,
  filterGridColumnSx,
} from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useReportRangeAdvice } from "@/modules/reports/operations/report-coverage";
import { OUTBOUND_RECIPIENT_COVERAGE_PROBE } from "@/modules/reports/operations/report-probes";
import { ReportRangeAdviceBanner } from "@/modules/reports/operations/ReportRangeAdviceBanner";
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
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import { usePeriodFilter } from "@/modules/reports/operations/report-period";
import {
  RPT_CONTROL_MOTION_SX,
  RPT_SCROLL_MAX_HEIGHT,
} from "@/modules/reports/operations/report-tokens";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { tStatic, useT, type TranslateFn } from "@/shared/i18n/useT";
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
import AgencyComparisonTab from "./AgencyComparisonTab";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

const recipientTypeOptions = (t: TranslateFn) => [
  { value: "DISTRIBUTOR", label: t("reports.recipientAgency.typeDistributor") },
  { value: "AGENCY", label: t("reports.recipientAgency.typeAgency") },
  {
    value: "PROJECT_CUSTOMER",
    label: t("reports.recipientAgency.typeProjectCustomer"),
  },
  {
    value: "RETAIL_CUSTOMER",
    label: t("reports.recipientAgency.typeRetailCustomer"),
  },
];

const productTypeOptions = (t: TranslateFn) => [
  { value: "PRODUCT", label: t("reports.recipientAgency.typeProduct") },
  { value: "COMPONENT", label: t("reports.recipientAgency.typeComponent") },
];

const reversalStateOptions = (t: TranslateFn) => [
  { value: "ALL", label: t("reports.recipientAgency.reversalAll") },
  { value: "NOT_REVERSED", label: t("reports.recipientAgency.reversalNone") },
  {
    value: "PARTIALLY_REVERSED",
    label: t("reports.recipientAgency.reversalPartial"),
  },
  {
    value: "FULLY_REVERSED",
    label: t("reports.recipientAgency.reversalFull"),
  },
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
  if (!party) return tStatic("reports.recipientAgency.notApplicable");
  const name = orEmpty(party.name);
  return party.code ? `${party.code} · ${name}` : name;
}

function recipientTypeLabel(type: string | null | undefined) {
  const labels: Record<string, string> = {
    DISTRIBUTOR: tStatic("reports.recipientAgency.typeDistributor"),
    AGENCY: tStatic("reports.recipientAgency.typeAgency"),
    PROJECT_CUSTOMER: tStatic(
      "reports.recipientAgency.typeProjectCustomerFull",
    ),
    RETAIL_CUSTOMER: tStatic("reports.recipientAgency.typeRetailCustomerFull"),
  };
  return type
    ? (labels[type] ?? tStatic("reports.recipientAgency.typeOther"))
    : EMPTY_TEXT;
}

function eventTypeLabel(type: "ISSUE_POSTED" | "ISSUE_REVERSED") {
  return type === "ISSUE_POSTED"
    ? tStatic("reports.recipientAgency.eventPosted")
    : tStatic("reports.recipientAgency.eventReversed");
}

function PiiSummary({
  details,
  canViewPii,
}: {
  details: RecipientAgencyDetails | undefined;
  canViewPii: boolean;
}) {
  const t = useT();
  const firstPii = details?.rows.find((row) => row.pii)?.pii;
  if (!firstPii) {
    return (
      <UiAlert tone="info">{t("reports.recipientAgency.piiNone")}</UiAlert>
    );
  }
  if (firstPii.masked || !canViewPii) {
    return (
      <UiAlert tone="info">{t("reports.recipientAgency.piiMasked")}</UiAlert>
    );
  }
  return (
    <Box sx={{ display: "grid", gap: 0.5, mt: 1.5, typography: "body2" }}>
      <Box>
        <b>{t("reports.recipientAgency.piiContact")}</b>{" "}
        {orEmpty(firstPii.contact_name)}
      </Box>
      <Box>
        <b>{t("reports.recipientAgency.piiPhone")}</b> {orEmpty(firstPii.phone)}
      </Box>
      <Box>
        <b>{t("reports.recipientAgency.piiEmail")}</b> {orEmpty(firstPii.email)}
      </Box>
      <Box>
        <b>{t("reports.recipientAgency.piiAddress")}</b>{" "}
        {orEmpty(firstPii.address)}
      </Box>
    </Box>
  );
}

/** Mảng rỗng dùng chung khi drill-down chưa có dữ liệu. */
const EMPTY_DRILL_ROWS: RecipientAgencyDetails["rows"] = [];

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
  // `transition: all` sẽ animate cả thuộc tính layout khi tab đổi trạng thái
  // (gây giật) — dùng bộ transition liệt kê tường minh dùng chung của module.
  ...RPT_CONTROL_MOTION_SX,
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
  const t = useT();
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
          {t("reports.recipientAgency.sliceBadge", {
            index: String(index + 1).padStart(2, "0"),
          })}
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
            ? t("reports.recipientAgency.agencyRoute", {
                agency: partyLabel(row.agency),
              })
            : t("reports.recipientAgency.directIssue")}
          <Box component="span" sx={{ mx: 0.75, color: S.border }}>
            •
          </Box>
          {t("reports.recipientAgency.departmentLine", {
            department: partyLabel(row.requesting_department),
          })}
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
          [
            t("reports.recipientAgency.colGross"),
            row.gross_issue_posted_qty,
            S.infoText,
          ],
          [
            t("reports.recipientAgency.colReversed"),
            row.reversed_issue_qty,
            S.warningText,
          ],
          [
            t("reports.recipientAgency.colNet"),
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
          {t("reports.recipientAgency.docsPosted", {
            count: quantity(row.posted_document_count),
          })}
        </Box>
        <ActionButton kind="detail" onClick={onOpen}>
          {t("reports.recipientAgency.reconcile")}
        </ActionButton>
      </Stack>
    </Box>
  );
}

function FilterField({
  label,
  children,
  desktopSpan = 3,
}: {
  label: string;
  children: ReactNode;
  desktopSpan?: number;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        position: "relative",
        // Ô rộng của mockup (khoảng ngày 6/12) chiếm 2 cột lưới; còn lại 1 cột.
        gridColumn: filterGridColumnSx(desktopSpan >= 4),
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
  const t = useT();
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
          title={t("reports.common.loadError", { title })}
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
          {t("reports.common.noData")}
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
 *
 * Chuỗi hiển thị đã chuyển về `messages.ts` (nhánh `reports.recipientAgency.*`)
 * theo yêu cầu i18n 100% (2026-09-03); bản VI giữ nguyên từng ký tự so với
 * bản port nên vẫn đối chiếu được với mockup khi nghiệm thu.
 */
export default function RecipientAgencyReport() {
  const t = useT();
  // Kỳ mặc định giữ nguyên "tháng này" như 7 báo cáo vận hành còn lại.
  const period = usePeriodFilter("this-month");
  /**
   * Kỳ nhanh nằm TRONG panel lịch, không còn ô "Kỳ báo cáo" riêng: trước đây
   * hai control cùng set một khoảng ngày nên chọn preset thì ô ngày bị ghi đè,
   * còn sửa ô ngày thì ô preset lặng lẽ nhảy về "Tùy chọn" — người đọc không
   * thấy được mối liên hệ đó. Mục "Tùy chọn" cũng bỏ luôn vì nó là TRẠNG THÁI
   * rơi vào khi tự đặt ngày, không phải một lựa chọn bấm được (bấm vào nó
   * không đổi khoảng ngày nào cả).
   */
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
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
    /**
   * Đổi tab KHÔNG khoá luồng chính: `shownViewMode` (tab đang sáng) cập nhật ở mức GẤP
   * nên người dùng thấy phản hồi ngay, còn `viewMode` — thứ quyết định panel nào
   * được dựng — cập nhật trong transition để React nhường luồng chính. Xem
   * @/shared/ui/use-tab-view.
   */
  const viewModeTab = useTabView<"table" | "snapshot">("table");
  const viewMode = viewModeTab.view;
  const shownViewMode = viewModeTab.shown;
  const setViewMode = viewModeTab.select;
  /**
   * Nút tab đọc `viewMode` (GẤP → tô sáng ngay); hai panel nặng bên dưới đọc bản
   * trễ để React vẽ chúng ở lượt ngắt được. Xem ghi chú cùng tên ở
   * StockReconcileReport.
   */
  const deferredViewMode = useDeferredValue(viewMode);
  /**
   * Tab cấp trang: lát cắt RPT-07 (mặc định) hay màn so sánh nhiều đối tượng.
   * Mặc định KHÔNG phải "so sánh" vì lát cắt mới là thứ người dùng vào trang
   * này để xem hằng ngày; so sánh là việc định kỳ của quản lý.
   */
  const [pageTab, setPageTab] = useState<"slice" | "comparison">("slice");

  const { refreshing, refresh } = useReportRefresh({
    refetch: () => Promise.all([summaryQuery.refetch(), optionQuery.refetch()]),
    readError: () => summaryQuery.error,
  });

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
  // Giữ MỘT tham chiếu mảng cho bảng trong modal: cột STT tra vị trí dòng
  // bằng indexOf nên mảng phải là cùng một đối tượng giữa các lần render ô.
  const drillRows = detailsQuery.data?.rows ?? EMPTY_DRILL_ROWS;

  const rangeAdvice = useReportRangeAdvice({
    from: period.from,
    to: period.to,
    dataDays: summaryQuery.dataDays,
    loading: summaryQuery.isLoading,
    probe: OUTBOUND_RECIPIENT_COVERAGE_PROBE,
  });

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

  /**
   * Bộ lọc RIÊNG của khối bảng. Bộ lọc đầu trang gọi lại lát cắt trên máy chủ
   * (đổi cả KPI, chart và snapshot_id); ở đây người đọc chỉ muốn khoanh vùng
   * đúng bảng đang soi trong CÙNG một lát cắt đã chốt, nên phép lọc dừng ở
   * client và không đụng tới lát cắt.
   */
  const tableFilterConfig = useMemo<
    SectionFilterConfig<RecipientAgencySummaryRow>
  >(
    () => ({
      searchPlaceholder: t("reports.recipientAgency.tableSearchPlaceholder"),
      searchText: (row) => [
        row.recipient.code,
        row.recipient.name,
        row.agency?.code,
        row.agency?.name,
        row.sku.code,
        row.sku.name,
        row.requesting_department?.name,
      ],
      selects: [
        {
          key: "recipientType",
          placeholder: t("reports.recipientAgency.anyRecipientType"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.recipient.type,
              (value) => recipientTypeLabel(value),
            ),
          match: (row, value) => row.recipient.type === value,
          minWidth: 200,
        },
        {
          key: "productType",
          placeholder: t("reports.recipientAgency.anyProductType"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.sku.product_type,
              (value) =>
                productTypeOptions(t).find((option) => option.value === value)
                  ?.label ?? value,
            ),
          match: (row, value) => row.sku.product_type === value,
          minWidth: 165,
        },
        {
          key: "reversal",
          placeholder: t("reports.recipientAgency.anyReversal"),
          options: [
            {
              value: "REVERSED",
              label: t("reports.recipientAgency.hasReversal"),
            },
            { value: "CLEAN", label: t("reports.recipientAgency.noReversal") },
          ],
          match: (row, value) =>
            value === "REVERSED"
              ? Number(row.reversed_issue_qty) > 0
              : Number(row.reversed_issue_qty) <= 0,
          minWidth: 205,
        },
      ],
    }),
    [t],
  );
  const tableFilter = useSectionFilter(rows, tableFilterConfig);

  /**
   * Cửa sổ vẽ cho lưới thẻ "lát cắt đối soát" — xem useRenderWindow. Bộ đếm và
   * mọi KPI của khối vẫn tính trên TOÀN BỘ `rows`; chỉ số thẻ vẽ ra DOM bị cắt.
   */
  const sliceWindow = useRenderWindow(rows);
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
      toast.success(t("reports.recipientAgency.exportOk", { format }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("reports.export.failed")));
    } finally {
      setExporting(null);
    }
  };

  const tableColumns = [
    {
      key: "stt",
      header: t("shared.table.rowNumber"),
      align: "center" as const,
      width: 56,
      // Bảng này sắp xếp CÓ KIỂM SOÁT (tableFilter.rows đã đúng thứ tự
      // hiển thị), nên STT chạy đúng theo dòng người dùng đang nhìn.
      render: (row: RecipientAgencySummaryRow) =>
        rowIndexOf(tableFilter.rows, row) + 1,
    },
    {
      key: "recipient",
      header: t("reports.recipientAgency.colRecipient"),
      width: "23%",
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
                ? t("reports.recipientAgency.agencyRoute", {
                    agency: partyLabel(row.agency),
                  })
                : t("reports.recipientAgency.noAgency")
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
              ? t("reports.recipientAgency.agencyRoute", {
                  agency: partyLabel(row.agency),
                })
              : t("reports.recipientAgency.noAgency")}
          </Box>
        </Box>
      ),
    },
    {
      key: "sku",
      header: t("reports.recipientAgency.colSkuDept"),
      width: "23%",
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
              row.sku.product_type === "COMPONENT"
                ? t("reports.recipientAgency.typeComponent")
                : t("reports.recipientAgency.typeProduct")
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
            {row.sku.product_type === "COMPONENT"
              ? t("reports.recipientAgency.typeComponent")
              : t("reports.recipientAgency.typeProduct")}
            {" · "}
            {partyLabel(row.requesting_department)}
          </Box>
        </Box>
      ),
    },
    {
      key: "gross",
      header: t("reports.recipientAgency.colGross"),
      width: "10%",
      align: "right" as const,
      sortable: true,
      sortType: "value" as const,
      render: (row: RecipientAgencySummaryRow) =>
        quantity(row.gross_issue_posted_qty),
    },
    {
      key: "reversed",
      header: t("reports.recipientAgency.colReversed"),
      width: "10%",
      align: "right" as const,
      sortable: true,
      sortType: "value" as const,
      render: (row: RecipientAgencySummaryRow) =>
        quantity(row.reversed_issue_qty),
    },
    {
      key: "net",
      header: t("reports.recipientAgency.colNet"),
      width: "10%",
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
      header: t("reports.recipientAgency.colDocs"),
      width: "9%",
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
              {t("reports.recipientAgency.kicker")}
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
              {t("reports.recipientAgency.title")}
            </Box>
            <Box
              sx={{
                mt: 0.5,
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                color: S.textMedium,
              }}
            >
              {t("reports.recipientAgency.description")}
            </Box>
          </Box>
        </Stack>
        {/*
          Trạng thái lát cắt + nút Làm mới CHỈ thuộc tab lát cắt. Tab so sánh có
          thanh công cụ riêng của nó; để cả hai cùng hiện thì trên màn có hai
          nút "Làm mới" cạnh nhau mà không nói được cái nào làm mới cái gì.
        */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            flexWrap: "wrap",
            rowGap: 1,
            display: pageTab === "slice" ? "flex" : "none",
          }}
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
                ? t("reports.recipientAgency.statusSyncing")
                : summary
                  ? t("reports.recipientAgency.statusLocked")
                  : t("reports.recipientAgency.statusWaiting")
            }
          />
          <UiButton
            appearance="outlined"
            startIcon={<ReloadOutlined />}
            loading={refreshing}
            onClick={refresh}
            disabled={period.invalid || summaryQuery.isFetching}
          >
            {t("reports.recipientAgency.refresh")}
          </UiButton>
        </Stack>
      </Box>

      {/*
        Tab CẤP TRANG. Tab "Lát cắt" là toàn bộ màn RPT-07 cũ, không đổi một
        dòng nào; tab "So sánh" là một màn riêng có bộ lọc, KPI và thứ bậc đọc
        của chính nó. Cố ý KHÔNG nhét mục so sánh vào dưới lát cắt: hai tab trả
        lời hai câu hỏi khác nhau ("kỳ này xuất cho ai, bao nhiêu" ↔ "giữa các
        đối tượng thì ai đang mạnh/yếu"), gộp lại thì cả hai đều dài và loãng.

        Dựng có điều kiện (không phải ẩn bằng CSS) là CỐ Ý: tab so sánh tải một
        cửa sổ rộng gấp đôi kỳ đang xem, không được phép chạy khi người dùng
        chưa mở tới nó.
      */}
      <Box
        role="tablist"
        aria-label={t("reports.recipientAgency.pageTablistAria")}
        sx={{
          // Cùng khuôn với dải tab của RPT-04 (`ImportMatchReport`) và với dải
          // "Dạng ngang / Dạng hộp" ở ngay dưới màn này: khung viền mỏng nền
          // chìm, hai pill cao 38px, pill đang chọn tô nền chính. Bản đầu dựng
          // hai THẺ to có icon + mô tả nên nó nặng hơn cả tiêu đề trang và
          // trông như một mục nội dung chứ không phải một bộ chuyển chế độ.
          width: { xs: "100%", md: "min(100%, 560px)" },
          p: 0.5,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 0.5,
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.card}px`,
          bgcolor: S.bgSubtle,
        }}
      >
        {(
          [
            {
              key: "slice" as const,
              icon: <FileTextOutlined aria-hidden="true" />,
              label: t("reports.recipientAgency.pageTabSlice"),
              hint: t("reports.recipientAgency.pageTabSliceHint"),
            },
            {
              key: "comparison" as const,
              icon: <SwapOutlined aria-hidden="true" />,
              label: t("reports.agencyComparison.tabLabel"),
              hint: t("reports.agencyComparison.tabHint"),
            },
          ] as const
        ).map((tab) => {
          const active = pageTab === tab.key;
          return (
            <Box
              key={tab.key}
              component="button"
              type="button"
              role="tab"
              id={`report-08-page-tab-${tab.key}`}
              data-report-page-tab={tab.key}
              aria-controls={`report-08-page-panel-${tab.key}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              // Câu mô tả không mất đi, chỉ rời khỏi dải tab: nó là thứ đọc một
              // lần rồi thôi, không đáng chiếm hai dòng cố định trên mọi lượt xem.
              title={tab.hint}
              onClick={() => setPageTab(tab.key)}
              sx={{ ...viewTabSx(active), flex: 1 }}
            >
              {tab.icon}
              {tab.label}
            </Box>
          );
        })}
      </Box>

      {pageTab === "comparison" ? (
        <Box
          id="report-08-page-panel-comparison"
          role="tabpanel"
          aria-labelledby="report-08-page-tab-comparison"
          sx={{ minWidth: 0 }}
        >
          <AgencyComparisonTab />
        </Box>
      ) : (
        <Box
          id="report-08-page-panel-slice"
          role="tabpanel"
          aria-labelledby="report-08-page-tab-slice"
          sx={{
            minWidth: 0,
            display: "grid",
            gap: { xs: 1.5, md: 2.25 },
            "& > *": { minWidth: 0 },
          }}
        >
          <Box
            component="section"
            aria-label={t("reports.recipientAgency.contextAria")}
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
                  {t("reports.recipientAgency.sliceViewing")}
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
                  {t("reports.recipientAgency.sliceFormula")}
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
                  {summary
                    ? t("reports.recipientAgency.sliceLocked")
                    : t("reports.recipientAgency.sliceCreating")}
                </Box>
                <Box
                  sx={{
                    fontSize: 12,
                    opacity: 0.82,
                    textAlign: { xs: "left", md: "right" },
                  }}
                >
                  {summary
                    ? t("reports.recipientAgency.lockedAt", {
                        time: formatDateTime(summary.as_of),
                      })
                    : t("reports.recipientAgency.timezoneBadge")}
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
                    {t("reports.recipientAgency.filterTitle")}
                  </Box>
                  <Box sx={{ mt: 0.2, fontSize: 12, color: S.textMedium }}>
                    {t("reports.recipientAgency.filterHint")}
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
                    label={t("reports.recipientAgency.selectedCount", {
                      count: activeFilterCount,
                    })}
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
                  {filtersExpanded
                    ? t("reports.recipientAgency.hideFilters")
                    : t("reports.recipientAgency.showFilters")}
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
                  {t("reports.recipientAgency.reset")}
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
                gridTemplateColumns: FILTER_GRID_COLUMNS_SX,
                columnGap: 1.5,
                rowGap: 1.75,
              }}
            >
              <FilterField
                label={t("reports.recipientAgency.dateRangeLabel")}
                desktopSpan={6}
              >
                <UiVuexyDateRangePicker
                  aria-label={t("reports.filters.dateRangeAria")}
                  value={period.range}
                  format="DD/MM/YYYY"
                  placeholder={[
                    t("reports.recipientAgency.dateFrom"),
                    t("reports.recipientAgency.dateTo"),
                  ]}
                  allowClear={false}
                  // Dữ liệu chỉ có trong quá khứ: khoá ngày tương lai (mốc dưới giữ mặc định 2000).
                  maxDate={dayjs().endOf("day")}
                  className="hn-vuexy-date-range"
                  popupClassName="hn-vuexy-date-popup"
                  presets={periodPresets}
                  onChange={(value) => {
                    if (value?.[0] && value?.[1])
                      period.setRange([value[0], value[1]]);
                  }}
                />
                <Box sx={{ mt: 0.5, color: S.textMedium, fontSize: 12 }}>
                  {t("reports.recipientAgency.periodViewing", {
                    label: period.label,
                  })}
                </Box>
              </FilterField>
              <FilterField
                label={t("reports.recipientAgency.reversalStateLabel")}
                desktopSpan={3}
              >
                <UiSelect
                  aria-label={t("reports.recipientAgency.reversalStateLabel")}
                  fullWidth
                  value={reversalState}
                  onChange={(value) => {
                    setReversalState(value as typeof reversalState);
                    setPage(1);
                  }}
                  options={reversalStateOptions(t)}
                />
              </FilterField>
              <FilterField
                label={t("reports.recipientAgency.recipientTypeLabel")}
              >
                <MultiSelectFilter
                  minWidth={0}
                  ariaLabel={t("reports.recipientAgency.recipientTypeAria")}
                  placeholder={t("reports.recipientAgency.recipientTypeAll")}
                  options={recipientTypeOptions(t)}
                  value={recipientTypes}
                  onChange={(value) => {
                    setRecipientTypes(value);
                    setPage(1);
                  }}
                />
              </FilterField>
              <FilterField label={t("reports.recipientAgency.recipientLabel")}>
                <MultiSelectFilter
                  minWidth={0}
                  ariaLabel={t("reports.recipientAgency.recipientAria")}
                  placeholder={t("reports.recipientAgency.recipientAll")}
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
              <FilterField label={t("reports.recipientAgency.typeAgency")}>
                <MultiSelectFilter
                  minWidth={0}
                  ariaLabel={t("reports.recipientAgency.agencyAria")}
                  placeholder={t("reports.recipientAgency.agencyAll")}
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
              <FilterField label={t("reports.recipientAgency.departmentLabel")}>
                <MultiSelectFilter
                  minWidth={0}
                  ariaLabel={t("reports.recipientAgency.departmentAria")}
                  placeholder={t("reports.recipientAgency.departmentAll")}
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
              <FilterField
                label={t("reports.recipientAgency.skuLabel")}
                desktopSpan={6}
              >
                <MultiSelectFilter
                  minWidth={0}
                  ariaLabel={t("reports.recipientAgency.skuAria")}
                  placeholder={t("reports.recipientAgency.skuAll")}
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
              <FilterField
                label={t("reports.recipientAgency.productTypeLabel")}
                desktopSpan={6}
              >
                <MultiSelectFilter
                  minWidth={0}
                  ariaLabel={t("reports.recipientAgency.productTypeAria")}
                  placeholder={t("reports.recipientAgency.productTypeAll")}
                  options={productTypeOptions(t)}
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
            <UiAlert tone="error">
              {t("reports.recipientAgency.dateOrderError")}
            </UiAlert>
          ) : null}
          {summaryQuery.error ? (
            <ApiErrorAlert
              error={summaryQuery.error}
              title={t("reports.recipientAgency.summaryErrorTitle")}
              onRetry={() => void summaryQuery.refetch()}
            />
          ) : null}

          <ReportRangeAdviceBanner
            advice={rangeAdvice}
            onApply={(next) => {
              period.setRange([dayjs(next.from), dayjs(next.to)]);
              setPage(1);
            }}
          />

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
                  {t("reports.recipientAgency.kpiTitle")}
                </Box>
                <Box sx={{ mt: 0.25, fontSize: 12, color: S.textMedium }}>
                  {t("reports.recipientAgency.kpiHint")}
                </Box>
              </Box>
              <UiStatusBadge
                tone="neutral"
                label={t("reports.recipientAgency.timezoneBadge")}
              />
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
                label={t("reports.recipientAgency.kpiGross")}
                value={quantity(metrics.gross_issue_posted_qty)}
                hint={t("reports.recipientAgency.kpiGrossHint")}
                tone="info"
                icon={<ShopOutlined />}
                metaLabel={t("reports.recipientAgency.kpiGrossMeta")}
                metaValue="100%"
                progress={100}
              />
              <MetricCard
                label={t("reports.recipientAgency.kpiReversed")}
                value={quantity(metrics.reversed_issue_qty)}
                hint={t("reports.recipientAgency.kpiReversedHint")}
                tone="warning"
                icon={<SwapOutlined />}
                metaLabel={t("reports.recipientAgency.kpiReversedMeta")}
                metaValue={`${reversedRate}%`}
                progress={reversedRate}
              />
              <MetricCard
                label={t("reports.recipientAgency.colNet")}
                value={quantity(metrics.net_issued_qty)}
                hint={t("reports.recipientAgency.kpiNetHint")}
                tone="success"
                icon={<SafetyCertificateOutlined />}
                metaLabel={t("reports.recipientAgency.kpiNetMeta")}
                metaValue={`${netRate}%`}
                progress={netRate}
              />
              <MetricCard
                label={t("reports.recipientAgency.kpiDocs")}
                value={quantity(metrics.posted_document_count)}
                hint={t("reports.recipientAgency.kpiDocsHint")}
                tone="neutral"
                icon={<TeamOutlined />}
                metaLabel={t("reports.recipientAgency.kpiDocsMeta")}
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
                  {t("reports.recipientAgency.analysisTitle")}
                </Box>
                <Box sx={{ mt: 0.25, color: S.textMedium, fontSize: 12 }}>
                  {t("reports.recipientAgency.analysisHint")}
                </Box>
              </Box>
              <UiStatusBadge
                tone="neutral"
                label={t("reports.recipientAgency.analysisBadge")}
              />
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <ChartPanel
                title={t("reports.recipientAgency.chartRecipientTitle")}
                description={t(
                  "reports.recipientAgency.chartRecipientDescription",
                )}
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
                title={t("reports.recipientAgency.chartSkuTitle")}
                description={t("reports.recipientAgency.chartSkuDescription")}
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
            aria-label={t("reports.recipientAgency.viewSectionAria")}
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
                {t("reports.recipientAgency.viewTitle")}
              </Box>
              <Box sx={{ mt: 0.2, color: S.textMedium, fontSize: 12 }}>
                {t("reports.recipientAgency.viewHint")}
              </Box>
            </Box>
            <Box
              role="tablist"
              aria-label={t("reports.recipientAgency.viewTablistAria")}
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
                aria-selected={shownViewMode === "table"}
                tabIndex={shownViewMode === "table" ? 0 : -1}
                onClick={() => setViewMode("table")}
                sx={viewTabSx(shownViewMode === "table")}
              >
                <UnorderedListOutlined aria-hidden="true" />
                {t("reports.recipientAgency.viewTable")}
              </Box>
              <Box
                component="button"
                type="button"
                role="tab"
                id="report-08-view-snapshot"
                data-report-view-switch="snapshot"
                aria-controls="report-08-panel-snapshot"
                aria-selected={shownViewMode === "snapshot"}
                tabIndex={shownViewMode === "snapshot" ? 0 : -1}
                onClick={() => {
                  setViewMode("snapshot");
                  setFiltersExpanded(false);
                }}
                sx={viewTabSx(shownViewMode === "snapshot")}
              >
                <AppstoreOutlined aria-hidden="true" />
                {t("reports.recipientAgency.viewSlice")}
              </Box>
            </Box>
          </Box>

          <Box
            id="report-08-panel-snapshot"
            data-report-view-panel="snapshot"
            role="tabpanel"
            aria-labelledby="report-08-view-snapshot"
            sx={{
              display: deferredViewMode === "snapshot" ? "block" : "none",
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
                      {t("reports.recipientAgency.sliceDataTitle")}
                    </Box>
                    <Box sx={{ mt: 0.35, color: S.textMedium, fontSize: 12 }}>
                      {t("reports.recipientAgency.sliceDataHint")}
                    </Box>
                  </Box>
                </Stack>
                <UiStatusBadge
                  tone="neutral"
                  label={t("reports.recipientAgency.sliceCount", {
                    count: rows.length,
                  })}
                />
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
                      <Box>{t("reports.recipientAgency.sliceLoading")}</Box>
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
                    {sliceWindow.visible.map((row, index) => (
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
                    <WindowedMore window={sliceWindow} />
                  </Box>
                ) : (
                  <Box sx={{ py: 6, textAlign: "center", color: S.textMedium }}>
                    {t("reports.recipientAgency.sliceEmpty")}
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
            sx={{
              display: deferredViewMode === "table" ? "block" : "none",
              minWidth: 0,
            }}
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
                        {t("reports.recipientAgency.tableTitle")}
                      </Box>
                    </Stack>
                    <Box sx={{ mt: 0.75, fontSize: 12, color: S.textMedium }}>
                      {summary
                        ? t("reports.recipientAgency.tableSnapshotLine", {
                            id: summary.snapshot_id,
                            time: formatDateTime(summary.as_of),
                          })
                        : t("reports.recipientAgency.tableWaiting")}
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
                      {t("reports.filters.exportXlsx")}
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
                      disabledTooltip={t(
                        "reports.recipientAgency.exportPiiTooltip",
                      )}
                      onClick={() => void startExport("CSV", true)}
                    >
                      {t("reports.recipientAgency.exportCsvPii")}
                    </ActionButton>
                  </Stack>
                </Box>
                <Box sx={{ px: { xs: 1.25, md: 2.5 }, pt: { xs: 1.5, md: 2 } }}>
                  <SectionFilterBar
                    state={tableFilter}
                    label={t("reports.recipientAgency.tableTitle")}
                    data-testid="report-08-table-section-filter"
                  />
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
                    /*
                     * Bề rộng cột nay khai trong `tableColumns` và được
                     * ResponsiveDataTable phát ra thành <colgroup>, nên KHÔNG còn
                     * khối nth-of-type + !important ở đây. Cách cũ chỉ vá được đúng
                     * màn này, còn nguyên nhân — bề rộng chỉ gắn vào <th>, ô <td>
                     * không nhận gì — vẫn nằm ở component dùng chung.
                     */
                    "& th:nth-of-type(n + 3), & td:nth-of-type(n + 3)": {
                      whiteSpace: "nowrap",
                    },
                    /*
                     * Tiêu đề bảng bị GHIM (ResponsiveDataTable + maxBodyHeight)
                     * nên nền của nó BẮT BUỘC phải đục: `primarySoft` là rgba ~16%
                     * — dòng cuộn qua bên dưới ánh xuyên lên, chữ tiêu đề và chữ
                     * của dòng chồng lên nhau. Trải đúng sắc tím đó thành một lớp
                     * `background-image` phủ trên nền ĐỤC của thẻ (cùng cách
                     * ResponsiveDataTable đã xử lý cho nền mặc định): màu nhìn y
                     * hệt trước nhưng không còn nhìn xuyên. Phải khai cả
                     * `backgroundImage` vì lớp mặc định của component vẫn nằm đó.
                     */
                    "& thead th": {
                      backgroundColor: `${S.bgSurface} !important`,
                      backgroundImage: `linear-gradient(${S.primarySoft}, ${S.primarySoft}) !important`,
                      color: `${S.primaryDark} !important`,
                      fontWeight: "700 !important",
                      whiteSpace: "normal !important",
                      lineHeight: "1.3 !important",
                    },
                    "& tbody tr:nth-of-type(even)": { bgcolor: S.bgSubtle },
                    "& tbody tr:hover": {
                      bgcolor: `${S.primarySoft} !important`,
                    },
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
                      {t("reports.recipientAgency.tableRowHint")}
                    </Box>
                    {summary ? (
                      <UiStatusBadge
                        tone="neutral"
                        label={t("reports.recipientAgency.groupCount", {
                          count: summary.page.total,
                        })}
                      />
                    ) : null}
                  </Stack>
                  <ResponsiveDataTable
                    columns={tableColumns}
                    rows={tableFilter.rows}
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
                    emptyText={t("reports.recipientAgency.tableEmpty")}
                    mobileBreakpoint="sm"
                    // Bảng đổ trọn tập nhóm dữ liệu đã lọc: cuộn trong khung và
                    // ghim tiêu đề cột thay vì kéo trang thành một dải rất dài.
                    maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
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
                          {t("reports.recipientAgency.reconcile")}
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
                      {t("reports.recipientAgency.lockedFormulaLabel")}
                    </Box>{" "}
                    {t("reports.recipientAgency.lockedFormulaBody")}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {activeDrill ? (
        <DrillDownDialog
          title={t("reports.recipientAgency.drillTitle", {
            title: activeDrill.title,
          })}
          subtitle={
            activeDrill.snapshotId
              ? t("reports.recipientAgency.drillSubtitle", {
                  id: activeDrill.snapshotId,
                })
              : undefined
          }
          onClose={() => setActiveDrill(null)}
          maxWidth="xl"
        >
          {detailsQuery.error ? (
            <ApiErrorAlert
              error={detailsQuery.error}
              title={t("reports.recipientAgency.drillErrorTitle")}
              onRetry={() => void detailsQuery.refetch()}
            />
          ) : null}
          <ResponsiveDataTable
            columns={[
              {
                key: "stt",
                header: t("shared.table.rowNumber"),
                align: "center",
                width: 56,
                render: (row) => rowIndexOf(drillRows, row) + 1,
              },
              {
                key: "outbound",
                header: t("reports.recipientAgency.colDocs"),
                render: (row) => (
                  <Box>
                    <Box sx={{ fontWeight: 700 }}>{row.outbound_no}</Box>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      {t("reports.recipientAgency.sourceRequestLine", {
                        no: orEmpty(row.source_request_no),
                      })}
                    </Box>
                  </Box>
                ),
              },
              {
                key: "event",
                header: t("reports.recipientAgency.colEventMoment"),
                render: (row) =>
                  `${eventTypeLabel(row.event_type)} · ${formatDateTime(row.occurred_at)}`,
              },
              {
                key: "gross",
                header: t("reports.recipientAgency.kpiGross"),
                align: "right",
                render: (row) => quantity(row.gross_issue_posted_qty),
              },
              {
                key: "reversed",
                header: t("reports.recipientAgency.kpiReversed"),
                align: "right",
                render: (row) => quantity(row.reversed_issue_qty),
              },
              {
                key: "net",
                header: t("reports.recipientAgency.colNet"),
                align: "right",
                render: (row) => quantity(row.net_issued_qty),
              },
              {
                key: "reversal",
                header: t("reports.recipientAgency.colReversalOf"),
                hideOnMobile: true,
                render: (row) => orEmpty(row.reversal_of_event_id),
              },
            ]}
            rows={drillRows}
            rowKey={(row) => row.event_id}
            loading={detailsQuery.isLoading}
            emptyText={t("reports.recipientAgency.drillEmpty")}
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
