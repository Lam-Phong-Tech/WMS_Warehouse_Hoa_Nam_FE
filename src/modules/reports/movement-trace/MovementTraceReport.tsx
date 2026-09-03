import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import {
  Box,
  Divider,
  Drawer,
  Stack,
  UiButton,
  UiSelect,
  UiStatusBadge,
  UiVuexyDateField,
  RADIUS,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui";
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
import { shortId } from "@/shared/utils/shortId";
import { formatQuantity } from "@/shared/utils/format-number";
import { useSkuCatalog } from "@/modules/reports/operations/report-data";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import {
  RPT_CONTROL_MOTION_SX,
  RPT_SCROLL_MAX_HEIGHT,
} from "@/modules/reports/operations/report-tokens";
import { runReportExport } from "@/modules/reports/operations/report-export";
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
  serverMovementType,
  type RelationFilter,
  type TraceBy,
} from "./movement-trace-labels";

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

/** Ngày giờ theo cách viết của mockup: "08:15 25 thg 8, 2026". */
function formatTraceDateTime(value: string): string {
  const parsed = dayjs(value);
  if (!value || !parsed.isValid()) return EMPTY_TEXT;
  return `${parsed.format("HH:mm")} ${parsed.date()} thg ${parsed.month() + 1}, ${parsed.year()}`;
}

/** Mốc chốt số liệu: "Chốt 10:00 02-09". */
function formatCutOff(value: string): string {
  const parsed = dayjs(value);
  if (!value || !parsed.isValid()) return "";
  return `Chốt ${parsed.format("HH:mm DD-MM")}`;
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
} as const;

/** Ô lưới của bộ lọc — ép mọi control con chiếm trọn bề rộng cột. */
const fieldCellSx = (span: { xs: number; sm: number; xl: number }) => ({
  minWidth: 0,
  gridColumn: {
    xs: `span ${span.xs}`,
    sm: `span ${span.sm}`,
    xl: `span ${span.xl}`,
  },
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
  const permissionState = usePermissionState();
  const canExport = hasPermission(
    WMS_PERMISSION_CATALOG.REPORT_EXPORT,
    permissionState,
  );

  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);
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

  const documentCodeOf = useCallback(
    (row: MovementTraceRow): string => {
      if (row.sourceId === "") return "";
      return documentCodes.byId.get(row.sourceId) ?? shortId(row.sourceId);
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
          `${documentCodeOf(row)} ${row.sourceType} ${row.sourceId}`.toLowerCase();
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
  const movementCountText = `${formatQuantity(rows.length)} biến động`;

  const canReset =
    draft.fromDate !== null ||
    draft.toDate !== null ||
    draft.movementType !== "" ||
    draft.source !== "" ||
    draft.actor !== "" ||
    draft.relation !== "all";

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
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
        `Đã xuất XLSX ${formatQuantity(rowCount ?? rows.length)} dòng.`,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Xuất báo cáo thất bại."));
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
            BÁO CÁO VẬN HÀNH · RPT-MOV-01
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
            Truy vết hàng hóa
          </Box>
          <Box sx={{ mt: "3.6px" }}>
            <Box sx={{ fontSize: 15, lineHeight: 1.467, color: S.textMedium }}>
              Điều tra ledger append-only, chứng từ nguồn và chuỗi reversal theo
              SKU hoặc mã vật lý.
            </Box>
          </Box>
        </Box>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: "6px" }}
        >
          <UiStatusBadge tone="primary" label="Kho tổng Hoa Nam" />
          <UiStatusBadge tone="neutral" label="Điều tra báo cáo kho" />
        </Stack>
      </Box>

      <Box
        component="form"
        aria-label="Bộ lọc báo cáo Biến động tồn kho Trace"
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
            <Box sx={SECTION_EYEBROW_SX}>KỲ DỮ LIỆU &amp; TRA CỨU</Box>
            <Box sx={SECTION_TITLE_SX}>Bộ lọc báo cáo</Box>
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
              Làm mới
            </UiButton>
            <UiButton
              type="button"
              size="small"
              appearance="outlined"
              startIcon={<ExportOutlined />}
              loading={exporting}
              disabled={!canExport}
              title={
                canExport
                  ? undefined
                  : "Bạn không có quyền xuất báo cáo (report.export)."
              }
              onClick={() => void exportXlsx()}
            >
              Xuất XLSX
            </UiButton>
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            columnGap: 1.5,
            rowGap: 1.5,
            alignItems: "end",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(12, minmax(0, 1fr))",
            },
          }}
        >
          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 2 })}>
            <Box sx={FIELD_LABEL_SX}>Tra theo</Box>
            <UiSelect
              fullWidth
              aria-label="Tra theo"
              value={draft.traceBy}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, traceBy: value as TraceBy }))
              }
              options={TRACE_BY_OPTIONS.map((option) => ({ ...option }))}
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 4 })}>
            <Box sx={FIELD_LABEL_SX}>
              {draft.traceBy === "physical"
                ? "Physical Code / QR / Barcode"
                : "SKU"}
            </Box>
            <SearchInput
              width="100%"
              id="movement-trace-code"
              value={draft.code}
              placeholder={
                draft.traceBy === "physical"
                  ? "Quét hoặc dán mã vật lý"
                  : "Nhập mã SKU"
              }
              aria-label={
                draft.traceBy === "physical"
                  ? "Physical Code / QR / Barcode"
                  : "SKU"
              }
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, code: value }))
              }
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 2 })}>
            <Box sx={FIELD_LABEL_SX}>Từ ngày</Box>
            <UiVuexyDateField
              id="movement-trace-from-date"
              field="from"
              aria-label="Từ ngày"
              value={draft.fromDate}
              maxDate={draft.toDate}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, fromDate: value }))
              }
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 2 })}>
            <Box sx={FIELD_LABEL_SX}>Đến ngày</Box>
            <UiVuexyDateField
              id="movement-trace-to-date"
              field="to"
              aria-label="Đến ngày"
              value={draft.toDate}
              minDate={draft.fromDate}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, toDate: value }))
              }
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 2, xl: 2 })}>
            <UiButton
              type="submit"
              size="small"
              startIcon={<SearchOutlined />}
              disabled={report.isFetching}
            >
              Tra cứu
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
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(12, minmax(0, 1fr))",
            },
          }}
        >
          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 3 })}>
            <Box sx={FIELD_LABEL_SX}>Loại biến động</Box>
            <UiSelect
              fullWidth
              aria-label="Loại biến động"
              placeholder="Tất cả loại biến động"
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
            <Box sx={FIELD_LABEL_SX}>Nguồn / chứng từ</Box>
            <SearchInput
              width="100%"
              value={draft.source}
              placeholder="Nhập mã chứng từ"
              aria-label="Nguồn / chứng từ"
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, source: value }))
              }
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 3 })}>
            <Box sx={FIELD_LABEL_SX}>Actor</Box>
            <SearchInput
              width="100%"
              value={draft.actor}
              placeholder="Nhập actor"
              aria-label="Actor"
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, actor: value }))
              }
            />
          </Box>

          <Box sx={fieldCellSx({ xs: 1, sm: 1, xl: 2 })}>
            <Box sx={FIELD_LABEL_SX}>Quan hệ</Box>
            <UiSelect
              fullWidth
              aria-label="Quan hệ"
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
              Đặt lại
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
            {`Không lưu lịch sử tìm kiếm trên trình duyệt · Múi giờ: ${MOVEMENT_TRACE_TIMEZONE} (GMT+7)`}
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

      {report.isError ? (
        <ApiErrorAlert
          error={report.error}
          title="Không tải được sổ biến động"
          onRetry={refresh}
        />
      ) : null}

      <SectionHeading
        eyebrow="TÌNH HÌNH HIỆN TẠI"
        title="Tổng quan chuỗi biến động"
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
          label="Tổng biến động"
          value={formatQuantity(summary?.totalMovements ?? 0)}
          hint="Theo lát cắt API hiện tại"
        />
        <StatCard
          tone="success"
          icon={<InboxInOutlined />}
          label="Nhập đã Post"
          value={formatQuantity(countByType.RECEIPT ?? 0)}
          hint="Biến động tồn kho RECEIPT_POSTED"
        />
        <StatCard
          tone="info"
          icon={<InboxOutOutlined />}
          label="Xuất đã Post"
          value={formatQuantity(countByType.ISSUE ?? 0)}
          hint="Biến động tồn kho ISSUE_POSTED"
        />
        <StatCard
          tone="warning"
          icon={<RollbackOutlined />}
          label="Hoàn tác"
          value={formatQuantity(summary?.reversalCount ?? 0)}
          hint="Biến động tồn kho reversal đã ghi nhận"
        />
      </Box>

      <SectionHeading
        eyebrow="PHÂN TÍCH VẬN HÀNH"
        title="Dòng thời gian Biến động tồn kho Trace"
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
            Dòng thời gian biến động
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
            }}
          >
            <UiStatusBadge tone="info" label={movementCountText} />
            <Box component="span" sx={CAPTION_SX}>
              posted_at ↑ · movement_id
            </Box>
          </Box>
        </Box>
        {/*
         * Timeline đổ TRỌN tập movement đã lọc (không cắt trang — bảng và
         * timeline phải mô tả cùng một tập), nên một lát cắt nhiều biến động
         * kéo trang thành dải rất dài. Cuộn trong khung: `max-height` nên lát
         * cắt ngắn không bị độn thêm khoảng trắng.
         */}
        <Box
          sx={{
            p: 3,
            maxHeight: RPT_SCROLL_MAX_HEIGHT,
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollBehavior: "smooth",
          }}
        >
          {rows.length === 0 ? (
            <Box sx={{ fontSize: 13, color: S.textMedium }}>
              Chưa có biến động nào trong lát cắt đang tra cứu.
            </Box>
          ) : (
            <Box
              component="ol"
              role="list"
              sx={{ listStyle: "none", m: 0, p: 0 }}
            >
              {rows.map((row, index) => {
                const kind = movementKindOf(row);
                const isLast = index === rows.length - 1;
                const documentCode = documentCodeOf(row);
                const details = [
                  row.productCode || EMPTY_TEXT,
                  `Δ ${row.qtyDelta}`,
                  documentCode,
                  row.originalMovementId !== ""
                    ? `hoàn tác ${shortId(row.originalMovementId)}`
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
                          <UiStatusBadge
                            tone={MOVEMENT_KIND_TONES[kind]}
                            label={MOVEMENT_KIND_TIMELINE_LABELS[kind]}
                          />
                          <Box component="span" sx={CAPTION_SX}>
                            {shortId(row.id)}
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
        </Box>
      </Box>

      <SectionHeading
        eyebrow="DỮ LIỆU CHI TIẾT"
        title="Sổ biến động append-only"
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
            Sổ tồn kho biến động
          </Box>
          <Box component="span" sx={CAPTION_SX}>
            Bấm dòng để xem bằng chứng · chỉ đọc
          </Box>
        </Box>
        <Box sx={{ p: 0 }}>
          <ResponsiveDataTable<MovementTraceRow>
            columns={[
              {
                key: "occurred_at",
                header: "Thời điểm (GMT+7)",
                width: 150,
                sortType: "value",
                sortAccessor: (row) => row.occurredAt,
                render: (row) => formatTraceDateTime(row.occurredAt),
              },
              {
                key: "movement_type",
                header: "Loại biến động",
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
                header: "Qty delta",
                width: 90,
                align: "right",
                render: (row) => row.qtyDelta,
              },
              {
                key: "source",
                header: "Chứng từ / dòng",
                width: 160,
                render: (row) => (
                  <>
                    {documentCodeOf(row) || EMPTY_TEXT}
                    <br />
                    <Box component="span" sx={CAPTION_SX}>
                      {row.sourceType || EMPTY_TEXT}
                    </Box>
                  </>
                ),
              },
              {
                key: "actor",
                header: "Actor",
                width: 130,
                render: (row) => row.actor || EMPTY_TEXT,
              },
              {
                key: "chain",
                header: "Điều chỉnh tồn kho chain",
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
                header: "Trạng thái",
                width: 110,
                render: () => LEDGER_ROW_STATUS_LABEL,
              },
            ]}
            rows={rows}
            rowKey={(row) => row.id}
            loading={report.isLoading}
            onRowClick={(row) => setSelected(row)}
            emptyText="Chưa có biến động nào trong lát cắt đang tra cứu."
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
            selected ? `Bằng chứng movement ${shortId(selected.id)}` : undefined
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
                    CHI TIẾT ĐỐI SOÁT
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
                    Bằng chứng movement · {shortId(selected.id)}
                  </Box>
                  <Box sx={{ m: 0, color: S.textMedium, fontSize: 13 }}>
                    {`${MOVEMENT_KIND_LABELS[selectedKind]} · ${formatTraceDateTime(selected.occurredAt)}`}
                  </Box>
                </Box>
                <Box
                  component="button"
                  type="button"
                  aria-label="Đóng bằng chứng"
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
                  <EvidenceField label="Qty delta" value={selected.qtyDelta} />
                  <EvidenceField
                    label="Chứng từ nguồn"
                    value={
                      [documentCodeOf(selected), selected.sourceType]
                        .filter(Boolean)
                        .join(" · ") || EMPTY_TEXT
                    }
                  />
                  <EvidenceField
                    label="Actor"
                    value={selected.actor || EMPTY_TEXT}
                  />
                  <EvidenceField
                    label="Reversal chain"
                    value={
                      selected.correctionChainId !== "" ? (
                        <CopyableId value={selected.correctionChainId} />
                      ) : (
                        EMPTY_TEXT
                      )
                    }
                  />
                  <EvidenceField
                    label="Request ID"
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
                  Chi tiết chứng từ là read-only; sổ biến động là append-only
                  nên màn này không sửa/xóa bất kỳ dòng nào.
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
