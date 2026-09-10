/**
 * RPT-06 · Báo cáo Bảo hành & linh kiện — port 1:1 baseline UI/UX
 * `8.7.WMS_Hoa_Nam_Bao_Cao_Bao_Hanh_Linh_Kien.html`.
 *
 * Bố cục, số đo, thứ tự khối và nhãn bám đúng `report-07-baseline.css` +
 * `offline-preview.js` của bản bàn giao; phần dữ liệu KHÔNG dùng mock của bản
 * HTML mà đọc từ đúng các endpoint báo cáo bảo hành đang phục vụ:
 *
 *   · `/reports/warranty-defects` — hồ sơ + bệnh/lỗi N:N + PII đã che
 *   · `/warranty-cases`           — `created_by` (người phụ trách) + mốc đóng hồ sơ
 *   · `/warranty-component-issues`— chứng từ xuất linh kiện của từng hồ sơ
 *   · `/warranty-cases/{id}/events` — lịch sử phân công (chỉ khi đủ quyền)
 *
 * Mọi ô lọc đều tác động thật lên lát cắt đang xem (KPI, ba biểu đồ, bảng, thẻ
 * lát cắt) — không có điều khiển trang trí.
 */
import { useRenderWindow } from "@/shared/components/data-display/useRenderWindow";
import { useTabView } from "@/shared/ui/use-tab-view";
import { WindowedMore } from "@/shared/components/data-display/WindowedMore";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import {
  Box,
  Menu,
  Stack,
  UiAlert,
  UiButton,
  UiOptionPicker,
  UiSelect,
  UiSpinner,
  UiTextField,
  UiVuexyDateRangePicker,
  MOTION,
  RADIUS,
  SEMANTIC_LIGHT as S,
  FILTER_GRID_COLUMNS_SX,
  filterGridColumnSx,
} from "@/shared/ui";
import {
  AppstoreOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  DownOutlined,
  FileTextOutlined,
  FilterOutlined,
  HistoryOutlined,
  InboxOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SyncOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { ActionButton } from "@/shared/components/actions";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useHasPermission } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { EMPTY_TEXT, orEmpty } from "@/shared/constants/display";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { useAuthStore } from "@/shared/store/auth.store";
import { useT } from "@/shared/i18n/useT";
import { warrantyPiiText } from "@/modules/warranty/constants";
import {
  fmt,
  fmtDate,
  fmtDateTime,
  listOf,
  n,
  objectOf,
  text,
  type Raw,
} from "@/modules/reports/operations/report-format";
import {
  useComponentIssueDocuments,
  useSkuCatalog,
  useUserDirectory,
  useWarrantyCases,
  useWarrantyReport,
} from "@/modules/reports/operations/report-data";
import { usePeriodFilter } from "@/modules/reports/operations/report-period";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import {
  RPT_CONTROL_MOTION_SX,
  RPT_SCROLL_MAX_HEIGHT,
} from "@/modules/reports/operations/report-tokens";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { useReportRangeAdvice } from "@/modules/reports/operations/report-coverage";
import { WARRANTY_COVERAGE_PROBE } from "@/modules/reports/operations/report-probes";
import { ReportRangeAdviceBanner } from "@/modules/reports/operations/ReportRangeAdviceBanner";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { ExportButtons } from "@/modules/reports/operations/report-filters";
import {
  EXPORT_ROW_LIMIT,
  PII_REASON_MIN_LENGTH,
  useReportExport,
} from "@/modules/reports/operations/report-export";
import { useWarrantyCaseEvents } from "./warranty-case-events";
import {
  averageCompletionDays,
  dateOfDimension,
  DATE_DIMENSIONS,
  DUE_RISK_LABEL,
  type DueRisk,
  DUE_RISK_ORDER,
  dueRiskOf,
  matches,
  parseComponentsIssued,
  toneOf,
  WARRANTY_STATUS_LABEL,
  WARRANTY_STATUS_ORDER,
  type BadgeTone,
  type DateDimension,
  type WarrantyCaseRow,
  type WarrantyStatus,
} from "./warranty-components-model";

const TIMEZONE_LABEL = "Asia/Ho_Chi_Minh";

/** Màu lát donut theo đúng thứ tự trạng thái của baseline 8.7. */
const STATUS_COLOR: Record<WarrantyStatus, string> = {
  RECEIVED: S.info,
  CHECKING: S.primary,
  REPAIRING: S.warning,
  COMPLETED: S.success,
  RETURNED: S.success,
  CANCELLED: S.secondary,
};

const BADGE_STYLE: Record<BadgeTone, { color: string; bg: string }> = {
  info: { color: S.infoText, bg: S.infoSoft },
  success: { color: S.successText, bg: S.successSoft },
  warn: { color: S.warningText, bg: S.warningSoft },
  error: { color: S.errorText, bg: S.errorSoft },
};

const CARD_SX = {
  minWidth: 0,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  bgcolor: S.bgSurface,
  boxShadow: S.shadowCard,
  // Bỏ qua layout/paint khi thẻ nằm ngoài màn hình (xem ghi chú cùng tên trong
  // stock-reconcile-report.css). Trình duyệt giữ chỗ 480px rồi tự nhớ cỡ thật.
  contentVisibility: "auto",
  containIntrinsicSize: "auto 480px",
} as const;

/** `.report-select` / `.report-input` của baseline: cao 40px, viền 1px, bo 6px. */
const CONTROL_SX = {
  width: "100%",
  minWidth: 0,
  minHeight: 40,
  px: "11px",
  py: "7px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  border: `1px solid ${S.borderInput}`,
  borderRadius: `${RADIUS.control}px`,
  color: S.textHigh,
  bgcolor: S.bgSurface,
  font: "inherit",
  fontSize: 13,
  textAlign: "left",
  cursor: "pointer",
  // Control tự dựng không đi qua theme MUI nên phải khai chuyển động ở đây,
  // nếu không nó đổi viền/nền "nhảy" một phát cạnh các control chuẩn.
  transition: RPT_CONTROL_MOTION_SX.transition,
  "&:hover, &:focus-visible": {
    borderColor: S.primary,
    outline: 0,
    boxShadow: `0 0 0 3px ${S.primarySoft}`,
  },
} as const;

function ReportBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const style = BADGE_STYLE[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        px: 1,
        py: "3px",
        borderRadius: `${RADIUS.control}px`,
        color: style.color,
        bgcolor: style.bg,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

/** Chip ngữ cảnh ở đầu trang (`.chip` của baseline Report 01). */
function ScopeChip({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "neutral" | "success";
}) {
  const palette = {
    primary: { color: S.primaryDark, bg: S.primarySoft },
    neutral: { color: S.textMedium, bg: S.secondarySoft },
    success: { color: S.successText, bg: S.successSoft },
  }[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 26,
        px: 1.25,
        borderRadius: `${RADIUS.control}px`,
        color: palette.color,
        bgcolor: palette.bg,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

/** Nhãn + điều khiển của một ô lọc, giữ đúng số cột của lưới 12 cột. */
function FilterField({
  label,
  htmlFor,
  span,
  children,
}: {
  label: string;
  htmlFor?: string;
  span: { md: number; xl: number };
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        // Ô rộng của mockup (khoảng ngày, 4/12) chiếm 2 cột lưới; còn lại 1 cột.
        gridColumn: filterGridColumnSx(span.xl >= 4),
        "& .MuiFormControl-root, & .MuiTextField-root": {
          width: "100%",
          minWidth: 0,
          maxWidth: "none",
        },
      }}
    >
      <Box
        component={htmlFor ? "label" : "span"}
        htmlFor={htmlFor}
        sx={{
          display: "block",
          mb: "6px",
          color: S.textMedium,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: "18px",
        }}
      >
        {label}
      </Box>
      {children}
    </Box>
  );
}

/** Thẻ KPI `.metric` — viền trên theo tông, nền gradient 145deg. */
function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: "primary" | "info" | "success" | "warning" | "error";
}) {
  const palette = {
    primary: { accent: S.primary, soft: S.primarySoft, text: S.primaryDark },
    info: { accent: S.info, soft: S.infoSoft, text: S.infoText },
    success: { accent: S.success, soft: S.successSoft, text: S.successText },
    warning: { accent: S.warning, soft: S.warningSoft, text: S.warningText },
    error: { accent: S.error, soft: S.errorSoft, text: S.errorText },
  }[tone];
  return (
    <Box
      component="article"
      sx={{
        position: "relative",
        minWidth: 0,
        minHeight: 144,
        p: 2,
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${S.border}`,
        borderTop: `2px solid ${palette.accent}`,
        borderRadius: `${RADIUS.control}px`,
        backgroundImage: `linear-gradient(145deg, ${S.bgSurface} 34%, ${palette.soft})`,
        bgcolor: S.bgSurface,
        boxShadow: S.shadowCard,
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
        <Box
          sx={{
            color: S.textHigh,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.025em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: 34,
            height: 34,
            flex: "0 0 34px",
            display: "grid",
            placeItems: "center",
            borderRadius: `${RADIUS.control}px`,
            color: palette.text,
            bgcolor: palette.soft,
            fontSize: 16,
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Box
        sx={{
          mt: 2.25,
          color: S.textHigh,
          fontSize: 29,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {value}
      </Box>
      <Box sx={{ mt: "auto", pt: 1, color: S.textMedium, fontSize: 11.5 }}>
        {hint}
      </Box>
    </Box>
  );
}

/** Khung thẻ biểu đồ `.report-07-chart-card`. */
function ChartCard({
  title,
  description,
  marker,
  children,
}: {
  title: string;
  description: string;
  marker: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      component="article"
      sx={{ ...CARD_SX, minHeight: 312, p: 2.25, overflow: "hidden" }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            component="h3"
            sx={{ m: 0, color: S.textHigh, fontSize: 16, fontWeight: 700 }}
          >
            {title}
          </Box>
          <Box
            sx={{
              mt: "5px",
              color: S.textMedium,
              fontSize: 12,
              lineHeight: 1.45,
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
            flex: "0 0 34px",
            display: "grid",
            placeItems: "center",
            borderRadius: `${RADIUS.control}px`,
            color: S.primaryDark,
            bgcolor: S.primarySoft,
            fontSize: 16,
          }}
        >
          {marker}
        </Box>
      </Stack>
      <Box sx={{ minHeight: 220, mt: 2 }}>{children}</Box>
    </Box>
  );
}

/** Danh sách thanh ngang `.bars` — nhãn trên, thanh dưới, trị số bên phải. */
function BarList({
  items,
  tone,
  emptyText,
  onSelect,
}: {
  items: Array<{ label: string; value: number }>;
  tone: "warning" | "info";
  emptyText: string;
  onSelect?: (label: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Box
        sx={{
          minHeight: 220,
          display: "grid",
          placeItems: "center",
          px: 2,
          color: S.textMedium,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {emptyText}
      </Box>
    );
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  const track = tone === "info" ? S.infoSoft : S.warningSoft;
  const fill = tone === "info" ? S.info : S.warning;
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {items.map((item, index) => (
        <Box
          key={item.label}
          component={onSelect ? "button" : "div"}
          type={onSelect ? "button" : undefined}
          onClick={onSelect ? () => onSelect(item.label) : undefined}
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 34px",
            gap: 1,
            alignItems: "center",
            width: "100%",
            p: 0,
            border: 0,
            bgcolor: "transparent",
            font: "inherit",
            textAlign: "left",
            cursor: onSelect ? "pointer" : "default",
            "&:hover > div:first-of-type > div": onSelect
              ? { opacity: 0.85 }
              : undefined,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box
              title={item.label}
              sx={{
                display: "block",
                mb: "5px",
                overflow: "hidden",
                color: S.textHigh,
                fontSize: 11.5,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              <Box component="span" aria-hidden="true">
                {index + 1}.{" "}
              </Box>
              {item.label}
            </Box>
            <Box
              sx={{
                height: 8,
                overflow: "hidden",
                borderRadius: 999,
                bgcolor: track,
              }}
            >
              <Box
                sx={{
                  width: `${(item.value / max) * 100}%`,
                  height: "100%",
                  borderRadius: "inherit",
                  bgcolor: fill,
                }}
              />
            </Box>
          </Box>
          <Box
            component="strong"
            sx={{ color: S.textHigh, fontSize: 12, textAlign: "right" }}
          >
            {fmt(item.value)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Ô chọn nhiều giá trị mang dáng `.report-select` (OR trong cùng bộ lọc).
 *
 * Chỉ còn cái NÚT là của riêng màn này; danh sách bên trong dùng chung
 * `UiOptionPicker` (cao 5 dòng, dài quá ngưỡng thì có ô tìm).
 */
function MultiSelectControl({
  ariaLabel,
  summary,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  summary: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <Box
        component="button"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={Boolean(anchorEl)}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          ...CONTROL_SX,
          color: value.length === 0 ? S.textMedium : S.textHigh,
        }}
      >
        <Box
          component="span"
          sx={{
            minWidth: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {summary}
        </Box>
        <DownOutlined aria-hidden="true" style={{ fontSize: 12 }} />
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <UiOptionPicker
          options={options}
          value={value}
          onChange={onChange}
          aria-label={ariaLabel}
          width={280}
        />
      </Menu>
    </>
  );
}

/** Hai nút chọn nhanh "Có linh kiện / Chưa có" (`.component-choice`). */
function ComponentChoice({
  active,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      onClick={onClick}
      sx={{
        ...CONTROL_SX,
        px: "7px",
        py: "5px",
        justifyContent: "flex-start",
        gap: 0.75,
        overflow: "hidden",
        borderColor: active ? S.primary : S.borderInput,
        color: active ? S.primaryDark : S.textHigh,
        bgcolor: active ? S.primarySoft : S.bgSurface,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 24,
          height: 24,
          flex: "0 0 24px",
          display: "grid",
          placeItems: "center",
          borderRadius: "5px",
          color: S.primaryDark,
          bgcolor: S.primarySoft,
          fontSize: 12,
        }}
      >
        {icon}
      </Box>
      <Box
        component="span"
        sx={{
          minWidth: 0,
          overflow: "hidden",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.15,
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {title}
        <Box
          component="small"
          sx={{
            display: "block",
            mt: "2px",
            color: S.textMedium,
            fontSize: 9.5,
            fontWeight: 500,
          }}
        >
          {hint}
        </Box>
      </Box>
    </Box>
  );
}

/** Tiêu đề mỗi mục nội dung (`.section-heading`). */
function SectionHeading({
  eyebrow,
  title,
  id,
  meta,
}: {
  eyebrow: string;
  title: string;
  id: string;
  meta: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      sx={{
        mb: 1.5,
        alignItems: { xs: "flex-start", sm: "flex-end" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", sm: "row" },
        gap: 1.25,
      }}
    >
      <Box>
        <Box
          sx={{
            color: S.primaryDark,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {eyebrow}
        </Box>
        <Box
          component="h2"
          id={id}
          sx={{
            m: "4px 0 0",
            color: S.textHigh,
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          {title}
        </Box>
      </Box>
      <Box sx={{ color: S.textMedium, fontSize: 12 }}>{meta}</Box>
    </Stack>
  );
}

const TH_SX = {
  p: "11px 12px",
  borderBottom: `1px solid ${S.border}`,
  verticalAlign: "top",
  textAlign: "left",
  color: S.textMedium,
  bgcolor: S.bgSubtle,
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
} as const;

/** Ô STT — hẹp, canh giữa, số cùng bề rộng để cột đọc thẳng hàng. */
const STT_SX = {
  width: 56,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
} as const;

const TD_SX = {
  p: "11px 12px",
  borderBottom: `1px solid ${S.border}`,
  verticalAlign: "top",
  textAlign: "left",
  color: S.textHigh,
} as const;

const CELL_SUB_SX = {
  maxWidth: 190,
  mt: "4px",
  overflow: "hidden",
  color: S.textMedium,
  fontSize: 11.5,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
} as const;

const VIEW_TAB_SX = (active: boolean) =>
  ({
    minWidth: 88,
    height: 34,
    px: 1.5,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0.75,
    border: active ? 0 : `1px solid ${S.borderInput}`,
    borderRadius: `${RADIUS.control}px`,
    color: active ? S.onPrimary : S.textMedium,
    bgcolor: active ? S.primary : "transparent",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    ...RPT_CONTROL_MOTION_SX,
    "&:hover": {
      bgcolor: active ? S.primaryDark : S.primarySoft,
      color: active ? S.onPrimary : S.primaryDark,
    },
    "&:focus-visible": { outline: `2px solid ${S.primary}`, outlineOffset: 2 },
  }) as const;

export default function WarrantyComponentsReport() {
  const t = useT();
  const period = usePeriodFilter("this-month");
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const catalog = useSkuCatalog();
  const users = useUserDirectory();
  const exporter = useReportExport();
  const hasPermission = useHasPermission();
  const authUser = useAuthStore((state) => state.user);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const { refreshing, refresh } = useReportRefresh({
    refetch: () =>
      Promise.all([
        warranty.refetch(),
        rawCases.refetch(),
        issueDocs.refetch(),
      ]),
    readError: () => warranty.error,
  });

  const today = useMemo(() => dayjs(), []);

  const canViewPii = hasPermission(WMS_PERMISSION_CATALOG.WARRANTY_PII_VIEW);
  const canExportPii = hasPermission(
    WMS_PERMISSION_CATALOG.WARRANTY_PII_EXPORT,
  );
  const canReadWarrantyCase =
    hasPermission(WMS_PERMISSION_CATALOG.WARRANTY_VIEW) ||
    hasPermission(WMS_PERMISSION_CATALOG.WARRANTY_MANAGE);

  // ── Bộ lọc ────────────────────────────────────────────────────────────
  const [dateDimension, setDateDimension] = useState<DateDimension>("RECEIVED");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [riskFilter, setRiskFilter] = useState<string[]>([]);
  const [componentIssue, setComponentIssue] = useState<boolean | undefined>();
  const [defectTerm, setDefectTerm] = useState("");
  const [skuTerm, setSkuTerm] = useState("");
  const [ownerTerm, setOwnerTerm] = useState("");
  const [departmentTerm, setDepartmentTerm] = useState("");
  const [filtersHidden, setFiltersHidden] = useState(false);
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
   * Tab đổi view: nút bấm đọc `viewMode` (cập nhật GẤP → tô sáng tức thì), còn các
   * PANEL nặng đọc `deferredViewMode` (bản trễ, React vẽ ở lượt ngắt được). Đo trước khi
   * sửa (Playwright, CPU x4): một cú bấm "Dạng hộp" khoá luồng chính tới ~930 ms
   * vì panel mới (bảng hàng trăm dòng / lưới thẻ) phải layout + paint trọn một
   * lượt cùng lúc với việc tô sáng tab. Tách hai lượt thì tab phản hồi ngay,
   * panel theo sau.
   */
  const deferredViewMode = useDeferredValue(viewMode);

  const [openCase, setOpenCase] = useState<WarrantyCaseRow | null>(null);
  const [piiReason, setPiiReason] = useState("");

  const warranty = useWarrantyReport({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });
  const rawCases = useWarrantyCases({ enabled: !period.invalid });
  const issueDocs = useComponentIssueDocuments({ enabled: !period.invalid });
  const caseEvents = useWarrantyCaseEvents(
    openCase?.caseId ?? null,
    canReadWarrantyCase,
  );

  /** case_id → phiếu xuất linh kiện gần nhất. */
  const issueDocByCase = useMemo(() => {
    const map = new Map<string, Raw>();
    for (const doc of issueDocs.data ?? []) {
      const caseId = text(doc.warranty_case_id, "");
      if (!caseId) continue;
      const current = map.get(caseId);
      const at = text(doc.posted_at ?? doc.document_date, "");
      if (
        !current ||
        at > text(current.posted_at ?? current.document_date, "")
      ) {
        map.set(caseId, doc);
      }
    }
    return map;
  }, [issueDocs.data]);

  /** case_code → bản ghi hồ sơ thô (người tạo + mốc đóng hồ sơ). */
  const rawCaseByCode = useMemo(() => {
    const map = new Map<string, Raw>();
    for (const row of rawCases.data ?? []) {
      map.set(text(row.warranty_case_code ?? row.case_code, ""), row);
    }
    return map;
  }, [rawCases.data]);

  const cases = useMemo<WarrantyCaseRow[]>(() => {
    return listOf(warranty.data?.rows).map((row) => {
      const caseNo = text(row.case_no, "");
      const raw = rawCaseByCode.get(caseNo) ?? {};
      const ownerId = text(raw.created_by, "");
      const owner =
        users.entries.find((entry) => entry.user_id === ownerId)?.name ?? "";
      const status = text(row.status, "");
      const dueDate = text(
        row.estimated_completion_date ?? raw.estimated_completion_date,
        "",
      );
      const componentsText = text(row.components_issued, "");
      const parsed = parseComponentsIssued(componentsText);
      const defects = listOf(row.defects);
      return {
        caseId: text(row.warranty_case_id, ""),
        caseNo,
        model: text(row.model, ""),
        skuId: text(row.sku_id, ""),
        skuName: text(row.sku_name, ""),
        status,
        statusLabel:
          WARRANTY_STATUS_LABEL[status as WarrantyStatus] ?? orEmpty(status),
        receivedAt: text(row.received_at, ""),
        completedAt: text(
          row.completed_at ?? raw.completed_at ?? raw.closed_at,
          "",
        ),
        returnedAt: text(row.returned_at ?? raw.returned_at, ""),
        dueDate,
        due: dueRiskOf(status, dueDate, today),
        defectNames: defects.map((item) => text(item.defect_name, "")),
        defectCodes: defects.map((item) => text(item.defect_code, "")),
        components: parsed.entries,
        componentCount: parsed.count,
        owner,
        ownerId,
        department: users.departmentNameOfActor(owner),
        departmentId: users.departmentOfName(owner) ?? "",
        customerName: warrantyPiiText(
          text(row.customer_name, ""),
          canViewPii,
          "name",
        ),
        customerPhone: warrantyPiiText(
          text(row.customer_phone, ""),
          canViewPii,
          "phone",
        ),
        customerAddress: warrantyPiiText(
          text(row.customer_address, ""),
          canViewPii,
          "address",
        ),
        raw: row,
      };
    });
  }, [warranty.data, rawCaseByCode, users, today, canViewPii]);

  /**
   * Lát cắt sau MỌI bộ lọc trừ trạng thái — donut phải luôn liệt đủ sáu trạng
   * thái để còn bấm chọn được, nếu lọc luôn thì chọn xong sẽ chỉ còn một lát.
   */
  const facetRows = useMemo(() => {
    return cases.filter((row) => {
      // Mốc thời gian: thu hẹp lát cắt theo đúng cột ngày người dùng chọn.
      // Cửa sổ tải về vẫn do máy chủ cắt theo ngày tiếp nhận (hợp đồng của
      // `/reports/warranty-defects`), nên đây là lọc BÊN TRONG cửa sổ đó.
      if (dateDimension !== "RECEIVED") {
        const value = dateOfDimension(row, dateDimension);
        if (!value) return false;
        const day = dayjs(value);
        if (!day.isValid()) return false;
        if (day.isBefore(dayjs(period.from), "day")) return false;
        if (day.isAfter(dayjs(period.to), "day")) return false;
      }
      if (riskFilter.length > 0 && !riskFilter.includes(row.due)) return false;
      if (componentIssue !== undefined) {
        const hasComponents = row.componentCount > 0;
        if (componentIssue !== hasComponents) return false;
      }
      if (
        !matches([...row.defectNames, ...row.defectCodes].join(" "), defectTerm)
      ) {
        return false;
      }
      if (!matches(`${row.model} ${row.skuName}`, skuTerm)) return false;
      if (!matches(`${row.owner} ${row.ownerId}`, ownerTerm)) return false;
      if (!matches(`${row.department} ${row.departmentId}`, departmentTerm)) {
        return false;
      }
      return true;
    });
  }, [
    cases,
    dateDimension,
    period.from,
    period.to,
    riskFilter,
    componentIssue,
    defectTerm,
    skuTerm,
    ownerTerm,
    departmentTerm,
  ]);

  const viewRows = useMemo(
    () =>
      statusFilter.length === 0
        ? facetRows
        : facetRows.filter((row) => statusFilter.includes(row.status)),
    [facetRows, statusFilter],
  );

  /**
   * Bộ lọc RIÊNG của khối hồ sơ. Đặt SAU viewRows để KPI, biểu đồ lỗi và bảng
   * linh kiện phía trên vẫn nói về nguyên lát cắt: người đọc thu hẹp bảng để
   * tìm một hồ sơ, không phải để đổi số liệu của cả kỳ.
   *
   * Áp cho CẢ Dạng ngang lẫn Dạng hộp — hai chế độ chỉ là hai cách vẽ của
   * cùng một tập hồ sơ.
   */
  const caseFilterConfig = useMemo<SectionFilterConfig<WarrantyCaseRow>>(
    () => ({
      searchPlaceholder: t("reports.warrantyReport.searchPlaceholder"),
      searchText: (row) => [
        row.caseNo,
        row.model,
        row.skuName,
        row.owner,
        row.department,
        row.defectNames.join(" "),
      ],
      selects: [
        {
          key: "status",
          placeholder: t("reports.warrantyReport.anyStatus"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.status,
              (value) =>
                list.find((row) => row.status === value)?.statusLabel ?? value,
            ),
          match: (row, value) => row.status === value,
          minWidth: 195,
        },
        {
          key: "due",
          placeholder: t("reports.warrantyReport.anyRisk"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.due,
              (value) => DUE_RISK_LABEL[value as DueRisk] ?? value,
            ),
          match: (row, value) => row.due === value,
          minWidth: 195,
        },
        {
          key: "department",
          placeholder: t("reports.warrantyReport.anyDepartment"),
          options: (list) => optionsFromRows(list, (row) => row.department),
          match: (row, value) => row.department === value,
          minWidth: 175,
        },
      ],
    }),
    [],
  );
  const caseFilter = useSectionFilter(viewRows, caseFilterConfig);

  /**
   * Cửa sổ vẽ cho lưới thẻ dài — xem useRenderWindow. Con số ở KPI/biểu đồ và
   * bộ đếm của khối vẫn tính trên TOÀN BỘ tập đã lọc; chỉ số thẻ được vẽ ra DOM
   * là bị cắt, và người đọc luôn thấy "đang hiển thị N/M".
   */
  const caseWindow = useRenderWindow(caseFilter.rows);

  // ── Số liệu KPI ───────────────────────────────────────────────────────
  const openCount = viewRows.filter((row) =>
    ["RECEIVED", "CHECKING", "REPAIRING"].includes(row.status),
  ).length;
  const completedCount = viewRows.filter(
    (row) => row.status === "COMPLETED",
  ).length;
  const overdueCount = viewRows.filter((row) => row.due === "OVERDUE").length;
  const dueSoonCount = viewRows.filter((row) => row.due === "DUE_SOON").length;
  const averageDays = averageCompletionDays(viewRows);

  // ── Ba biểu đồ ────────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counter = new Map<string, number>(
      WARRANTY_STATUS_ORDER.map((status) => [status, 0]),
    );
    for (const row of facetRows) {
      if (counter.has(row.status)) {
        counter.set(row.status, (counter.get(row.status) ?? 0) + 1);
      }
    }
    return counter;
  }, [facetRows]);

  const statusTotal = WARRANTY_STATUS_ORDER.reduce(
    (sum, status) => sum + (statusCounts.get(status) ?? 0),
    0,
  );

  /** conic-gradient dựng theo tỷ lệ thật của sáu trạng thái. */
  const donutGradient = useMemo(() => {
    if (statusTotal === 0) return S.bgSubtle;
    let cursor = 0;
    const stops = WARRANTY_STATUS_ORDER.map((status) => {
      const share = ((statusCounts.get(status) ?? 0) / statusTotal) * 100;
      const from = cursor;
      cursor += share;
      return `${STATUS_COLOR[status]} ${from}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [statusCounts, statusTotal]);

  /**
   * Gợi ý cho ô lọc "SKU / mã máy": lấy thẳng từ lát cắt đã tải nên mọi dòng
   * gợi ý chắc chắn ra kết quả — không gợi ý SKU không có hồ sơ nào trong kỳ.
   *
   * Nhãn ghép "MÃ · Tên" để gõ mã hay gõ tên sản phẩm đều lọc trúng danh sách,
   * còn giá trị ghi vào ô là MÃ — đúng thứ `matches()` phía trên và tham số
   * `model` của API xuất tệp đang so khớp.
   */
  const skuSuggestions = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const row of cases) {
      const code = row.model.trim();
      // "UNKNOWN_MODEL" là chỗ máy chủ điền khi hồ sơ chưa định danh được SKU,
      // không phải một mã máy có thật — gợi ý nó chỉ gây hiểu nhầm.
      if (!code || code === "UNKNOWN_MODEL" || byCode.has(code)) continue;
      const name = row.skuName.trim();
      byCode.set(code, name ? `${code} · ${name}` : code);
    }
    return [...byCode.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [cases]);

  const defectItems = useMemo(() => {
    const counter = new Map<string, number>();
    for (const row of viewRows) {
      // Một hồ sơ nhiều lỗi được tính MỘT lần ở TỪNG lỗi tương ứng.
      for (const name of row.defectNames) {
        if (!name) continue;
        counter.set(name, (counter.get(name) ?? 0) + 1);
      }
    }
    return [...counter.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [viewRows]);

  const componentItems = useMemo(() => {
    const counter = new Map<string, number>();
    for (const row of viewRows) {
      for (const entry of row.components) {
        const name = catalog.byCode.get(entry.skuCode)?.sku_name;
        const label = name ? `${entry.skuCode} · ${name}` : entry.skuCode;
        counter.set(label, (counter.get(label) ?? 0) + entry.qty);
      }
    }
    return [...counter.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [viewRows, catalog]);

  // ── Trạng thái xuất tệp ───────────────────────────────────────────────
  const loading = warranty.isLoading || rawCases.isLoading;

  /**
   * Gợi ý bộ lọc kỳ. Mốc của một hồ sơ là NGÀY TIẾP NHẬN (`received_at`) —
   * cùng trường mà `/reports/warranty-defects` cắt kỳ theo, nên lời khuyên và
   * tập dòng máy chủ trả về luôn nói về cùng một thứ. Tính trên `cases` (toàn
   * bộ hồ sơ của kỳ), không phải `viewRows` đã qua các bộ lọc phụ.
   */
  const rangeAdviceDays = useMemo(
    () => cases.map((row) => row.receivedAt.slice(0, 10)),
    [cases],
  );
  const rangeAdvice = useReportRangeAdvice({
    from: period.from,
    to: period.to,
    dataDays: rangeAdviceDays,
    loading,
    probe: WARRANTY_COVERAGE_PROBE,
  });
  const piiReasonTrimmed = piiReason.trim();
  const piiReasonInvalid =
    canExportPii &&
    piiReasonTrimmed.length > 0 &&
    piiReasonTrimmed.length < PII_REASON_MIN_LENGTH;
  // Trần export áp trên TOÀN BỘ tập lọc của máy chủ, không phải trang đang xem.
  const totalRows = n(objectOf(warranty.data?.pagination).total, cases.length);
  const exceedsExportRowLimit = totalRows > EXPORT_ROW_LIMIT;
  const exportBlocked =
    period.invalid || loading || piiReasonInvalid || exceedsExportRowLimit;

  const activeFilterCount =
    statusFilter.length +
    riskFilter.length +
    (componentIssue === undefined ? 0 : 1) +
    (dateDimension === "RECEIVED" ? 0 : 1) +
    [defectTerm, skuTerm, ownerTerm, departmentTerm].filter(
      (value) => value.trim() !== "",
    ).length;

  const dimensionLabel =
    DATE_DIMENSIONS.find((item) => item.value === dateDimension)?.label ??
    DATE_DIMENSIONS[0].label;
  const rangeLabel = `${period.range[0].format("DD/MM/YYYY")} – ${period.range[1].format("DD/MM/YYYY")}`;
  const snapshotLabel = `${dimensionLabel} · ${rangeLabel}`;
  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : (authUser?.roles?.[0]?.role_name ?? "");
  const asOf = warranty.dataUpdatedAt
    ? fmtDateTime(new Date(warranty.dataUpdatedAt).toISOString())
    : EMPTY_TEXT;

  const resetFilters = () => {
    setDateDimension("RECEIVED");
    setStatusFilter([]);
    setRiskFilter([]);
    setComponentIssue(undefined);
    setDefectTerm("");
    setSkuTerm("");
    setOwnerTerm("");
    setDepartmentTerm("");
  };

  const toggleStatus = (value: string) =>
    setStatusFilter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  const startExport = (format: "xlsx" | "pdf") =>
    void exporter.exportReport(format, {
      reportCode: "warranty-defects",
      fileStem: "bao-cao-bao-hanh",
      fileSuffix: `-${period.from}-${period.to}`,
      filters: {
        from_date: period.from,
        to_date: period.to,
        ...(statusFilter.length === 1 ? { status: statusFilter[0] } : {}),
        ...(skuTerm.trim() ? { model: skuTerm.trim() } : {}),
        // `reason` CHỈ đính khi actor có quyền xuất PII và lý do đủ dài — gửi
        // khi thiếu quyền sẽ bị BE trả 403.
        ...(canExportPii && piiReasonTrimmed.length >= PII_REASON_MIN_LENGTH
          ? { reason: piiReasonTrimmed }
          : {}),
      },
    });

  const detailComponents = openCase
    ? openCase.components.map((entry) => {
        const doc = issueDocByCase.get(openCase.caseId);
        const issueNo = text(doc?.component_issue_no, "");
        const name = catalog.byCode.get(entry.skuCode)?.sku_name ?? "";
        const parts = [
          issueNo,
          name
            ? `${name} × ${fmt(entry.qty)}`
            : `${entry.skuCode} × ${fmt(entry.qty)}`,
        ].filter(Boolean);
        return parts.join(" · ");
      })
    : [];

  return (
    <Box
      data-testid="report-07-warranty-components"
      sx={{
        width: "100%",
        minWidth: 0,
        display: "grid",
        gap: { xs: 2, md: 2.5 },
        pb: 3,
        "& > *": { minWidth: 0 },
      }}
    >
      {/* ── Đầu trang ─────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-labelledby="report-07-title"
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              color: S.primaryDark,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {t("reports.warrantyReport.eyebrow")}
          </Box>
          <Box
            component="h1"
            id="report-07-title"
            sx={{
              m: "6px 0 0",
              color: S.textHigh,
              fontSize: { xs: 22, md: 25 },
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {t("reports.warrantyReport.title")}
          </Box>
          <Box sx={{ mt: 0.75, color: S.textMedium, fontSize: 13 }}>
            {t("reports.warrantyReport.subtitle")}
          </Box>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
        >
          <ScopeChip
            label={t("reports.warrantyReport.casesInPeriod", {
              count: fmt(cases.length),
            })}
            tone="primary"
          />
          {roleLabel ? <ScopeChip label={roleLabel} tone="neutral" /> : null}
          <ScopeChip
            label={
              warranty.isFetching
                ? t("reports.warrantyReport.syncing")
                : warranty.data
                  ? t("reports.warrantyReport.dataLocked")
                  : t("reports.warrantyReport.waitingData")
            }
            tone="success"
          />
          <UiButton
            appearance="outlined"
            startIcon={<ReloadOutlined />}
            loading={refreshing}
            disabled={period.invalid || warranty.isFetching}
            onClick={refresh}
          >
            {t("reports.warrantyReport.refresh")}
          </UiButton>
        </Stack>
      </Box>

      {/* ── Ngữ cảnh lát cắt ──────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label={t("reports.warrantyReport.scopeAria")}
        sx={{
          ...CARD_SX,
          position: "relative",
          minHeight: 126,
          p: "22px 24px",
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", md: "row" },
          gap: 3,
          overflow: "hidden",
          color: S.onPrimary,
          border: 0,
          backgroundImage: `linear-gradient(118deg, ${S.primaryDark} 0%, ${S.primary} 100%)`,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: -88,
            right: -42,
            width: 188,
            height: 188,
            border: `30px solid ${S.primaryLight}`,
            borderRadius: "50%",
            opacity: 0.25,
          }}
        />
        <Box sx={{ position: "relative", zIndex: 1, minWidth: 0 }}>
          <Box
            component="small"
            sx={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              opacity: 0.78,
            }}
          >
            {t("reports.warrantyReport.scopeEyebrow")}
          </Box>
          <Box
            component="h2"
            sx={{
              m: "6px 0 7px",
              color: S.onPrimary,
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            {snapshotLabel}
          </Box>
          <Box sx={{ m: 0, fontSize: 13, opacity: 0.84 }}>
            {t("reports.warrantyReport.scopeNote")}
          </Box>
        </Box>
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            justifyItems: { xs: "start", md: "end" },
            gap: 1.25,
            fontSize: 12,
            opacity: 0.92,
            textAlign: { xs: "left", md: "right" },
          }}
        >
          <Box
            component="strong"
            sx={{
              px: "11px",
              py: 1,
              borderRadius: `${RADIUS.control}px`,
              color: S.onPrimary,
              bgcolor: S.primaryDark,
            }}
          >
            {warranty.isFetching
              ? t("reports.warrantyReport.snapshotBuilding")
              : t("reports.warrantyReport.snapshotLocked")}
          </Box>
          <Box component="span">
            {t("reports.warrantyReport.asOf", {
              time: asOf,
              timezone: TIMEZONE_LABEL,
            })}
          </Box>
        </Box>
      </Box>

      {/* ── Dải thông báo quyền PII ───────────────────────────────────── */}
      <Box
        role="note"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          p: "11px 14px",
          border: `1px solid ${S.warningSoft}`,
          borderRadius: `${RADIUS.control}px`,
          color: S.warningText,
          bgcolor: S.warningSoft,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        <WarningOutlined aria-hidden="true" style={{ flex: "0 0 17px" }} />
        <Box component="span">
          {canExportPii
            ? t("reports.warranty.piiCanExport", { min: PII_REASON_MIN_LENGTH })
            : t("reports.warranty.piiCannotExport")}
        </Box>
      </Box>

      {period.invalid ? (
        <UiAlert tone="error">{t("reports.common.dateOrderError")}</UiAlert>
      ) : null}

      <ReportRangeAdviceBanner
        advice={rangeAdvice}
        onApply={(next) => period.setRange([dayjs(next.from), dayjs(next.to)])}
      />

      {piiReasonInvalid ? (
        <UiAlert tone="warning">
          {t("reports.warranty.piiReasonHint", { min: PII_REASON_MIN_LENGTH })}
        </UiAlert>
      ) : null}

      {exceedsExportRowLimit ? (
        <div {...uiStateProps(UI_STATE.DISABLED, "report-export-row-limit")}>
          <UiAlert tone="warning">
            {t("reports.warranty.rowLimitWarning", {
              rows: fmt(totalRows),
              limit: fmt(EXPORT_ROW_LIMIT),
            })}
          </UiAlert>
        </div>
      ) : null}

      {warranty.isError ? (
        <ApiErrorAlert
          error={warranty.error}
          title={t("reports.warranty.caseLoadError")}
          onRetry={() => void warranty.refetch()}
        />
      ) : null}

      {exporter.exportDenied ? (
        <div
          {...uiStateProps(
            UI_STATE.PERMISSION_DENIED,
            "report-export-permission-denied",
          )}
          role="alert"
        >
          <UiAlert
            tone="error"
            title={t("reports.common.exportDenied")}
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </div>
      ) : null}

      {/* ── Bộ lọc ────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-labelledby="report-07-filter-title"
        sx={{ ...CARD_SX, overflow: "visible" }}
      >
        <Box
          sx={{
            minHeight: 64,
            p: "13px 18px",
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.75,
            borderBottom: `1px solid ${S.border}`,
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 34,
                height: 34,
                flex: "0 0 34px",
                display: "grid",
                placeItems: "center",
                borderRadius: `${RADIUS.control}px`,
                color: S.primaryDark,
                bgcolor: S.primarySoft,
                fontSize: 16,
              }}
            >
              <FilterOutlined />
            </Box>
            <Box>
              <Box
                id="report-07-filter-title"
                sx={{ color: S.textHigh, fontSize: 14, fontWeight: 700 }}
              >
                {t("reports.warrantyReport.filterTitle")}
              </Box>
              <Box sx={{ mt: "2px", color: S.textMedium, fontSize: 12 }}>
                {t("reports.warrantyReport.filterHint")}
              </Box>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: 1,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            {activeFilterCount > 0 ? (
              <ReportBadge
                label={t("reports.warrantyReport.filterActive", {
                  count: activeFilterCount,
                })}
                tone="info"
              />
            ) : null}
            <UiButton
              appearance="text"
              startIcon={<FilterOutlined />}
              aria-expanded={!filtersHidden}
              aria-controls="report-07-filter-fields"
              onClick={() => setFiltersHidden((current) => !current)}
              sx={{ display: { xs: "inline-flex", md: "none" } }}
            >
              {filtersHidden
                ? t("reports.warrantyReport.showFilters")
                : t("reports.warrantyReport.hideFilters")}
            </UiButton>
            <UiButton
              appearance="text"
              startIcon={<ReloadOutlined />}
              onClick={resetFilters}
            >
              {t("reports.warrantyReport.reset")}
            </UiButton>
          </Stack>
        </Box>
        <Box
          id="report-07-filter-fields"
          sx={{
            p: "18px",
            display: {
              xs: filtersHidden ? "none" : "grid",
              md: "grid",
            },
            gridTemplateColumns: FILTER_GRID_COLUMNS_SX,
            columnGap: "14px",
            rowGap: 2,
          }}
        >
          <FilterField
            label={t("reports.warrantyReport.fieldDateDimension")}
            span={{ md: 3, xl: 2 }}
          >
            <UiSelect
              aria-label={t("reports.warrantyReport.fieldDateDimension")}
              fullWidth
              value={dateDimension}
              onChange={(value) => setDateDimension(value as DateDimension)}
              options={DATE_DIMENSIONS.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
            />
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldStatus")}
            span={{ md: 3, xl: 2 }}
          >
            <MultiSelectControl
              ariaLabel={t("reports.warrantyReport.fieldStatus")}
              summary={
                statusFilter.length === 0
                  ? t("reports.warrantyReport.allStatuses")
                  : t("reports.warrantyReport.statusSelected", {
                      count: statusFilter.length,
                    })
              }
              options={WARRANTY_STATUS_ORDER.map((status) => ({
                value: status,
                label: WARRANTY_STATUS_LABEL[status],
              }))}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldDateRange")}
            span={{ md: 6, xl: 4 }}
          >
            <UiVuexyDateRangePicker
              aria-label={t("reports.warrantyReport.fieldDateRange")}
              value={period.range}
              format="DD/MM/YYYY"
              placeholder={[
                t("reports.warrantyReport.fromDate"),
                t("reports.warrantyReport.toDate"),
              ]}
              allowClear={false}
              presets={periodPresets}
              className="hn-vuexy-date-range"
              popupClassName="hn-vuexy-date-popup"
              onChange={(value) => {
                if (value?.[0] && value?.[1])
                  period.setRange([value[0], value[1]]);
              }}
            />
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldRisk")}
            span={{ md: 3, xl: 2 }}
          >
            <MultiSelectControl
              ariaLabel={t("reports.warrantyReport.fieldRisk")}
              summary={
                riskFilter.length === 0
                  ? t("reports.warrantyReport.allRisks")
                  : t("reports.warrantyReport.riskSelected", {
                      count: riskFilter.length,
                    })
              }
              options={DUE_RISK_ORDER.map((risk) => ({
                value: risk,
                label: DUE_RISK_LABEL[risk],
              }))}
              value={riskFilter}
              onChange={setRiskFilter}
            />
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldComponentIssued")}
            span={{ md: 3, xl: 2 }}
          >
            <Box
              role="group"
              aria-label={t("reports.warrantyReport.componentFilterAria")}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 1,
              }}
            >
              <ComponentChoice
                active={componentIssue === true}
                icon={<CheckCircleOutlined />}
                title={t("reports.warrantyReport.hasComponent")}
                hint={t("reports.warrantyReport.hasComponentHint")}
                onClick={() =>
                  setComponentIssue((current) =>
                    current === true ? undefined : true,
                  )
                }
              />
              <ComponentChoice
                active={componentIssue === false}
                icon={<InboxOutlined />}
                title={t("reports.warrantyReport.noComponent")}
                hint={t("reports.warrantyReport.noComponentHint")}
                onClick={() =>
                  setComponentIssue((current) =>
                    current === false ? undefined : false,
                  )
                }
              />
            </Box>
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldDefect")}
            htmlFor="report-07-defect"
            span={{ md: 3, xl: 3 }}
          >
            <SearchInput
              id="report-07-defect"
              width="100%"
              placeholder={t("reports.warrantyReport.defectPlaceholder")}
              aria-label={t("reports.warrantyReport.defectAria")}
              value={defectTerm}
              onChange={setDefectTerm}
            />
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldSku")}
            htmlFor="report-07-sku"
            span={{ md: 3, xl: 3 }}
          >
            <SearchInput
              id="report-07-sku"
              width="100%"
              placeholder={t("reports.warrantyReport.skuPlaceholder")}
              aria-label={t("reports.warrantyReport.fieldSku")}
              value={skuTerm}
              onChange={setSkuTerm}
              suggestions={skuSuggestions}
            />
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldOwner")}
            htmlFor="report-07-owner"
            span={{ md: 3, xl: 3 }}
          >
            <SearchInput
              id="report-07-owner"
              width="100%"
              placeholder={t("reports.warrantyReport.ownerPlaceholder")}
              aria-label={t("reports.warrantyReport.fieldOwner")}
              value={ownerTerm}
              onChange={setOwnerTerm}
            />
          </FilterField>

          <FilterField
            label={t("reports.warrantyReport.fieldDepartment")}
            htmlFor="report-07-department"
            span={{ md: 3, xl: 3 }}
          >
            <SearchInput
              id="report-07-department"
              width="100%"
              placeholder={t("reports.warrantyReport.departmentPlaceholder")}
              aria-label={t("reports.warrantyReport.fieldDepartment")}
              value={departmentTerm}
              onChange={setDepartmentTerm}
            />
          </FilterField>
        </Box>
      </Box>

      {/* ── Tổng quan vận hành ────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="report-07-overview">
        <SectionHeading
          eyebrow={t("reports.warrantyReport.overviewEyebrow")}
          title={t("reports.warrantyReport.overviewTitle")}
          id="report-07-overview"
          meta={t("reports.warrantyReport.overviewMeta", {
            timezone: TIMEZONE_LABEL,
            count: fmt(viewRows.length),
          })}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              xl: "repeat(6, minmax(0, 1fr))",
            },
            gap: 1.5,
          }}
        >
          <MetricCard
            label={t("reports.warrantyReport.statTotal")}
            value={fmt(viewRows.length)}
            hint={t("reports.warrantyReport.statTotalHint")}
            icon={<ProfileOutlined />}
            tone="primary"
          />
          <MetricCard
            label={t("reports.warrantyReport.statOpen")}
            value={fmt(openCount)}
            hint={t("reports.warrantyReport.statOpenHint")}
            icon={<HistoryOutlined />}
            tone="info"
          />
          <MetricCard
            label={t("reports.warrantyReport.statDone")}
            value={fmt(completedCount)}
            hint={t("reports.warrantyReport.statDoneHint")}
            icon={<CheckCircleOutlined />}
            tone="success"
          />
          <MetricCard
            label={t("reports.warrantyReport.statOverdue")}
            value={fmt(overdueCount)}
            hint={t("reports.warrantyReport.statOverdueHint")}
            icon={<WarningOutlined />}
            tone="error"
          />
          <MetricCard
            label={t("reports.warrantyReport.statDueSoon")}
            value={fmt(dueSoonCount)}
            hint={t("reports.warrantyReport.statDueSoonHint")}
            icon={<SyncOutlined />}
            tone="warning"
          />
          <MetricCard
            label={t("reports.warrantyReport.statAvgDays")}
            value={
              averageDays === null
                ? EMPTY_TEXT
                : new Intl.NumberFormat("vi-VN", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(averageDays)
            }
            hint={t("reports.warrantyReport.statAvgDaysHint")}
            icon={<HistoryOutlined />}
            tone="primary"
          />
        </Box>
      </Box>

      {/* ── Phân tích snapshot ────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="report-07-analysis">
        <SectionHeading
          eyebrow={t("reports.warrantyReport.analysisEyebrow")}
          title={t("reports.warrantyReport.analysisTitle")}
          id="report-07-analysis"
          meta={t("reports.warrantyReport.analysisMeta")}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "repeat(3, minmax(0, 1fr))",
            },
            gap: 1.75,
          }}
        >
          <ChartCard
            title={t("reports.warrantyReport.chartStatusTitle")}
            description={t("reports.warrantyReport.chartStatusDesc")}
            marker={<BarChartOutlined />}
          >
            {loading ? (
              <Box
                sx={{ minHeight: 220, display: "grid", placeItems: "center" }}
              >
                <UiSpinner />
              </Box>
            ) : (
              <Box
                sx={{
                  minHeight: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 2.5,
                }}
              >
                <Box
                  role="img"
                  aria-label={t("reports.warrantyReport.chartStatusAria", {
                    count: fmt(statusTotal),
                  })}
                  sx={{
                    position: "relative",
                    width: 142,
                    height: 142,
                    flex: "0 0 142px",
                    borderRadius: "50%",
                    background: donutGradient,
                    "&::after": {
                      content: `"${fmt(statusTotal)}\\A ${t(
                        "reports.warrantyReport.donutCaption",
                      )}"`,
                      position: "absolute",
                      inset: "33px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      color: S.textStrong,
                      bgcolor: S.bgSurface,
                      fontSize: 17,
                      fontWeight: 700,
                      lineHeight: 1.15,
                      textAlign: "center",
                      whiteSpace: "pre",
                    },
                  }}
                />
                <Box sx={{ display: "grid", gap: 1.25, fontSize: 11.5 }}>
                  {WARRANTY_STATUS_ORDER.map((status) => {
                    const active = statusFilter.includes(status);
                    return (
                      <Box
                        key={status}
                        component="button"
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleStatus(status)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          px: 0.75,
                          py: 0.25,
                          border: 0,
                          borderRadius: `${RADIUS.control}px`,
                          bgcolor: active ? S.primarySoft : "transparent",
                          color: active ? S.primaryDark : S.textHigh,
                          font: "inherit",
                          fontSize: 11.5,
                          fontWeight: active ? 700 : 400,
                          textAlign: "left",
                          cursor: "pointer",
                          transition: RPT_CONTROL_MOTION_SX.transition,
                          "&:hover": { bgcolor: S.primarySoft },
                        }}
                      >
                        <Box
                          aria-hidden="true"
                          sx={{
                            width: 8,
                            height: 8,
                            flex: "0 0 8px",
                            borderRadius: "50%",
                            bgcolor: STATUS_COLOR[status],
                          }}
                        />
                        {WARRANTY_STATUS_LABEL[status]}:{" "}
                        {fmt(statusCounts.get(status) ?? 0)}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </ChartCard>

          <ChartCard
            title={t("reports.warrantyReport.chartDefectTitle")}
            description={t("reports.warrantyReport.chartDefectDesc")}
            marker={<WarningOutlined />}
          >
            <BarList
              items={defectItems}
              tone="warning"
              emptyText={t("reports.warrantyReport.chartDefectEmpty")}
              onSelect={(label) => setDefectTerm(label)}
            />
          </ChartCard>

          <ChartCard
            title={t("reports.warrantyReport.chartComponentTitle")}
            description={t("reports.warrantyReport.chartComponentDesc")}
            marker={<InboxOutlined />}
          >
            <BarList
              items={componentItems}
              tone="info"
              emptyText={t("reports.warrantyReport.chartComponentEmpty")}
            />
          </ChartCard>
        </Box>
      </Box>

      {/* ── Đối soát hồ sơ ────────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="report-07-detail">
        <SectionHeading
          eyebrow={t("reports.warrantyReport.detailEyebrow")}
          title={t("reports.warrantyReport.detailTitle")}
          id="report-07-detail"
          meta={
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
            >
              {canExportPii ? (
                <UiTextField
                  // UAT TC_UI_22: placeholder dài hơn ô 300px nên bị cắt — nới ô
                  // theo nấc searchWide, placeholder đã rút gọn (messages.ts) và
                  // câu giải thích đầy đủ nằm ở title khi rê chuột.
                  sx={{ width: { xs: "100%", sm: 360 } }}
                  title={t("reports.warranty.piiReasonTitle", {
                    min: PII_REASON_MIN_LENGTH,
                  })}
                  error={piiReasonInvalid}
                  placeholder={t("reports.warranty.piiReasonPlaceholder", {
                    min: PII_REASON_MIN_LENGTH,
                  })}
                  slotProps={{
                    htmlInput: {
                      maxLength: 500,
                      "data-testid": "report-pii-reason",
                      "aria-label": t("reports.warranty.piiReasonAria"),
                    },
                  }}
                  value={piiReason}
                  onChange={(event) => setPiiReason(event.target.value)}
                />
              ) : null}
              <ExportButtons
                exporting={exporter.exporting}
                disabled={exportBlocked}
                onExport={startExport}
              />
            </Stack>
          }
        />

        <Box sx={{ ...CARD_SX, overflow: "hidden" }}>
          <Box
            sx={{
              p: "16px 18px",
              display: "flex",
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.5,
              borderBottom: `1px solid ${S.border}`,
            }}
          >
            <Box>
              <Box
                component="h3"
                sx={{ m: 0, color: S.textHigh, fontSize: 16, fontWeight: 700 }}
              >
                {t("reports.warrantyReport.tableTitle")}
              </Box>
              <Box sx={{ mt: 0.5, color: S.textMedium, fontSize: 12 }}>
                {t("reports.warrantyReport.tableHint", {
                  label: snapshotLabel,
                })}
              </Box>
            </Box>
            <Box
              role="tablist"
              aria-label={t("reports.warrantyReport.viewModeAria")}
              sx={{ display: "flex", gap: 1 }}
            >
              <Box
                component="button"
                type="button"
                role="tab"
                id="report-07-view-table"
                aria-controls="report-07-panel-table"
                aria-selected={shownViewMode === "table"}
                tabIndex={shownViewMode === "table" ? 0 : -1}
                onClick={() => setViewMode("table")}
                sx={VIEW_TAB_SX(shownViewMode === "table")}
              >
                <UnorderedListOutlined aria-hidden="true" />
                {t("reports.warrantyReport.viewTable")}
              </Box>
              <Box
                component="button"
                type="button"
                role="tab"
                id="report-07-view-snapshot"
                aria-controls="report-07-panel-snapshot"
                aria-selected={shownViewMode === "snapshot"}
                tabIndex={shownViewMode === "snapshot" ? 0 : -1}
                onClick={() => setViewMode("snapshot")}
                sx={VIEW_TAB_SX(shownViewMode === "snapshot")}
              >
                <AppstoreOutlined aria-hidden="true" />
                {t("reports.warrantyReport.viewSnapshot")}
              </Box>
            </Box>
          </Box>

          <Box sx={{ px: 2, pt: 2 }}>
            <SectionFilterBar
              state={caseFilter}
              label={t("reports.warrantyReport.tableTitle")}
              unit={t("reports.warrantyReport.tableUnit")}
              showCount={false}
              data-testid="report-07-case-section-filter"
            />
          </Box>

          {/* Bảng */}
          <Box
            id="report-07-panel-table"
            role="tabpanel"
            aria-labelledby="report-07-view-table"
            hidden={deferredViewMode !== "table"}
            sx={{ p: 2 }}
          >
            <Stack
              direction="row"
              sx={{
                mb: 1.5,
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.5,
              }}
            >
              <Box sx={{ color: S.textMedium, fontSize: 12 }}>
                {t("reports.warrantyReport.rowHint")}
              </Box>
              <ReportBadge
                label={t("reports.warrantyReport.caseCount", {
                  count: fmt(caseFilter.rows.length),
                })}
                tone="info"
              />
            </Stack>
            {/*
             * Bảng đổ TRỌN tập hồ sơ đã lọc (bảng và biểu đồ cùng mục phải mô
             * tả cùng một tập), nên một kỳ nhiều hồ sơ kéo trang thành dải rất
             * dài. `maxHeight` nên kỳ ít hồ sơ KHÔNG bị độn thêm khoảng trắng;
             * `thead` ghim lại để cuộn dọc vẫn biết cột nào là cột nào.
             */}
            <Box
              sx={{
                width: "100%",
                overflow: "auto",
                maxHeight: RPT_SCROLL_MAX_HEIGHT,
                overscrollBehavior: "contain",
                scrollBehavior: "smooth",
                border: `1px solid ${S.border}`,
                borderRadius: `${RADIUS.control}px`,
                "& thead th": { position: "sticky", top: 0, zIndex: 2 },
              }}
            >
              <Box
                component="table"
                sx={{
                  width: "100%",
                  minWidth: 1120,
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                }}
              >
                <Box component="thead">
                  <Box component="tr">
                    {[
                      t("shared.table.rowNumber"),
                      t("reports.warrantyReport.colCaseNo"),
                      t("reports.warrantyReport.colReceivedAt"),
                      t("reports.warrantyReport.colStatus"),
                      t("reports.warrantyReport.colDefect"),
                      t("reports.warrantyReport.colRisk"),
                      t("reports.warrantyReport.colOwnerDept"),
                      t("reports.warrantyReport.colComponents"),
                      t("reports.warrantyReport.colCustomer"),
                      t("reports.warrantyReport.colActions"),
                    ].map((header, headerIndex) => (
                      <Box
                        component="th"
                        key={header}
                        sx={headerIndex === 0 ? { ...TH_SX, ...STT_SX } : TH_SX}
                      >
                        {header}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {loading ? (
                    <Box component="tr">
                      <Box
                        component="td"
                        colSpan={10}
                        sx={{ ...TD_SX, textAlign: "center", py: 4 }}
                      >
                        <UiSpinner size={18} label={null} />
                      </Box>
                    </Box>
                  ) : viewRows.length === 0 ? (
                    <Box component="tr">
                      <Box
                        component="td"
                        colSpan={10}
                        sx={{
                          ...TD_SX,
                          textAlign: "center",
                          py: 5,
                          color: S.textMedium,
                        }}
                      >
                        {t("reports.warranty.caseTableEmpty")}
                      </Box>
                    </Box>
                  ) : (
                    caseFilter.rows.map((row, index) => {
                      const defectText =
                        row.defectNames.filter(Boolean).join(", ") ||
                        EMPTY_TEXT;
                      return (
                        <Box
                          component="tr"
                          key={row.caseNo || row.caseId}
                          sx={{
                            transition: `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
                            "&:hover": { bgcolor: S.primarySoft },
                          }}
                        >
                          <Box component="td" sx={{ ...TD_SX, ...STT_SX }}>
                            {index + 1}
                          </Box>
                          <Box component="td" sx={TD_SX}>
                            <Box sx={{ color: S.primaryDark, fontWeight: 700 }}>
                              {orEmpty(row.caseNo)}
                            </Box>
                            <Box sx={CELL_SUB_SX}>{orEmpty(row.model)}</Box>
                          </Box>
                          <Box component="td" sx={TD_SX}>
                            {row.receivedAt
                              ? fmtDate(row.receivedAt)
                              : EMPTY_TEXT}
                          </Box>
                          <Box component="td" sx={TD_SX}>
                            <ReportBadge
                              label={row.statusLabel}
                              tone={toneOf(row.status)}
                            />
                          </Box>
                          <Box component="td" sx={TD_SX} title={defectText}>
                            {defectText}
                          </Box>
                          <Box component="td" sx={TD_SX}>
                            <ReportBadge
                              label={DUE_RISK_LABEL[row.due]}
                              tone={toneOf(row.due)}
                            />
                          </Box>
                          <Box component="td" sx={TD_SX}>
                            <Box component="strong">{orEmpty(row.owner)}</Box>
                            <Box sx={CELL_SUB_SX}>
                              {orEmpty(row.department)}
                            </Box>
                          </Box>
                          <Box
                            component="td"
                            sx={{ ...TD_SX, textAlign: "right" }}
                          >
                            {fmt(row.componentCount)}
                          </Box>
                          <Box component="td" sx={TD_SX}>
                            <Box component="strong">
                              {orEmpty(row.customerName)}
                            </Box>
                            <Box sx={CELL_SUB_SX}>
                              {orEmpty(row.customerPhone)}
                            </Box>
                          </Box>
                          <Box component="td" sx={TD_SX}>
                            <ActionButton
                              kind="detail"
                              sx={{ whiteSpace: "nowrap" }}
                              onClick={() => setOpenCase(row)}
                            >
                              {t("reports.warrantyReport.reconcile")}
                            </ActionButton>
                          </Box>
                        </Box>
                      );
                    })
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Lát cắt */}
          <Box
            id="report-07-panel-snapshot"
            role="tabpanel"
            aria-labelledby="report-07-view-snapshot"
            hidden={deferredViewMode !== "snapshot"}
            sx={{ p: 2 }}
          >
            {caseFilter.rows.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center", color: S.textMedium }}>
                {t("reports.warranty.caseTableEmpty")}
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                {caseWindow.visible.map((row, index) => (
                  <Box
                    component="article"
                    key={row.caseNo || row.caseId}
                    sx={{
                      minWidth: 0,
                      p: "15px",
                      border: `1px solid ${S.border}`,
                      borderRadius: `${RADIUS.control}px`,
                      bgcolor: S.bgSurface,
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", gap: 1 }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ color: S.textMedium, fontSize: 11 }}>
                          {t("shared.table.rowNumber")} {index + 1}
                        </Box>
                        <Box sx={{ color: S.primaryDark, fontWeight: 700 }}>
                          {orEmpty(row.caseNo)}
                        </Box>
                        <Box
                          title={row.skuName}
                          sx={{
                            mt: "4px",
                            overflow: "hidden",
                            color: S.textMedium,
                            fontSize: 11.5,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {orEmpty(row.skuName)}
                        </Box>
                      </Box>
                      <ReportBadge
                        label={row.statusLabel}
                        tone={toneOf(row.status)}
                      />
                    </Stack>
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 1.5,
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 1.25,
                        borderTop: `1px solid ${S.border}`,
                      }}
                    >
                      <Box>
                        <Box
                          sx={{
                            display: "block",
                            color: S.textMedium,
                            fontSize: 10.5,
                          }}
                        >
                          {t("reports.warrantyReport.colRisk")}
                        </Box>
                        <Box sx={{ mt: "3px" }}>
                          <ReportBadge
                            label={DUE_RISK_LABEL[row.due]}
                            tone={toneOf(row.due)}
                          />
                        </Box>
                      </Box>
                      <Box>
                        <Box
                          sx={{
                            display: "block",
                            color: S.textMedium,
                            fontSize: 10.5,
                          }}
                        >
                          {t("reports.warrantyReport.cardDefect")}
                        </Box>
                        <Box
                          component="strong"
                          sx={{ display: "block", mt: "3px", fontSize: 12 }}
                        >
                          {fmt(row.defectNames.filter(Boolean).length)}
                        </Box>
                      </Box>
                      <Box>
                        <Box
                          sx={{
                            display: "block",
                            color: S.textMedium,
                            fontSize: 10.5,
                          }}
                        >
                          {t("reports.warrantyReport.colComponents")}
                        </Box>
                        <Box
                          component="strong"
                          sx={{ display: "block", mt: "3px", fontSize: 12 }}
                        >
                          {fmt(row.componentCount)}
                        </Box>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            display: "block",
                            color: S.textMedium,
                            fontSize: 10.5,
                          }}
                        >
                          {t("reports.warrantyReport.cardOwner")}
                        </Box>
                        <Box
                          component="strong"
                          title={row.owner}
                          sx={{
                            display: "block",
                            mt: "3px",
                            overflow: "hidden",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {orEmpty(row.owner)}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                      <ActionButton
                        kind="detail"
                        onClick={() => setOpenCase(row)}
                      >
                        {t("reports.warrantyReport.reconcile")}
                      </ActionButton>
                    </Box>
                  </Box>
                ))}
                <WindowedMore window={caseWindow} />
              </Box>
            )}
          </Box>

          <Box
            sx={{
              p: "12px 16px",
              display: "flex",
              gap: 1,
              borderTop: `1px solid ${S.border}`,
              color: S.textMedium,
              bgcolor: S.bgSubtle,
              fontSize: 11.5,
              lineHeight: 1.45,
            }}
          >
            <FileTextOutlined aria-hidden="true" style={{ flex: "0 0 16px" }} />
            <Box component="span">
              <Box component="strong" sx={{ color: S.textHigh }}>
                {t("reports.warrantyReport.sourceLocked")}
              </Box>{" "}
              {t("reports.warrantyReport.sourceLockedNote")}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Hộp thoại đối soát ────────────────────────────────────────── */}
      {openCase ? (
        <DrillDownDialog
          title={orEmpty(openCase.caseNo)}
          subtitle={t("reports.warrantyReport.dialogSubtitle", {
            sku: orEmpty(openCase.skuName),
            label: snapshotLabel,
          })}
          onClose={() => setOpenCase(null)}
        >
          <Box
            sx={{
              mb: 2,
              color: S.primaryDark,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {t("reports.warrantyReport.dialogEyebrow")}
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1.75,
            }}
          >
            {[
              [t("reports.warrantyReport.colStatus"), openCase.statusLabel],
              [
                t("reports.warrantyReport.colRisk"),
                DUE_RISK_LABEL[openCase.due],
              ],
              [
                t("reports.warrantyReport.cardOwner"),
                `${orEmpty(openCase.owner)} · ${orEmpty(openCase.department)}`,
              ],
            ].map(([label, value]) => (
              <Box key={label}>
                <Box sx={{ color: S.textMedium, fontSize: 11.5 }}>{label}</Box>
                <Box component="strong" sx={{ display: "block", mt: "4px" }}>
                  {value}
                </Box>
              </Box>
            ))}
            {/* Mỗi giá trị PII đứng trong phần tử riêng để trình đọc màn hình
                và kiểm thử đọc đúng giá trị đã che, không dính vào nhãn. */}
            <Box>
              <Box sx={{ color: S.textMedium, fontSize: 11.5 }}>
                {t("reports.warrantyReport.colCustomer")}
              </Box>
              <Box component="strong" sx={{ display: "block", mt: "4px" }}>
                {orEmpty(openCase.customerName)}
              </Box>
              <Box component="strong" sx={{ display: "block", mt: "2px" }}>
                {orEmpty(openCase.customerPhone)}
              </Box>
              <Box component="strong" sx={{ display: "block", mt: "2px" }}>
                {orEmpty(openCase.customerAddress)}
              </Box>
            </Box>
          </Box>

          <DetailSection title={t("reports.warrantyReport.sectionDefects")}>
            {openCase.defectNames.filter(Boolean).length === 0
              ? t("reports.warrantyReport.noDefects")
              : openCase.defectNames.filter(Boolean).map((value, index) => (
                  <EventLine key={value} index={index}>
                    {value}
                  </EventLine>
                ))}
          </DetailSection>

          <DetailSection title={t("reports.warrantyReport.sectionComponents")}>
            {detailComponents.length === 0
              ? t("reports.warrantyReport.noComponents")
              : detailComponents.map((value, index) => (
                  <EventLine key={value} index={index}>
                    {value}
                  </EventLine>
                ))}
          </DetailSection>

          <DetailSection title={t("reports.warrantyReport.sectionHistory")}>
            {!canReadWarrantyCase ? (
              <UiAlert tone="info">
                {t("reports.warrantyReport.historyForbidden")}
              </UiAlert>
            ) : caseEvents.isLoading ? (
              <UiSpinner size={18} label={null} />
            ) : caseEvents.error ? (
              <ApiErrorAlert
                error={caseEvents.error}
                title={t("reports.warrantyReport.historyLoadFailed")}
                onRetry={() => void caseEvents.refetch()}
              />
            ) : (caseEvents.data ?? []).length === 0 ? (
              t("reports.warrantyReport.noHistory")
            ) : (
              (caseEvents.data ?? []).map((event, index) => (
                <EventLine key={event.id} index={index}>
                  {fmtDateTime(event.performed_at)} ·{" "}
                  {orEmpty(event.performed_by)} · {orEmpty(event.description)}
                </EventLine>
              ))
            )}
          </DetailSection>
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{ mt: 2.25, pt: 2, borderTop: `1px solid ${S.border}` }}
    >
      <Box
        component="h3"
        sx={{
          m: "0 0 8px",
          color: S.textHigh,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {title}
      </Box>
      <Box sx={{ color: S.textHigh, fontSize: 13 }}>{children}</Box>
    </Box>
  );
}

function EventLine({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <Box sx={{ py: 1, borderBottom: `1px solid ${S.border}` }}>
      <Box
        component="span"
        aria-hidden="true"
        sx={{ mr: 0.75, color: S.textMedium }}
      >
        {index + 1}.
      </Box>
      <Box component="span">{children}</Box>
    </Box>
  );
}
