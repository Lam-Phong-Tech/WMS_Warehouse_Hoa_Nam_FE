import { useMemo, useState, type ReactNode } from "react";
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
} from "@/shared/ui";
import {
  AppstoreOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { EMPTY_TEXT, orEmpty } from "@/shared/constants/display";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import {
  periodPresetOptions,
  type PeriodPreset,
} from "../operations/report-format";
import { usePeriodFilter } from "../operations/report-period";
import { RPT_SCROLL_MAX_HEIGHT } from "../operations/report-tokens";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { ExportButtons } from "../operations/report-filters";
import { useReportExport } from "../operations/report-export";
import { useClientPagination } from "../operations/report-columns";
import { ReportPaginationBar } from "../operations/report-table";
import { DrillDownDialog } from "../operations/report-ui";
import { useT } from "@/shared/i18n/useT";
import {
  LABEL_EVENT_LIMIT,
  PACKING_LABEL_ACTIONS,
  PACKING_LABEL_RESULTS,
  usePackingLabelReport,
  usePackingLabelSnapshot,
  type PackingLabelAction,
  type PackingLabelEvent,
  type PackingLabelResult,
} from "./packing-label-api";

/**
 * RPT-05 — Nhãn đóng gói · Print / Reprint (bản port 1:1 mockup 8.6).
 *
 * Chuỗi hiển thị để tiếng Việt thẳng trong file như RPT-07 (bản port 1:1 còn
 * lại): mockup là hợp đồng giao diện, tách chuỗi ra bảng i18n rồi ghép lại sẽ
 * làm mất khả năng đối chiếu từng dòng chữ với mockup khi nghiệm thu.
 *
 * Toàn bộ số liệu đến từ `usePackingLabelReport()` — không có ô nào cứng, không
 * có nút nào không dẫn tới hành động thật.
 */

const RESULT_LABELS: Readonly<Record<PackingLabelResult, string>> = {
  PRINTED: "In thành công",
  PRINT_FAILED: "In lỗi",
  PENDING_PRINT: "Chờ máy in phản hồi",
};

const RESULT_TONES: Readonly<
  Record<PackingLabelResult, "success" | "error" | "warning">
> = {
  PRINTED: "success",
  PRINT_FAILED: "error",
  PENDING_PRINT: "warning",
};

const ACTION_LABELS: Readonly<Record<PackingLabelAction, string>> = {
  PRINT: "Print",
  REPRINT: "In lại",
};

const SURFACE_SX = {
  minWidth: 0,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  bgcolor: S.bgSurface,
  boxShadow: S.shadowCard,
} as const;

type MetricTone = "primary" | "success" | "error" | "warning";

const METRIC_TONES: Readonly<
  Record<MetricTone, { accent: string; soft: string; text: string }>
> = {
  primary: { accent: S.primary, soft: S.primarySoft, text: S.primaryDark },
  success: { accent: S.success, soft: S.successSoft, text: S.successText },
  error: { accent: S.error, soft: S.errorSoft, text: S.errorText },
  warning: { accent: S.warning, soft: S.warningSoft, text: S.warningText },
};

function ratio(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

/** Thẻ số liệu của mockup: viền trên theo tông, nền chuyển sắc, thanh tỷ trọng. */
function MetricCard({
  label,
  value,
  hint,
  metaLabel,
  metaValue,
  progress,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  metaLabel: string;
  metaValue: string;
  progress: number;
  tone: MetricTone;
  icon: ReactNode;
}) {
  const style = METRIC_TONES[tone];
  return (
    <Box
      component="article"
      sx={{
        minHeight: 166,
        px: 2.5,
        py: 2.25,
        border: `1px solid ${S.border}`,
        borderTop: `2px solid ${style.accent}`,
        borderRadius: `${RADIUS.card}px`,
        backgroundImage: `linear-gradient(145deg, ${S.bgSurface} 30%, ${style.soft})`,
        boxShadow: S.shadowCard,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.25,
        }}
      >
        <Box
          component="span"
          sx={{
            color: S.textHigh,
            fontSize: 12,
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
            width: 36,
            height: 36,
            flex: "none",
            display: "grid",
            placeItems: "center",
            borderRadius: `${RADIUS.control}px`,
            bgcolor: style.soft,
            color: style.text,
            fontSize: 18,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Box
        component="strong"
        sx={{
          display: "block",
          mt: 2.25,
          fontSize: 30,
          lineHeight: 1,
          letterSpacing: "-0.025em",
          color: S.textStrong,
        }}
      >
        {value}
      </Box>
      <Box sx={{ minHeight: 18, mt: 1.5, fontSize: 12, color: S.textMedium }}>
        {hint}
      </Box>
      <Box
        sx={{
          mt: 1.75,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.25,
          fontSize: 11.5,
          color: S.textMedium,
        }}
      >
        <Box component="span">{metaLabel}</Box>
        <Box component="strong" sx={{ color: style.text }}>
          {metaValue}
        </Box>
      </Box>
      <Box
        sx={{
          height: 4,
          mt: 0.875,
          overflow: "hidden",
          borderRadius: 99,
          bgcolor: style.soft,
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${progress}%`,
            borderRadius: "inherit",
            bgcolor: style.accent,
          }}
        />
      </Box>
    </Box>
  );
}

/** Ô nhãn + control của lưới bộ lọc 12 cột trong mockup. */
function FilterField({
  label,
  htmlFor,
  span = 2,
  tabletSpan = 1,
  children,
}: {
  label: string;
  htmlFor?: string;
  span?: number;
  tabletSpan?: number;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        gridColumn: {
          xs: "span 1",
          sm: `span ${tabletSpan}`,
          xl: `span ${span}`,
        },
      }}
    >
      <Box
        component="label"
        htmlFor={htmlFor}
        sx={{
          display: "block",
          mb: 0.75,
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

function SectionHead({
  id,
  title,
  description,
  actions,
  sx,
}: {
  id: string;
  title: string;
  description: string;
  actions?: ReactNode;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "stretch", md: "flex-start" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        ...sx,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box
          component="h2"
          id={id}
          sx={{
            m: 0,
            fontSize: 18,
            lineHeight: 1.33,
            fontWeight: 700,
            color: S.textStrong,
          }}
        >
          {title}
        </Box>
        <Box sx={{ mt: 0.5, fontSize: 12, color: S.textMedium }}>
          {description}
        </Box>
      </Box>
      {actions ? (
        <Stack
          direction="row"
          sx={{
            flexWrap: "wrap",
            justifyContent: { xs: "flex-start", md: "flex-end" },
            gap: 1,
            alignItems: "center",
          }}
        >
          {actions}
        </Stack>
      ) : null}
    </Box>
  );
}

function ResultBadge({ value }: { value: PackingLabelResult }) {
  return (
    <UiStatusBadge
      size="small"
      tone={RESULT_TONES[value]}
      label={RESULT_LABELS[value]}
    />
  );
}

function AuditBadge({ event }: { event: PackingLabelEvent }) {
  return (
    <UiStatusBadge
      size="small"
      tone={event.auditComplete ? "success" : "warning"}
      label={event.auditComplete ? "Đủ audit" : "Audit chưa đủ"}
      title={
        event.auditComplete
          ? "Lần in có đủ thời điểm, máy in, người thao tác và kết quả."
          : `Còn thiếu: ${event.auditMissing.join(", ")}.`
      }
    />
  );
}

/** Hai dòng chữ chồng nhau trong một ô bảng (tiêu đề + chú thích mờ). */
function CellStack({ title, note }: { title: string; note: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        sx={{
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </Box>
      <Box sx={{ mt: 0.375, fontSize: 11.5, color: S.textMedium }}>{note}</Box>
    </Box>
  );
}

function DetailCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: 1.375,
        border: `1px solid ${S.border}`,
        borderRadius: `${RADIUS.control}px`,
        bgcolor: S.bgCanvas,
      }}
    >
      <Box
        sx={{
          color: S.textMedium,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          mt: 0.5,
          fontSize: 13,
          fontWeight: 600,
          color: S.textStrong,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

export default function PackingLabelPrintReport() {
  const t = useT();
  const period = usePeriodFilter("this-month");
  const exporter = useReportExport();

  const [view, setView] = useState<"table" | "snapshot">("table");
  const [advanced, setAdvanced] = useState(false);
  const [sliceFilters, setSliceFilters] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [printerFilter, setPrinterFilter] = useState("");
  const [openLabelId, setOpenLabelId] = useState<string | null>(null);

  const report = usePackingLabelReport({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });

  const printerNames = useMemo(
    () =>
      new Map(report.printerOptions.map((item) => [item.value, item.label])),
    [report.printerOptions],
  );
  const actorNames = useMemo(
    () => new Map(report.actorOptions.map((item) => [item.value, item.label])),
    [report.actorOptions],
  );

  const snapshot = usePackingLabelSnapshot(openLabelId, {
    labels: report.labels,
    printerNames,
    actorNames,
  });

  const rows = useMemo(() => {
    const needle = keyword.trim().toLocaleLowerCase("vi");
    return report.events
      .filter((event) => !actionFilter || event.action === actionFilter)
      .filter((event) => !resultFilter || event.result === resultFilter)
      .filter((event) => !printerFilter || event.printerId === printerFilter)
      .filter((event) => {
        if (needle === "") return true;
        return [
          event.outboundNo,
          event.labelCode,
          event.labelId,
          event.recipient,
          event.printerName,
          event.actorName,
          event.errorCode,
          event.reasonCode,
          event.reasonNote,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(needle);
      });
  }, [report.events, actionFilter, resultFilter, printerFilter, keyword]);

  const pagination = useClientPagination(rows, 15);

  const metrics = useMemo(() => {
    const total = rows.length;
    const printed = rows.filter((row) => row.result === "PRINTED").length;
    const failed = total - printed;
    const reprinted = rows.filter((row) => row.action === "REPRINT").length;
    return { total, printed, failed, reprinted };
  }, [rows]);

  const activeFilterCount =
    (keyword.trim() === "" ? 0 : 1) +
    (actionFilter === "" ? 0 : 1) +
    (resultFilter === "" ? 0 : 1) +
    (printerFilter === "" ? 0 : 1);

  // Bộ lọc hiện khi đang xem Bảng, hoặc khi người dùng chủ động bung ở Lát cắt.
  const filtersVisible = view === "table" || sliceFilters;

  const resetFilters = () => {
    period.setPreset("this-month");
    setKeyword("");
    setActionFilter("");
    setResultFilter("");
    setPrinterFilter("");
    pagination.reset();
  };

  const switchView = (next: "table" | "snapshot") => {
    setView(next);
    if (next === "snapshot") setSliceFilters(false);
  };

  const { refreshing, refresh } = useReportRefresh({
    refetch: () => report.refetch(),
    readError: () => report.error,
  });

  const exportFilters = {
    from_date: period.from,
    to_date: period.to,
    ...(resultFilter ? { status: resultFilter } : {}),
    ...(printerFilter ? { printer_id: printerFilter } : {}),
    ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
  };

  const columns = [
    {
      key: "attemptedAt",
      header: "Thời điểm",
      width: 158,
      sortAccessor: (row: PackingLabelEvent) => row.attemptedAt,
      render: (row: PackingLabelEvent) =>
        row.attemptedAt ? formatDateTime(row.attemptedAt) : EMPTY_TEXT,
    },
    {
      key: "action",
      header: "Thao tác",
      width: 104,
      sortAccessor: (row: PackingLabelEvent) => row.action,
      render: (row: PackingLabelEvent) => ACTION_LABELS[row.action],
    },
    {
      key: "result",
      header: "Kết quả",
      width: 150,
      render: (row: PackingLabelEvent) => <ResultBadge value={row.result} />,
    },
    {
      key: "label",
      header: "Nhãn / Bản lưu",
      width: 200,
      sortAccessor: (row: PackingLabelEvent) => row.labelCode,
      render: (row: PackingLabelEvent) => (
        <CellStack
          title={orEmpty(row.labelCode)}
          note={<CopyableId value={row.labelId} />}
        />
      ),
    },
    {
      key: "outbound",
      header: "Phiếu xuất",
      width: 190,
      sortAccessor: (row: PackingLabelEvent) => row.outboundNo,
      render: (row: PackingLabelEvent) => (
        <CellStack
          title={orEmpty(row.outboundNo)}
          note={orEmpty(row.recipient)}
        />
      ),
    },
    {
      key: "printer",
      header: "Máy in",
      hideOnMobile: true,
      render: (row: PackingLabelEvent) => orEmpty(row.printerName),
    },
    {
      key: "actor",
      header: "Người thao tác",
      hideOnMobile: true,
      render: (row: PackingLabelEvent) => orEmpty(row.actorName),
    },
    {
      key: "reason",
      header: "Lỗi / lý do",
      hideOnMobile: true,
      render: (row: PackingLabelEvent) => (
        <CellStack
          title={orEmpty(row.errorCode)}
          note={orEmpty(row.reasonCode || row.reasonNote)}
        />
      ),
    },
    {
      key: "audit",
      header: "Audit",
      width: 140,
      render: (row: PackingLabelEvent) => <AuditBadge event={row} />,
    },
  ];

  return (
    <Box
      data-testid="rpt-tab-packing-label"
      sx={{
        width: "100%",
        minWidth: 0,
        display: "grid",
        gap: { xs: 1.75, md: 2.25 },
        "& > *": { minWidth: 0 },
      }}
    >
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <Box component="section" aria-labelledby="rpt-05-title">
        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 3,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                mb: 0.5,
                color: S.primaryDark,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Báo cáo · Audit workspace
            </Box>
            <Box
              component="h1"
              id="rpt-05-title"
              sx={{
                m: 0,
                fontSize: { xs: 21, md: 24 },
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
                fontWeight: 700,
                color: S.textStrong,
              }}
            >
              Trung tâm kiểm soát in nhãn
            </Box>
            <Box
              sx={{
                maxWidth: 720,
                mt: 0.875,
                color: S.textMedium,
                fontSize: 13,
              }}
            >
              Theo dõi Print và In lại theo event audit, đối soát trực tiếp với
              bản lưu nhãn bất biến.
            </Box>
          </Box>
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              textAlign: "right",
              whiteSpace: "nowrap",
            }}
          >
            <UiStatusBadge size="small" tone="info" label="Chỉ đọc · audit" />
            <Box sx={{ mt: 0.875, color: S.textMedium, fontSize: 12 }}>
              {`Kỳ đang xem: ${period.label}`}
            </Box>
          </Box>
        </Box>
        <Stack
          direction="row"
          spacing={1.125}
          sx={{
            ...SURFACE_SX,
            alignItems: { xs: "flex-start", md: "center" },
            mt: 2,
            px: 2,
            py: 1.25,
            color: S.textMedium,
            fontSize: 12,
          }}
        >
          <UiStatusBadge
            size="small"
            tone="info"
            label="Chỉ đọc · không gửi lệnh in"
          />
          <Box>
            Màn hình này chỉ đọc nhật ký in nhãn và bản lưu bất biến. Lệnh Print
            / In lại được thực hiện ở phiếu xuất kho, không phát sinh từ đây và
            không tác động tồn kho.
          </Box>
        </Stack>
      </Box>

      {/* ── Bộ lọc ────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-labelledby="rpt-05-filter-heading"
        sx={{ ...SURFACE_SX, px: { xs: 2.25, md: 3 }, py: 2.5 }}
      >
        <SectionHead
          id="rpt-05-filter-heading"
          title="Tìm và khoanh vùng event"
          description="Bộ lọc áp dụng đồng thời cho tổng quan, Bảng và Lát cắt."
          sx={{ mb: 2.25 }}
          actions={
            <>
              {activeFilterCount > 0 ? (
                <UiStatusBadge
                  size="small"
                  tone="primary"
                  label={`${activeFilterCount} đang lọc`}
                />
              ) : null}
              <UiButton
                appearance={advanced ? "tonal" : "outlined"}
                startIcon={<FilterOutlined />}
                aria-expanded={advanced}
                aria-controls="rpt-05-advanced-filters"
                onClick={() => setAdvanced((current) => !current)}
              >
                {advanced ? "Thu gọn bộ lọc" : "Bộ lọc chi tiết"}
              </UiButton>
              <UiButton
                appearance="outlined"
                startIcon={<ReloadOutlined />}
                onClick={resetFilters}
              >
                Đặt lại
              </UiButton>
              <UiButton
                appearance="tonal"
                startIcon={<ReloadOutlined />}
                loading={refreshing}
                disabled={report.fetching}
                onClick={refresh}
              >
                Làm mới
              </UiButton>
            </>
          }
        />

        <Box
          id="rpt-05-filter-fields"
          hidden={!filtersVisible}
          sx={{
            display: filtersVisible ? "grid" : "none",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(12, minmax(0, 1fr))",
            },
            columnGap: 1.5,
            rowGap: 1.75,
            alignItems: "end",
          }}
        >
          <FilterField label="Tìm kiếm" htmlFor="rpt-05-q" span={5}>
            <SearchInput
              id="rpt-05-q"
              width="100%"
              value={keyword}
              placeholder="Phiếu xuất, mã nhãn hoặc mã bản lưu"
              aria-label="Tìm phiếu xuất, mã nhãn hoặc mã bản lưu"
              onChange={(value) => {
                setKeyword(value);
                pagination.reset();
              }}
            />
          </FilterField>
          <FilterField label="Kỳ báo cáo" span={2}>
            <UiSelect
              aria-label="Kỳ báo cáo"
              fullWidth
              value={period.preset}
              onChange={(value) => period.setPreset(value as PeriodPreset)}
              options={periodPresetOptions(t)}
            />
          </FilterField>
          <FilterField label="Khoảng thời gian" span={5} tabletSpan={2}>
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
        </Box>

        <Box
          id="rpt-05-advanced-filters"
          hidden={!advanced || !filtersVisible}
          sx={{
            display: advanced && filtersVisible ? "grid" : "none",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(12, minmax(0, 1fr))",
            },
            columnGap: 1.5,
            rowGap: 1.75,
            mt: 2,
            pt: 2,
            borderTop: `1px dashed ${S.border}`,
          }}
        >
          <FilterField label="Thao tác">
            <UiSelect
              aria-label="Lọc theo thao tác"
              fullWidth
              placeholder="Tất cả thao tác"
              value={actionFilter}
              onChange={(value) => {
                setActionFilter(value);
                pagination.reset();
              }}
              options={PACKING_LABEL_ACTIONS.map((value) => ({
                value,
                label: ACTION_LABELS[value],
              }))}
            />
          </FilterField>
          <FilterField label="Kết quả">
            <UiSelect
              aria-label="Lọc theo kết quả"
              fullWidth
              placeholder="Tất cả kết quả"
              value={resultFilter}
              onChange={(value) => {
                setResultFilter(value);
                pagination.reset();
              }}
              options={PACKING_LABEL_RESULTS.map((value) => ({
                value,
                label: RESULT_LABELS[value],
              }))}
            />
          </FilterField>
          <FilterField label="Máy in">
            <UiSelect
              aria-label="Lọc theo máy in"
              fullWidth
              placeholder="Tất cả máy in"
              value={printerFilter}
              onChange={(value) => {
                setPrinterFilter(value);
                pagination.reset();
              }}
              options={report.printerOptions}
            />
          </FilterField>
        </Box>

        <Box
          hidden={filtersVisible}
          sx={{
            display: filtersVisible ? "none" : "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            flexDirection: { xs: "column", md: "row" },
            gap: 1.5,
            px: 1.5,
            py: 1.25,
            border: `1px dashed ${S.border}`,
            borderRadius: `${RADIUS.control}px`,
            bgcolor: S.bgCanvas,
            color: S.textMedium,
            fontSize: 12,
          }}
        >
          <Box component="span">{`Bộ lọc đang áp dụng: ${period.label}`}</Box>
          <UiButton
            appearance="outlined"
            aria-controls="rpt-05-filter-fields"
            onClick={() => setSliceFilters(true)}
          >
            Hiện bộ lọc
          </UiButton>
        </Box>
      </Box>

      {period.invalid ? (
        <UiAlert tone="error">Từ ngày không thể sau đến ngày.</UiAlert>
      ) : null}

      {report.error ? (
        <ApiErrorAlert
          error={report.error}
          title="Không tải được nhật ký nhãn đóng gói"
          onRetry={report.refetch}
        />
      ) : null}

      {report.eventsError ? (
        <UiAlert tone="warning" title="Chưa đọc được nhật ký từng lần in">
          {`Danh sách event lấy từ /label-print-events (quyền label.print). Không đọc được nguồn này nên bảng và lát cắt đang trống dù kỳ ${period.label} vẫn có nhãn.`}
        </UiAlert>
      ) : null}

      {report.capped ? (
        <UiAlert tone="info">
          {`Đã đọc tới trần ${formatQuantity(LABEL_EVENT_LIMIT)} lần in gần nhất — các lần in cũ hơn chưa nằm trong bảng này.`}
        </UiAlert>
      ) : null}

      {exporter.exportDenied ? (
        <Box role="alert">
          <UiAlert
            tone="error"
            title="Không đủ quyền xuất báo cáo"
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      {/* ── Tổng quan ─────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Tổng quan vận hành in nhãn"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 1.75,
        }}
      >
        <MetricCard
          label="Tổng lượt in"
          value={formatQuantity(metrics.total)}
          hint="Print và In lại theo bộ lọc"
          metaLabel="Tổng event trong kỳ"
          metaValue="100%"
          progress={100}
          tone="primary"
          icon={<PrinterOutlined />}
        />
        <MetricCard
          label="In thành công"
          value={formatQuantity(metrics.printed)}
          hint="Event trả kết quả Printed"
          metaLabel="Tỷ lệ hoàn tất"
          metaValue={`${ratio(metrics.printed, metrics.total)}%`}
          progress={ratio(metrics.printed, metrics.total)}
          tone="success"
          icon={<CheckCircleOutlined />}
        />
        <MetricCard
          label="In lỗi"
          value={formatQuantity(metrics.failed)}
          hint="Gồm cả lần còn chờ máy in phản hồi"
          metaLabel="Tỷ lệ cần xử lý"
          metaValue={`${ratio(metrics.failed, metrics.total)}%`}
          progress={ratio(metrics.failed, metrics.total)}
          tone="error"
          icon={<WarningOutlined />}
        />
        <MetricCard
          label="Lượt In lại"
          value={formatQuantity(metrics.reprinted)}
          hint="Lần in thành công thứ hai trở đi của một nhãn"
          metaLabel="Tỷ trọng In lại"
          metaValue={`${ratio(metrics.reprinted, metrics.total)}%`}
          progress={ratio(metrics.reprinted, metrics.total)}
          tone="warning"
          icon={<UndoOutlined />}
        />
      </Box>

      {/* ── Lịch sử Print / Reprint ───────────────────────────────────── */}
      <Box
        component="section"
        aria-labelledby="rpt-05-history-heading"
        sx={{ ...SURFACE_SX, overflow: "hidden" }}
      >
        <SectionHead
          id="rpt-05-history-heading"
          title="Lịch sử Print / Reprint"
          description={
            report.asOf
              ? `Dữ liệu chốt tại ${formatDateTime(report.asOf)} · một dòng là một event audit.`
              : "Một dòng là một event audit của đúng một lần Print / In lại."
          }
          sx={{ px: { xs: 2.25, md: 3 }, pt: 2.75, pb: 2 }}
          actions={
            <>
              <UiStatusBadge
                size="small"
                tone="info"
                label={`${formatQuantity(rows.length)} event`}
              />
              <ExportButtons
                exporting={exporter.exporting}
                disabled={period.invalid || report.loading}
                onExport={(format) =>
                  void exporter.exportReport(format, {
                    reportCode: "label-log",
                    fileStem: "packing-label-log",
                    fileSuffix: `-${period.from}-${period.to}`,
                    filters: exportFilters,
                  })
                }
              />
            </>
          }
        />

        <Stack
          direction="row"
          spacing={1}
          role="tablist"
          aria-label="Chế độ xem event"
          sx={{
            px: { xs: 2.25, md: 3 },
            pb: 1.75,
            borderBottom: `1px solid ${S.border}`,
          }}
        >
          {(
            [
              {
                value: "table",
                label: "Bảng",
                icon: <UnorderedListOutlined />,
              },
              {
                value: "snapshot",
                label: "Lát cắt",
                icon: <AppstoreOutlined />,
              },
            ] as const
          ).map((tab) => {
            const active = view === tab.value;
            return (
              <UiButton
                key={tab.value}
                id={`rpt-05-${tab.value}-tab`}
                role="tab"
                appearance={active ? "tonal" : "text"}
                startIcon={tab.icon}
                aria-selected={active}
                aria-controls={`rpt-05-${tab.value}-panel`}
                tabIndex={active ? 0 : -1}
                sx={{ color: active ? undefined : S.textMedium }}
                onClick={() => switchView(tab.value)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                    return;
                  }
                  event.preventDefault();
                  switchView(view === "table" ? "snapshot" : "table");
                }}
              >
                {tab.label}
              </UiButton>
            );
          })}
        </Stack>

        <Box sx={{ px: { xs: 1.75, md: 2.5 }, pt: 2.25 }}>
          <Box
            id="rpt-05-table-panel"
            role="tabpanel"
            aria-labelledby="rpt-05-table-tab"
            hidden={view !== "table"}
          >
            {view === "table" ? (
              <ResponsiveDataTable<PackingLabelEvent>
                columns={columns}
                rows={pagination.pageRows}
                rowKey={(row) => row.eventId}
                loading={report.loading}
                onRowClick={(row) => setOpenLabelId(row.labelId)}
                emptyText="Không có event Print / Reprint khớp bộ lọc."
                // Nhật ký in một kỳ có thể rất dài: cuộn trong khung và ghim
                // tiêu đề cột thay vì kéo trang thành một dải rất dài.
                maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
                renderRowActions={(row) => (
                  <UiButton
                    appearance="tonal"
                    size="small"
                    startIcon={<AuditOutlined />}
                    onClick={() => setOpenLabelId(row.labelId)}
                  >
                    Xem audit
                  </UiButton>
                )}
              />
            ) : null}
          </Box>

          <Box
            id="rpt-05-snapshot-panel"
            role="tabpanel"
            aria-labelledby="rpt-05-snapshot-tab"
            hidden={view !== "snapshot"}
          >
            {view === "snapshot" ? (
              report.loading ? (
                <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
                  <UiSpinner label="Đang tải lát cắt event…" />
                </Box>
              ) : pagination.pageRows.length === 0 ? (
                <Box sx={{ py: 6, textAlign: "center", color: S.textMedium }}>
                  Không có event khớp bộ lọc.
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
                    gap: 1.75,
                  }}
                >
                  {pagination.pageRows.map((row) => (
                    <Box
                      key={row.eventId}
                      component="article"
                      sx={{
                        ...SURFACE_SX,
                        p: 2,
                        display: "grid",
                        gap: 1.75,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              fontWeight: 700,
                              color: S.textStrong,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {orEmpty(row.labelCode)}
                          </Box>
                          <Box
                            sx={{
                              mt: 0.5,
                              color: S.textMedium,
                              fontSize: 11.5,
                            }}
                          >
                            {`${orEmpty(row.outboundNo)} · ${row.attemptedAt ? formatDateTime(row.attemptedAt) : EMPTY_TEXT}`}
                          </Box>
                        </Box>
                        <ResultBadge value={row.result} />
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 1.5,
                          pt: 1.75,
                          borderTop: `1px solid ${S.border}`,
                        }}
                      >
                        {[
                          {
                            label: "Thao tác",
                            value: ACTION_LABELS[row.action],
                          },
                          {
                            label: "Máy in",
                            value: orEmpty(row.printerName),
                          },
                          {
                            label: "Người thao tác",
                            value: orEmpty(row.actorName),
                          },
                          {
                            label: "Lỗi / lý do",
                            value: orEmpty(
                              row.errorCode || row.reasonCode || row.reasonNote,
                            ),
                          },
                        ].map((item) => (
                          <Box key={item.label} sx={{ minWidth: 0 }}>
                            <Box sx={{ color: S.textMedium, fontSize: 11 }}>
                              {item.label}
                            </Box>
                            <Box
                              sx={{
                                mt: 0.375,
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: S.textStrong,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {item.value}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1.5,
                        }}
                      >
                        <AuditBadge event={row} />
                        <UiButton
                          appearance="tonal"
                          size="small"
                          startIcon={<AuditOutlined />}
                          onClick={() => setOpenLabelId(row.labelId)}
                        >
                          Xem audit
                        </UiButton>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )
            ) : null}
          </Box>

          <ReportPaginationBar
            page={pagination.page}
            perPage={pagination.perPage}
            total={pagination.total}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPerPage}
          />

          <Stack
            direction="row"
            spacing={1.125}
            sx={{
              alignItems: "flex-start",
              px: 0.5,
              pt: 1.75,
              pb: 2,
              color: S.textMedium,
              fontSize: 12,
            }}
          >
            <Box component="span" sx={{ color: S.info, mt: "1px" }}>
              <AuditOutlined />
            </Box>
            <Box>
              <Box component="b" sx={{ color: S.textStrong }}>
                Cách đọc:{" "}
              </Box>
              Bảng và Lát cắt dùng cùng một tập event. Kỳ báo cáo lọc theo nhãn
              tạo trong kỳ (hợp đồng RPT-LABEL-01) nên file xuất ra khớp đúng
              tập dòng đang xem. In lại là lần in thành công thứ hai trở đi của
              cùng một nhãn; thử lại sau lỗi vẫn tính là Print. Mở một dòng để
              đối soát bản lưu bất biến và lịch sử attempt của đúng nhãn đó.
            </Box>
          </Stack>
        </Box>
      </Box>

      {openLabelId ? (
        <DrillDownDialog
          title="Audit nhãn đóng gói"
          subtitle="Đối soát từ bản lưu bất biến và log sự kiện."
          onClose={() => setOpenLabelId(null)}
        >
          {snapshot.loading ? (
            <Box sx={{ py: 5, display: "grid", placeItems: "center" }}>
              <UiSpinner label="Đang tải bản lưu nhãn…" />
            </Box>
          ) : snapshot.error ? (
            <ApiErrorAlert
              error={snapshot.error}
              title="Không đọc được bản lưu nhãn"
              onRetry={snapshot.refetch}
            />
          ) : snapshot.detail ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              {snapshot.detail.attempts.some(
                (attempt) => !attempt.auditComplete,
              ) ? (
                <UiAlert tone="warning">
                  Nhật ký của nhãn này còn lần in thiếu dấu vết audit (máy in,
                  người thao tác hoặc kết quả). Không suy diễn lần in thiếu từ
                  dữ liệu hiện hành.
                </UiAlert>
              ) : null}

              <Box
                component="section"
                sx={{
                  p: 2,
                  border: `1px solid ${S.border}`,
                  borderRadius: `${RADIUS.card}px`,
                }}
              >
                <Box
                  component="h3"
                  sx={{
                    m: 0,
                    mb: 1.5,
                    fontSize: 14,
                    fontWeight: 700,
                    color: S.textStrong,
                  }}
                >
                  Bản lưu bất biến
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 1.25,
                  }}
                >
                  <DetailCell
                    label="Mã nhãn"
                    value={orEmpty(snapshot.detail.labelCode)}
                  />
                  <DetailCell
                    label="Phiếu xuất"
                    value={orEmpty(snapshot.detail.outboundNo)}
                  />
                  <DetailCell
                    label="Mã bản lưu"
                    value={<CopyableId value={snapshot.detail.labelId} />}
                  />
                  <DetailCell
                    label="Phiên bản"
                    value={orEmpty(snapshot.detail.version)}
                  />
                  <DetailCell
                    label="Người nhận"
                    value={orEmpty(snapshot.detail.recipient)}
                  />
                  <DetailCell
                    label="Hoàn tất xuất kho"
                    value={
                      snapshot.detail.appliedAt
                        ? formatDateTime(snapshot.detail.appliedAt)
                        : EMPTY_TEXT
                    }
                  />
                  <DetailCell
                    label="Trạng thái bản lưu"
                    value={orEmpty(snapshot.detail.status)}
                  />
                  <DetailCell
                    label="Nội dung nhãn"
                    value={orEmpty(snapshot.detail.content)}
                  />
                </Box>
              </Box>

              <Box
                component="section"
                sx={{
                  p: 2,
                  border: `1px solid ${S.border}`,
                  borderRadius: `${RADIUS.card}px`,
                }}
              >
                <Box
                  component="h3"
                  sx={{
                    m: 0,
                    mb: 1.5,
                    fontSize: 14,
                    fontWeight: 700,
                    color: S.textStrong,
                  }}
                >
                  Lịch sử attempt của nhãn
                </Box>
                <ResponsiveDataTable<PackingLabelEvent>
                  columns={[
                    {
                      key: "attemptedAt",
                      header: "Thời điểm",
                      render: (row) =>
                        row.attemptedAt
                          ? formatDateTime(row.attemptedAt)
                          : EMPTY_TEXT,
                    },
                    {
                      key: "action",
                      header: "Thao tác",
                      render: (row) => ACTION_LABELS[row.action],
                    },
                    {
                      key: "result",
                      header: "Kết quả",
                      render: (row) => <ResultBadge value={row.result} />,
                    },
                    {
                      key: "printer",
                      header: "Máy in",
                      render: (row) => orEmpty(row.printerName),
                    },
                    {
                      key: "reason",
                      header: "Lỗi / lý do",
                      render: (row) =>
                        orEmpty(
                          row.errorCode || row.reasonCode || row.reasonNote,
                        ),
                    },
                  ]}
                  rows={snapshot.detail.attempts}
                  rowKey={(row) => row.eventId}
                  emptyText="Nhãn này chưa có lần in nào được ghi nhận."
                />
              </Box>

              <Box sx={{ fontSize: 12, color: S.textMedium }}>
                {snapshot.detail.outboundDate
                  ? `Ngày phiếu xuất: ${formatDate(snapshot.detail.outboundDate)}.`
                  : null}{" "}
                Bản lưu được tạo lúc{" "}
                {snapshot.detail.createdAt
                  ? formatDateTime(snapshot.detail.createdAt)
                  : EMPTY_TEXT}
                .
              </Box>
            </Box>
          ) : (
            <UiAlert tone="info">
              Không tìm thấy bản lưu của nhãn này trong kỳ đang xem.
            </UiAlert>
          )}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
