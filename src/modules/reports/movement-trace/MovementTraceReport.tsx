import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { checkDateRange, pastDateBounds } from "@/shared/validation/date-rules";
import { toast } from "sonner";
import {
  Box,
  Divider,
  Drawer,
  Stack,
  UiButton,
  UiSelect,
  UiStatusBadge,
  UiVuexyDateRangePicker,
  type UiStatusTone,
  RADIUS,
  SEMANTIC_LIGHT as S,
  FILTER_GRID_COLUMNS_SX,
  filterGridColumnSx,
} from "@/shared/ui";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import {
  BarChartOutlined,
  CloseOutlined,
  ExportOutlined,
  InboxInOutlined,
  InboxOutOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from "@/shared/components/icons";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
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
import {
  RPT_CONTROL_MOTION_SX,
  RPT_SCROLL_MAX_HEIGHT,
} from "@/modules/reports/operations/report-tokens";
import { runReportExport } from "@/modules/reports/operations/report-export";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import {
  MOVEMENT_TRACE_REPORT_CODE,
  MOVEMENT_TRACE_TIMEZONE,
  useMovementTraceReport,
  useSourceDocumentCodes,
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
import { useRenderWindow } from "@/shared/components/data-display/useRenderWindow";
import { WindowedMore } from "@/shared/components/data-display/WindowedMore";

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
  const english = useLanguageStore.getState().language === "en";
  return tStatic("reports.movementTrace.dateTime", {
    time: parsed.format("HH:mm"),
    day: parsed.date(),
    month: english ? parsed.format("MMM") : parsed.month() + 1,
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

const FIELD_LABEL_SX = {
  mb: "5.2px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: "18px",
  color: S.textMedium,
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

/** Ô lưới của bộ lọc — ép mọi control con chiếm trọn bề rộng cột. */
/**
 * Ô của lưới lọc dùng chung (FILTER_GRID_COLUMNS_SX — cột đều, tự tính số cột).
 * Chỉ còn `xl` của mockup có nghĩa: ô rộng (≥ 4/12: ô tìm, khoảng ngày) chiếm
 * 2 cột từ `md`; `xs`/`sm` giữ trong chữ ký để 9 chỗ gọi không phải đổi.
 */
const fieldCellSx = (span: { xs: number; sm: number; xl: number }) => ({
  minWidth: 0,
  gridColumn: filterGridColumnSx(span.xl >= 4),
  "& .MuiFormControl-root, & .MuiButton-root": {
    width: "100%",
    minWidth: 0,
  },
});

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
        <Box sx={{ fontSize: 13, color: S.textMedium }}>{label}</Box>
        <Box
          sx={{
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 30 / 22,
            color: S.textHigh,
          }}
        >
          {value}
        </Box>
        <Box sx={{ fontSize: 12, color: S.textDisabled }}>{hint}</Box>
      </Box>
    </Box>
  );
}

/**
 * Ô "SL thay đổi" dạng viên.
 *
 * NGOÀI MOCKUP (yêu cầu người dùng 2026-09-03): trước đây in số trần. Dùng
 * ĐÚNG `UiStatusBadge` mà cột "Loại biến động" ngay cạnh đang dùng, nên hai
 * cột cùng hình dạng và cùng bảng màu: tăng = xanh, giảm = đỏ, không đổi =
 * trung tính (0 không phải tăng cũng không phải giảm).
 */
function QtyDeltaBadge({ value }: { value: number }) {
  const tone: UiStatusTone =
    value > 0 ? "success" : value < 0 ? "error" : "neutral";
  return <UiStatusBadge tone={tone} label={String(value)} />;
}

function EvidenceField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={{
        p: "14px",
        border: `1px solid ${S.border}`,
        borderRadius: `${RADIUS.sheet / 2}px`,
        bgcolor: S.bgSurface,
      }}
    >
      <Box
        component="span"
        sx={{
          display: "block",
          mb: "6px",
          color: S.textMedium,
          fontSize: 12,
        }}
      >
        {label}
      </Box>
      <Box
        component="strong"
        sx={{ display: "block", overflowWrap: "anywhere", fontSize: 13 }}
      >
        {value}
      </Box>
    </Box>
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
  // Lỗi khoảng ngày lúc bấm Tra cứu — hiện ngay dưới ô, không bắn query.
  const [dateError, setDateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MovementTraceRow | null>(null);
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
  const documentCodes = useSourceDocumentCodes({ fromDate, toDate });

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

  const documentCodeOf = useCallback(
    (row: MovementTraceRow): string => {
      if (row.sourceId === "") return "";
      // Không tra được mã thì "Chưa có" — không in UUID (kể cả rút gọn).
      return documentCodes.byId.get(row.sourceId) ?? EMPTY_TEXT;
    },
    [documentCodes.byId],
  );

  /** posted_at ↑ · movement_id — đúng thứ tự demo công bố ở đầu timeline. */
  const orderedRows = useMemo(() => {
    const rows = report.data?.rows ?? [];
    return [...rows].sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
    );
  }, [report.data]);

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
  const traceByLabel =
    TRACE_BY_OPTIONS.find((option) => option.value === applied.traceBy)
      ?.label ?? "";
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
        row.correctionChainId,
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

  /**
   * Dòng thời gian vẽ dần. Bộ đếm "N biến động" ngay trên đầu khối vẫn lấy từ
   * `timelineFilter.rows.length` — tức TOÀN BỘ tập đã lọc, không phải phần đang
   * vẽ — nên con số công bố không đổi; chỉ số node DOM đổi.
   */
  const timelineWindow = useRenderWindow(timelineFilter.rows);

  const movementCountText = t("reports.movementTrace.movementCount", {
    count: formatQuantity(rows.length),
  });
  const timelineCountText = t("reports.movementTrace.movementCount", {
    count: formatQuantity(timelineFilter.rows.length),
  });

  const canReset =
    draft.fromDate !== null ||
    draft.toDate !== null ||
    draft.movementType !== "" ||
    draft.source !== "" ||
    draft.actor !== "" ||
    draft.relation !== "all";

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    // Bộ chọn khoảng cho phép một đầu rỗng (đang gõ dở): bắt buộc đủ hai đầu
    // hoặc bỏ trống cả hai, và cả hai phải nằm trong 2000 → hôm nay.
    const halfOpen = (draft.fromDate === null) !== (draft.toDate === null);
    const rangeCheck = halfOpen
      ? { ok: false as const, message: t("shared.validation.dateRequired") }
      : checkDateRange(draft.fromDate, draft.toDate, pastDateBounds());
    if (!rangeCheck.ok) {
      setDateError(rangeCheck.message);
      return;
    }
    setDateError(null);
    setApplied(draft);
  };

  /** Đặt lại: chỉ 6 bộ lọc phụ, giữ nguyên "Tra theo" + mã đang tra cứu. */
  const resetSecondaryFilters = () => {
    const next: AppliedFilters = {
      ...draft,
      fromDate: null,
      toDate: null,
      movementType: "",
      source: "",
      actor: "",
      relation: "all",
    };
    setDraft(next);
    setDateError(null);
    setApplied({
      ...applied,
      ...next,
      traceBy: applied.traceBy,
      code: applied.code,
    });
  };

  const { refreshing, refresh } = useReportRefresh({
    refetch: () => report.refetch(),
    readError: () => report.error,
  });

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const rowCount = await runReportExport("xlsx", {
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
    } finally {
      setExporting(false);
    }
  };

  const selectedKind = selected ? movementKindOf(selected) : null;

  return (
    <Box
      data-testid="movement-trace-report"
      sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
    >
      <Box
        component="header"
        sx={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          alignItems: { xs: "flex-start", md: "center" },
          minHeight: { md: 72 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ mb: "3.2px", ...SECTION_EYEBROW_SX }}>
            {t("reports.movementTrace.eyebrow")}
          </Box>
          <Box
            component="h1"
            id="movement-trace-title"
            sx={{
              m: 0,
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 38 / 24,
              color: S.textHigh,
            }}
          >
            {t("reports.movementTrace.title")}
          </Box>
          <Box sx={{ mt: "3.6px" }}>
            <Box sx={{ fontSize: 15, lineHeight: 1.467, color: S.textMedium }}>
              {t("reports.movementTrace.subtitle")}
            </Box>
          </Box>
        </Box>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: "6px" }}
        >
          <UiStatusBadge
            tone="primary"
            label={t("reports.movementTrace.badgeWarehouse")}
          />
          <UiStatusBadge
            tone="neutral"
            label={t("reports.movementTrace.badgeScope")}
          />
        </Stack>
      </Box>

      <Box
        component="form"
        aria-label={t("reports.movementTrace.filterAria")}
        onSubmit={submitSearch}
        sx={{
          bgcolor: S.bgSurface,
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.card}px`,
          boxShadow: S.shadowCard,
          display: "grid",
          gap: "14px",
          p: { xs: "14px", md: 2 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: { xs: "flex-start", md: "center" },
          }}
        >
          <Box>
            <Box sx={SECTION_EYEBROW_SX}>
              {t("reports.movementTrace.filterEyebrow")}
            </Box>
            <Box sx={SECTION_TITLE_SX}>
              {t("reports.movementTrace.filterTitle")}
            </Box>
          </Box>
          <Stack direction="row" spacing={0.75}>
            <UiButton
              type="button"
              size="small"
              appearance="outlined"
              startIcon={<ReloadOutlined />}
              loading={refreshing}
              onClick={refresh}
              disabled={report.isFetching}
            >
              {t("reports.movementTrace.refresh")}
            </UiButton>
            <UiButton
              type="button"
              size="small"
              appearance="outlined"
              startIcon={<ExportOutlined />}
              loading={exporting}
              disabled={!canExport}
              title={
                canExport ? undefined : t("reports.movementTrace.exportDenied")
              }
              onClick={() => void exportXlsx()}
            >
              {t("reports.movementTrace.exportXlsx")}
            </UiButton>
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            columnGap: 1.5,
            rowGap: 1.5,
            alignItems: "end",
            gridTemplateColumns: FILTER_GRID_COLUMNS_SX,
          }}
        >
          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 2 })}>
            <Box sx={FIELD_LABEL_SX}>{t("reports.movementTrace.traceBy")}</Box>
            <UiSelect
              fullWidth
              aria-label={t("reports.movementTrace.traceBy")}
              value={draft.traceBy}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, traceBy: value as TraceBy }))
              }
              options={TRACE_BY_OPTIONS.map((option) => ({ ...option }))}
            />
          </Box>

          {/* Ô tìm 1 cột (~280px đủ cho placeholder) để nút "Tra cứu" còn chỗ cùng hàng ở 1920. */}
          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 3 })}>
            <Box sx={FIELD_LABEL_SX}>
              {draft.traceBy === "physical"
                ? t("reports.movementTrace.physicalCode")
                : "SKU"}
            </Box>
            <SearchInput
              width="100%"
              id="movement-trace-code"
              value={draft.code}
              placeholder={
                draft.traceBy === "physical"
                  ? t("reports.movementTrace.physicalPlaceholder")
                  : t("reports.movementTrace.skuPlaceholder")
              }
              aria-label={
                draft.traceBy === "physical"
                  ? t("reports.movementTrace.physicalCode")
                  : "SKU"
              }
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, code: value }))
              }
            />
          </Box>

          {/*
           * Một bộ chọn KHOẢNG chiếm chỗ hai ô cũ — đồng bộ với các màn Báo
           * cáo khác. Khoảng vẫn là DRAFT: chỉ vào bộ lọc khi bấm "Tra cứu",
           * đúng như bản hai ô.
           */}
          <Box sx={fieldCellSx({ xs: 1, sm: 2, xl: 4 })}>
            <Box sx={FIELD_LABEL_SX}>
              {t("reports.movementTrace.fieldDateRange")}
            </Box>
            <UiVuexyDateRangePicker
              aria-label={t("reports.movementTrace.fieldDateRange")}
              value={[draft.fromDate, draft.toDate]}
              format="DD/MM/YYYY"
              placeholder={[
                t("reports.movementTrace.fromDate"),
                t("reports.movementTrace.toDate"),
              ]}
              allowClear={false}
              // Dữ liệu chỉ có trong quá khứ: khoá ngày tương lai (mốc dưới giữ mặc định 2000).
              maxDate={dayjs().endOf("day")}
              presets={periodPresets}
              className="hn-vuexy-date-range"
              popupClassName="hn-vuexy-date-popup"
              onChange={(value) => {
                setDateError(null);
                setDraft((prev) => ({
                  ...prev,
                  fromDate: value?.[0] ?? null,
                  toDate: value?.[1] ?? null,
                }));
              }}
            />
            {dateError ? (
              <Box
                role="alert"
                sx={{ mt: 0.5, fontSize: 12, color: "error.main" }}
              >
                {dateError}
              </Box>
            ) : null}
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 2, xl: 2 })}>
            <UiButton
              type="submit"
              size="small"
              startIcon={<SearchOutlined />}
              disabled={report.isFetching}
            >
              {t("reports.movementTrace.search")}
            </UiButton>
          </Box>
        </Box>

        <Divider />

        <Box
          sx={{
            display: "grid",
            columnGap: 1.5,
            rowGap: 1.5,
            alignItems: "end",
            gridTemplateColumns: FILTER_GRID_COLUMNS_SX,
          }}
        >
          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 3 })}>
            <Box sx={FIELD_LABEL_SX}>
              {t("reports.movementTrace.movementType")}
            </Box>
            <UiSelect
              fullWidth
              aria-label={t("reports.movementTrace.movementType")}
              placeholder={t("reports.movementTrace.movementTypeAll")}
              value={draft.movementType}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, movementType: value }))
              }
              options={MOVEMENT_TYPE_FILTER_OPTIONS.map((option) => ({
                ...option,
              }))}
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 3 })}>
            <Box sx={FIELD_LABEL_SX}>{t("reports.movementTrace.source")}</Box>
            <SearchInput
              width="100%"
              value={draft.source}
              placeholder={t("reports.movementTrace.sourcePlaceholder")}
              aria-label={t("reports.movementTrace.source")}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, source: value }))
              }
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 3 })}>
            <Box sx={FIELD_LABEL_SX}>{t("reports.movementTrace.actor")}</Box>
            <SearchInput
              width="100%"
              value={draft.actor}
              placeholder={t("reports.movementTrace.actorPlaceholder")}
              aria-label={t("reports.movementTrace.actor")}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, actor: value }))
              }
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 2 })}>
            <Box sx={FIELD_LABEL_SX}>{t("reports.movementTrace.relation")}</Box>
            <UiSelect
              fullWidth
              aria-label={t("reports.movementTrace.relation")}
              value={draft.relation}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  relation: value as RelationFilter,
                }))
              }
              options={RELATION_OPTIONS.map((option) => ({ ...option }))}
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 2, xl: 1 })}>
            <UiButton
              type="button"
              size="small"
              appearance="text"
              disabled={!canReset}
              onClick={resetSecondaryFilters}
            >
              {t("reports.movementTrace.reset")}
            </UiButton>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: "6px",
            pt: "2px",
            alignItems: { xs: "flex-start", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
          }}
        >
          <Box component="span" sx={CAPTION_SX}>
            {t("reports.movementTrace.privacyNote", {
              timezone: MOVEMENT_TRACE_TIMEZONE,
            })}
          </Box>
          <Box component="span" sx={CAPTION_SX}>
            {[
              appliedCode !== "" ? `${traceByLabel}: ${appliedCode}` : "",
              cutOff,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Box>
        </Box>
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

      <SectionHeading
        eyebrow={t("reports.movementTrace.summaryEyebrow")}
        title={t("reports.movementTrace.summaryTitle")}
        right={[movementCountText, cutOff].filter(Boolean).join(" · ")}
      />

      <Box
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
          icon={<BarChartOutlined />}
          label={t("reports.movementTrace.statTotal")}
          value={formatQuantity(summary?.totalMovements ?? 0)}
          hint={t("reports.movementTrace.statTotalHint")}
        />
        <StatCard
          tone="success"
          icon={<InboxInOutlined />}
          label={t("reports.movementTrace.statReceipt")}
          value={formatQuantity(countByType.RECEIPT ?? 0)}
          hint={t("reports.movementTrace.statReceiptHint")}
        />
        <StatCard
          tone="info"
          icon={<InboxOutOutlined />}
          label={t("reports.movementTrace.statIssue")}
          value={formatQuantity(countByType.ISSUE ?? 0)}
          hint={t("reports.movementTrace.statIssueHint")}
        />
        <StatCard
          tone="warning"
          icon={<RollbackOutlined />}
          label={t("reports.movementTrace.statReversal")}
          value={formatQuantity(summary?.reversalCount ?? 0)}
          hint={t("reports.movementTrace.statReversalHint")}
        />
      </Box>

      <SectionHeading
        eyebrow={t("reports.movementTrace.analysisEyebrow")}
        title={t("reports.movementTrace.analysisTitle")}
      />

      <Box sx={CARD_SX}>
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
        <Box
          sx={{
            px: 3,
            pt: 0,
            pb: 3,
            maxHeight: RPT_SCROLL_MAX_HEIGHT,
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollBehavior: "smooth",
          }}
        >
          {timelineFilter.rows.length === 0 ? (
            <Box sx={{ fontSize: 13, color: S.textMedium }}>
              {t("reports.movementTrace.timelineEmpty")}
            </Box>
          ) : (
            <Box
              component="ol"
              role="list"
              sx={{ listStyle: "none", m: 0, p: 0 }}
            >
              {timelineWindow.visible.map((row, index) => {
                const kind = movementKindOf(row);
                const isLast = index === timelineWindow.shown - 1;
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
                  <Box
                    component="li"
                    key={row.id}
                    sx={{ display: "flex", gap: 1.5 }}
                  >
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
                          bgcolor:
                            TIMELINE_DOT_COLORS[MOVEMENT_KIND_TONES[kind]],
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
              })}
            </Box>
          )}
          <WindowedMore window={timelineWindow} />
        </Box>
      </Box>

      <SectionHeading
        eyebrow={t("reports.movementTrace.detailEyebrow")}
        title={""}
      />

      <Box sx={CARD_SX}>
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
            {t("reports.movementTrace.ledgerTitle")}
          </Box>
          <Box component="span" sx={CAPTION_SX}>
            {t("reports.movementTrace.ledgerHint")}
          </Box>
        </Box>
        <Box sx={{ px: 3, pb: 2 }}>
          <SectionFilterBar
            state={ledgerFilter}
            label={t("reports.movementTrace.ledgerTitle")}
            data-testid="movement-trace-ledger-filter"
          />
        </Box>
        <Box sx={{ p: 0 }}>
          <ResponsiveDataTable<MovementTraceRow>
            columns={[
              {
                key: "stt",
                header: t("shared.table.rowNumber"),
                width: 64,
                align: "center",
                // STT bám theo VỊ TRÍ GỐC của dòng trong tập đang lọc, cùng
                // quy ước với mvpRowNumber ở các bảng khác của dự án, nên số
                // thứ tự không nhảy khi bấm sắp xếp cột.
                render: (row) => rowIndexOf(ledgerFilter.rows, row) + 1,
              },
              {
                key: "occurred_at",
                header: t("reports.movementTrace.colOccurredAt"),
                width: 150,
                sortType: "value",
                sortAccessor: (row) => row.occurredAt,
                render: (row) => formatTraceDateTime(row.occurredAt),
              },
              {
                key: "movement_type",
                header: t("reports.movementTrace.movementType"),
                width: 150,
                render: (row) => {
                  const kind = movementKindOf(row);
                  return (
                    <UiStatusBadge
                      tone={MOVEMENT_KIND_TONES[kind]}
                      label={MOVEMENT_KIND_LABELS[kind]}
                    />
                  );
                },
              },
              {
                key: "sku",
                header: "SKU",
                width: 120,
                render: (row) => row.productCode || EMPTY_TEXT,
              },
              {
                key: "qty_delta",
                header: t("reports.movementTrace.colQtyDelta"),
                width: 90,
                align: "right",
                render: (row) => <QtyDeltaBadge value={row.qtyDelta} />,
              },
              {
                key: "source",
                header: t("reports.movementTrace.colSource"),
                width: 160,
                render: (row) => (
                  <>
                    {documentCodeOf(row) || EMPTY_TEXT}
                    <br />
                    <Box component="span" sx={CAPTION_SX}>
                      {movementSourceLabel(row.sourceType) || EMPTY_TEXT}
                    </Box>
                  </>
                ),
              },
              {
                key: "actor",
                header: t("reports.movementTrace.actor"),
                width: 130,
                render: (row) => row.actor || EMPTY_TEXT,
              },
              {
                key: "chain",
                header: t("reports.movementTrace.colChain"),
                width: 150,
                render: (row) =>
                  row.correctionChainId !== "" ? (
                    <CopyableId value={row.correctionChainId} />
                  ) : (
                    EMPTY_TEXT
                  ),
              },
              {
                key: "status",
                header: t("reports.movementTrace.colStatus"),
                width: 110,
                render: () => LEDGER_ROW_STATUS_LABEL,
              },
            ]}
            rows={ledgerFilter.rows}
            rowKey={(row) => row.id}
            loading={report.isLoading}
            onRowClick={(row) => setSelected(row)}
            emptyText={t("reports.movementTrace.timelineEmpty")}
            // Sổ ledger không cắt trang (xem ghi chú đầu movement-trace-api.ts)
            // nên bảng dài tự cuộn trong khung, tiêu đề cột được ghim lại.
            maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
          />
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={selected !== null}
        onClose={() => setSelected(null)}
      >
        <Box
          role="dialog"
          aria-label={
            selected
              ? t("reports.movementTrace.drawerAria", {
                  code: selected.movementNo || EMPTY_TEXT,
                })
              : undefined
          }
          sx={{ width: 470, maxWidth: "100vw" }}
        >
          {selected && selectedKind ? (
            <>
              <Box
                component="header"
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 2,
                  p: 3,
                  borderBottom: `1px solid ${S.border}`,
                  bgcolor: S.bgSubtle,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Box component="span" sx={SECTION_EYEBROW_SX}>
                    {t("reports.movementTrace.drawerEyebrow")}
                  </Box>
                  <Box
                    component="h2"
                    sx={{
                      my: "6px",
                      fontSize: 20,
                      fontWeight: 600,
                      color: S.textHigh,
                    }}
                  >
                    {t("reports.movementTrace.drawerTitle")} ·{" "}
                    {selected.movementNo || EMPTY_TEXT}
                  </Box>
                  <Box sx={{ m: 0, color: S.textMedium, fontSize: 13 }}>
                    {`${MOVEMENT_KIND_LABELS[selectedKind]} · ${formatTraceDateTime(selected.occurredAt)}`}
                  </Box>
                </Box>
                <Box
                  component="button"
                  type="button"
                  aria-label={t("reports.movementTrace.drawerClose")}
                  onClick={() => setSelected(null)}
                  sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    border: 0,
                    borderRadius: `${RADIUS.control}px`,
                    bgcolor: "transparent",
                    color: S.textMedium,
                    fontSize: 16,
                    cursor: "pointer",
                    ...RPT_CONTROL_MOTION_SX,
                    "&:hover": { bgcolor: S.secondarySoft },
                  }}
                >
                  <CloseOutlined />
                </Box>
              </Box>
              <Box sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 1.5,
                  }}
                >
                  <EvidenceField
                    label="SKU"
                    value={selected.productCode || EMPTY_TEXT}
                  />
                  <EvidenceField
                    label={t("reports.movementTrace.colQtyDelta")}
                    value={<QtyDeltaBadge value={selected.qtyDelta} />}
                  />
                  <EvidenceField
                    label={t("reports.movementTrace.fieldSourceDoc")}
                    value={
                      [
                        documentCodeOf(selected),
                        movementSourceLabel(selected.sourceType),
                      ]
                        .filter(Boolean)
                        .join(" · ") || EMPTY_TEXT
                    }
                  />
                  <EvidenceField
                    label={t("reports.movementTrace.actor")}
                    value={selected.actor || EMPTY_TEXT}
                  />
                  <EvidenceField
                    label={t("reports.movementTrace.fieldReversalChain")}
                    value={
                      selected.correctionChainId !== "" ? (
                        <CopyableId value={selected.correctionChainId} />
                      ) : (
                        EMPTY_TEXT
                      )
                    }
                  />
                  <EvidenceField
                    label={t("reports.movementTrace.fieldRequestId")}
                    value={
                      report.data?.requestId ? (
                        <CopyableId value={report.data.requestId} />
                      ) : (
                        EMPTY_TEXT
                      )
                    }
                  />
                </Box>
                <Box
                  sx={{
                    mt: 2.5,
                    p: 1.5,
                    borderRadius: `${RADIUS.control}px`,
                    bgcolor: S.primarySoft,
                    color: S.primaryDark,
                    fontSize: 13,
                  }}
                >
                  {t("reports.movementTrace.readonlyNote")}
                </Box>
              </Box>
            </>
          ) : null}
        </Box>
      </Drawer>
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
