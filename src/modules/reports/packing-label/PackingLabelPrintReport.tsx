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
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { EMPTY_TEXT, orEmpty } from "@/shared/constants/display";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { usePeriodFilter } from "../operations/report-period";
import { reportRangePresets } from "../operations/report-range-presets";
import { RPT_SCROLL_MAX_HEIGHT } from "../operations/report-tokens";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { ExportButtons } from "../operations/report-filters";
import { useReportExport } from "../operations/report-export";
import { useClientPagination } from "../operations/report-columns";
import { ReportPaginationBar } from "../operations/report-table";
import { SectionFilterBar } from "../operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "../operations/report-section-filter";
import { DrillDownDialog } from "../operations/report-ui";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
 * Chuỗi hiển thị đã chuyển về `messages.ts` (nhánh `reports.packingLabel.*`)
 * theo yêu cầu i18n 100% (2026-09-03); bản VI giữ nguyên từng ký tự so với
 * mockup nên vẫn đối chiếu được từng dòng chữ khi nghiệm thu.
 *
 * Toàn bộ số liệu đến từ `usePackingLabelReport()` — không có ô nào cứng, không
 * có nút nào không dẫn tới hành động thật.
 */

const resultLabels = (
  t: TranslateFn,
): Readonly<Record<PackingLabelResult, string>> => ({
  PRINTED: t("reports.packingLabel.resultPrinted"),
  PRINT_FAILED: t("reports.packingLabel.outcomeFailed"),
  PENDING_PRINT: t("reports.packingLabel.resultPending"),
});

const RESULT_TONES: Readonly<
  Record<PackingLabelResult, "success" | "error" | "warning">
> = {
  PRINTED: "success",
  PRINT_FAILED: "error",
  PENDING_PRINT: "warning",
};

const actionLabels = (
  t: TranslateFn,
): Readonly<Record<PackingLabelAction, string>> => ({
  PRINT: t("reports.packingLabel.actionPrint"),
  REPRINT: t("reports.packingLabel.outcomeReprint"),
});

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
  const t = useT();
  return (
    <UiStatusBadge
      size="small"
      tone={RESULT_TONES[value]}
      label={resultLabels(t)[value]}
    />
  );
}

function AuditBadge({ event }: { event: PackingLabelEvent }) {
  const t = useT();
  return (
    <UiStatusBadge
      size="small"
      tone={event.auditComplete ? "success" : "warning"}
      label={
        event.auditComplete
          ? t("reports.packingLabel.auditOk")
          : t("reports.packingLabel.auditIncomplete")
      }
      title={
        event.auditComplete
          ? t("reports.packingLabel.auditOkTitle")
          : t("reports.packingLabel.auditMissingTitle", {
              list: event.auditMissing.join(", "),
            })
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
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const exporter = useReportExport();
  const resultLabelMap = useMemo(() => resultLabels(t), [t]);
  const actionLabelMap = useMemo(() => actionLabels(t), [t]);

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

  /**
   * Bộ lọc RIÊNG của khối nhật ký. Nằm SAU khi 4 thẻ KPI đã tính trên rows:
   * soi một máy in hay một nhãn không được kéo tụt luôn tỉ lệ in lại của kỳ.
   */
  const historyFilterConfig = useMemo<SectionFilterConfig<PackingLabelEvent>>(
    () => ({
      searchPlaceholder: t("reports.packingLabel.historySearchPlaceholder"),
      searchText: (row) => [
        row.labelCode,
        row.outboundNo,
        row.recipient,
        row.actorName,
        row.printerName,
        row.errorCode,
      ],
      selects: [
        {
          key: "action",
          placeholder: t("reports.packingLabel.anyAction"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.action,
              (value) => actionLabelMap[value as PackingLabelAction] ?? value,
            ),
          match: (row, value) => row.action === value,
          minWidth: 160,
        },
        {
          key: "result",
          placeholder: t("reports.packingLabel.anyResult"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.result,
              (value) => resultLabelMap[value as PackingLabelResult] ?? value,
            ),
          match: (row, value) => row.result === value,
          minWidth: 175,
        },
        {
          key: "printer",
          placeholder: t("reports.packingLabel.anyPrinter"),
          options: (list) => optionsFromRows(list, (row) => row.printerName),
          match: (row, value) => row.printerName === value,
          minWidth: 165,
        },
      ],
    }),
    [t, actionLabelMap, resultLabelMap],
  );
  const historyFilter = useSectionFilter(rows, historyFilterConfig);
  const pagination = useClientPagination(historyFilter.rows, 15);

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
      key: "stt",
      header: t("shared.table.rowNumber"),
      align: "center" as const,
      width: 56,
      render: (row: PackingLabelEvent) =>
        mvpRowNumber(
          pagination.page,
          pagination.perPage,
          pagination.pageRows.indexOf(row),
        ),
    },
    {
      key: "attemptedAt",
      header: t("reports.packingLabel.colMoment"),
      width: 158,
      sortAccessor: (row: PackingLabelEvent) => row.attemptedAt,
      render: (row: PackingLabelEvent) =>
        row.attemptedAt ? formatDateTime(row.attemptedAt) : EMPTY_TEXT,
    },
    {
      key: "action",
      header: t("reports.packingLabel.colAction"),
      width: 104,
      sortAccessor: (row: PackingLabelEvent) => row.action,
      render: (row: PackingLabelEvent) => actionLabelMap[row.action],
    },
    {
      key: "result",
      header: t("reports.packingLabel.colResult"),
      width: 150,
      render: (row: PackingLabelEvent) => <ResultBadge value={row.result} />,
    },
    {
      key: "label",
      header: t("reports.packingLabel.colLabelSnapshot"),
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
      header: t("reports.packingLabel.colOutbound"),
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
      header: t("reports.packingLabel.colPrinter"),
      hideOnMobile: true,
      render: (row: PackingLabelEvent) => orEmpty(row.printerName),
    },
    {
      key: "actor",
      header: t("reports.packingLabel.colActor"),
      hideOnMobile: true,
      render: (row: PackingLabelEvent) => orEmpty(row.actorName),
    },
    {
      key: "reason",
      header: t("reports.packingLabel.colErrorReason"),
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
      header: t("reports.packingLabel.colAudit"),
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
              {t("reports.packingLabel.heroKicker")}
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
              {t("reports.packingLabel.heroTitle")}
            </Box>
            <Box
              sx={{
                maxWidth: 720,
                mt: 0.875,
                color: S.textMedium,
                fontSize: 13,
              }}
            >
              {t("reports.packingLabel.heroDescription")}
            </Box>
          </Box>
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              textAlign: "right",
              whiteSpace: "nowrap",
            }}
          >
            <UiStatusBadge
              size="small"
              tone="info"
              label={t("reports.packingLabel.badgeReadOnly")}
            />
            <Box sx={{ mt: 0.875, color: S.textMedium, fontSize: 12 }}>
              {t("reports.period.viewing", { label: period.label })}
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
            label={t("reports.packingLabel.badgeNoPrintCommand")}
          />
          <Box>{t("reports.packingLabel.readOnlyNote")}</Box>
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
          title={t("reports.packingLabel.filterTitle")}
          description={t("reports.packingLabel.filterDescription")}
          sx={{ mb: 2.25 }}
          actions={
            <>
              {activeFilterCount > 0 ? (
                <UiStatusBadge
                  size="small"
                  tone="primary"
                  label={t("reports.packingLabel.filteringCount", {
                    count: activeFilterCount,
                  })}
                />
              ) : null}
              <UiButton
                appearance={advanced ? "tonal" : "outlined"}
                startIcon={<FilterOutlined />}
                aria-expanded={advanced}
                aria-controls="rpt-05-advanced-filters"
                onClick={() => setAdvanced((current) => !current)}
              >
                {advanced
                  ? t("reports.packingLabel.collapseFilters")
                  : t("reports.packingLabel.expandFilters")}
              </UiButton>
              <UiButton
                appearance="outlined"
                startIcon={<ReloadOutlined />}
                onClick={resetFilters}
              >
                {t("reports.packingLabel.reset")}
              </UiButton>
              <UiButton
                appearance="tonal"
                startIcon={<ReloadOutlined />}
                loading={refreshing}
                disabled={report.fetching}
                onClick={refresh}
              >
                {t("reports.packingLabel.refresh")}
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
          <FilterField
            label={t("reports.packingLabel.searchLabel")}
            htmlFor="rpt-05-q"
            span={5}
          >
            <SearchInput
              id="rpt-05-q"
              width="100%"
              value={keyword}
              placeholder={t("reports.packingLabel.qPlaceholder")}
              aria-label={t("reports.packingLabel.qAria")}
              onChange={(value) => {
                setKeyword(value);
                pagination.reset();
              }}
            />
          </FilterField>
          {/*
           * Ô "Kỳ báo cáo" rời đã bỏ: kỳ nhanh nằm trong panel lịch. Hai
           * control cùng ghi một khoảng ngày là chỗ người dùng không biết cái
           * nào thắng — chọn kỳ thì ô ngày bị ghi đè, sửa ô ngày thì ô kỳ lặng
           * lẽ nhảy về "Tùy chọn". Ô ngày nay chiếm luôn phần lưới của cả hai.
           */}
          <FilterField
            label={t("reports.packingLabel.dateRangeLabel")}
            span={7}
            tabletSpan={2}
          >
            <UiVuexyDateRangePicker
              aria-label={t("reports.filters.dateRangeAria")}
              value={period.range}
              format="DD/MM/YYYY"
              placeholder={[
                t("reports.packingLabel.dateFrom"),
                t("reports.packingLabel.dateTo"),
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
          <FilterField label={t("reports.packingLabel.colAction")}>
            <UiSelect
              aria-label={t("reports.packingLabel.actionFilterAria")}
              fullWidth
              placeholder={t("reports.packingLabel.allActions")}
              value={actionFilter}
              onChange={(value) => {
                setActionFilter(value);
                pagination.reset();
              }}
              options={PACKING_LABEL_ACTIONS.map((value) => ({
                value,
                label: actionLabelMap[value],
              }))}
            />
          </FilterField>
          <FilterField label={t("reports.packingLabel.colResult")}>
            <UiSelect
              aria-label={t("reports.packingLabel.resultFilterAria")}
              fullWidth
              placeholder={t("reports.packingLabel.allResults")}
              value={resultFilter}
              onChange={(value) => {
                setResultFilter(value);
                pagination.reset();
              }}
              options={PACKING_LABEL_RESULTS.map((value) => ({
                value,
                label: resultLabelMap[value],
              }))}
            />
          </FilterField>
          <FilterField label={t("reports.packingLabel.colPrinter")}>
            <UiSelect
              aria-label={t("reports.packingLabel.printerFilterAria")}
              fullWidth
              placeholder={t("reports.packingLabel.printerAll")}
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
          <Box component="span">
            {t("reports.packingLabel.filtersApplied", { label: period.label })}
          </Box>
          <UiButton
            appearance="outlined"
            aria-controls="rpt-05-filter-fields"
            onClick={() => setSliceFilters(true)}
          >
            {t("reports.packingLabel.showFilters")}
          </UiButton>
        </Box>
      </Box>

      {period.invalid ? (
        <UiAlert tone="error">
          {t("reports.packingLabel.dateOrderError")}
        </UiAlert>
      ) : null}

      {report.error ? (
        <ApiErrorAlert
          error={report.error}
          title={t("reports.packingLabel.logLoadError")}
          onRetry={report.refetch}
        />
      ) : null}

      {report.eventsError ? (
        <UiAlert
          tone="warning"
          title={t("reports.packingLabel.eventsErrorTitle")}
        >
          {t("reports.packingLabel.eventsErrorBody", { label: period.label })}
        </UiAlert>
      ) : null}

      {report.capped ? (
        <UiAlert tone="info">
          {t("reports.packingLabel.cappedNote", {
            limit: formatQuantity(LABEL_EVENT_LIMIT),
          })}
        </UiAlert>
      ) : null}

      {exporter.exportDenied ? (
        <Box role="alert">
          <UiAlert
            tone="error"
            title={t("reports.packingLabel.exportDeniedTitle")}
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      {/* ── Tổng quan ─────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label={t("reports.packingLabel.kpiAria")}
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
          label={t("reports.packingLabel.kpiTotal")}
          value={formatQuantity(metrics.total)}
          hint={t("reports.packingLabel.kpiTotalHint")}
          metaLabel={t("reports.packingLabel.kpiTotalMeta")}
          metaValue="100%"
          progress={100}
          tone="primary"
          icon={<PrinterOutlined />}
        />
        <MetricCard
          label={t("reports.packingLabel.resultPrinted")}
          value={formatQuantity(metrics.printed)}
          hint={t("reports.packingLabel.kpiPrintedHint")}
          metaLabel={t("reports.packingLabel.kpiPrintedMeta")}
          metaValue={`${ratio(metrics.printed, metrics.total)}%`}
          progress={ratio(metrics.printed, metrics.total)}
          tone="success"
          icon={<CheckCircleOutlined />}
        />
        <MetricCard
          label={t("reports.packingLabel.outcomeFailed")}
          value={formatQuantity(metrics.failed)}
          hint={t("reports.packingLabel.kpiFailedHint")}
          metaLabel={t("reports.packingLabel.kpiFailedMeta")}
          metaValue={`${ratio(metrics.failed, metrics.total)}%`}
          progress={ratio(metrics.failed, metrics.total)}
          tone="error"
          icon={<WarningOutlined />}
        />
        <MetricCard
          label={t("reports.packingLabel.kpiReprint")}
          value={formatQuantity(metrics.reprinted)}
          hint={t("reports.packingLabel.kpiReprintHint")}
          metaLabel={t("reports.packingLabel.kpiReprintMeta")}
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
          title={t("reports.packingLabel.sectionHistoryTitle")}
          description={
            report.asOf
              ? t("reports.packingLabel.historyAsOf", {
                  time: formatDateTime(report.asOf),
                })
              : t("reports.packingLabel.historyDescription")
          }
          sx={{ px: { xs: 2.25, md: 3 }, pt: 2.75, pb: 2 }}
          actions={
            <>
              <UiStatusBadge
                size="small"
                tone="info"
                label={t("reports.packingLabel.eventCount", {
                  count: formatQuantity(rows.length),
                })}
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
          aria-label={t("reports.packingLabel.viewTablistAria")}
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
                label: t("reports.packingLabel.viewTable"),
                icon: <UnorderedListOutlined />,
              },
              {
                value: "snapshot",
                label: t("reports.packingLabel.viewSnapshot"),
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
          <SectionFilterBar
            state={historyFilter}
            label={t("reports.packingLabel.sectionHistoryTitle")}
            unit={t("reports.packingLabel.historyUnit")}
            data-testid="rpt-05-history-section-filter"
          />
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
                emptyText={t("reports.packingLabel.tableEmpty")}
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
                    {t("reports.packingLabel.viewAudit")}
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
                  <UiSpinner
                    label={t("reports.packingLabel.snapshotLoading")}
                  />
                </Box>
              ) : pagination.pageRows.length === 0 ? (
                <Box sx={{ py: 6, textAlign: "center", color: S.textMedium }}>
                  {t("reports.packingLabel.snapshotEmpty")}
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
                  {pagination.pageRows.map((row, index) => (
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
                            {mvpRowNumber(
                              pagination.page,
                              pagination.perPage,
                              index,
                            )}
                            . {orEmpty(row.labelCode)}
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
                            label: t("reports.packingLabel.colAction"),
                            value: actionLabelMap[row.action],
                          },
                          {
                            label: t("reports.packingLabel.colPrinter"),
                            value: orEmpty(row.printerName),
                          },
                          {
                            label: t("reports.packingLabel.colActor"),
                            value: orEmpty(row.actorName),
                          },
                          {
                            label: t("reports.packingLabel.colErrorReason"),
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
                          {t("reports.packingLabel.viewAudit")}
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
                {t("reports.packingLabel.howToReadLabel")}{" "}
              </Box>
              {t("reports.packingLabel.howToReadBody")}
            </Box>
          </Stack>
        </Box>
      </Box>

      {openLabelId ? (
        <DrillDownDialog
          title={t("reports.packingLabel.dialogTitle")}
          subtitle={t("reports.packingLabel.dialogSubtitle")}
          onClose={() => setOpenLabelId(null)}
        >
          {snapshot.loading ? (
            <Box sx={{ py: 5, display: "grid", placeItems: "center" }}>
              <UiSpinner
                label={t("reports.packingLabel.snapshotDetailLoading")}
              />
            </Box>
          ) : snapshot.error ? (
            <ApiErrorAlert
              error={snapshot.error}
              title={t("reports.packingLabel.snapshotError")}
              onRetry={snapshot.refetch}
            />
          ) : snapshot.detail ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              {snapshot.detail.attempts.some(
                (attempt) => !attempt.auditComplete,
              ) ? (
                <UiAlert tone="warning">
                  {t("reports.packingLabel.attemptsAuditWarning")}
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
                  {t("reports.packingLabel.immutableTitle")}
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
                    label={t("reports.packingLabel.fieldLabelCode")}
                    value={orEmpty(snapshot.detail.labelCode)}
                  />
                  <DetailCell
                    label={t("reports.packingLabel.colOutbound")}
                    value={orEmpty(snapshot.detail.outboundNo)}
                  />
                  <DetailCell
                    label={t("reports.packingLabel.fieldSnapshotId")}
                    value={<CopyableId value={snapshot.detail.labelId} />}
                  />
                  <DetailCell
                    label={t("reports.packingLabel.fieldVersion")}
                    value={orEmpty(snapshot.detail.version)}
                  />
                  <DetailCell
                    label={t("reports.packingLabel.fieldRecipient")}
                    value={orEmpty(snapshot.detail.recipient)}
                  />
                  <DetailCell
                    label={t("reports.packingLabel.fieldAppliedAt")}
                    value={
                      snapshot.detail.appliedAt
                        ? formatDateTime(snapshot.detail.appliedAt)
                        : EMPTY_TEXT
                    }
                  />
                  <DetailCell
                    label={t("reports.packingLabel.fieldSnapshotStatus")}
                    value={orEmpty(snapshot.detail.status)}
                  />
                  <DetailCell
                    label={t("reports.packingLabel.fieldContent")}
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
                  {t("reports.packingLabel.attemptsTitle")}
                </Box>
                <ResponsiveDataTable<PackingLabelEvent>
                  columns={[
                    {
                      key: "stt",
                      header: t("shared.table.rowNumber"),
                      align: "center",
                      width: 56,
                      render: (row) =>
                        snapshot.detail!.attempts.indexOf(row) + 1,
                    },
                    {
                      key: "attemptedAt",
                      header: t("reports.packingLabel.colMoment"),
                      render: (row) =>
                        row.attemptedAt
                          ? formatDateTime(row.attemptedAt)
                          : EMPTY_TEXT,
                    },
                    {
                      key: "action",
                      header: t("reports.packingLabel.colAction"),
                      render: (row) => actionLabelMap[row.action],
                    },
                    {
                      key: "result",
                      header: t("reports.packingLabel.colResult"),
                      render: (row) => <ResultBadge value={row.result} />,
                    },
                    {
                      key: "printer",
                      header: t("reports.packingLabel.colPrinter"),
                      render: (row) => orEmpty(row.printerName),
                    },
                    {
                      key: "reason",
                      header: t("reports.packingLabel.colErrorReason"),
                      render: (row) =>
                        orEmpty(
                          row.errorCode || row.reasonCode || row.reasonNote,
                        ),
                    },
                  ]}
                  rows={snapshot.detail.attempts}
                  rowKey={(row) => row.eventId}
                  emptyText={t("reports.packingLabel.attemptsEmpty")}
                />
              </Box>

              <Box sx={{ fontSize: 12, color: S.textMedium }}>
                {snapshot.detail.outboundDate
                  ? t("reports.packingLabel.outboundDateLine", {
                      date: formatDate(snapshot.detail.outboundDate),
                    })
                  : null}{" "}
                {t("reports.packingLabel.createdAtLine", {
                  time: snapshot.detail.createdAt
                    ? formatDateTime(snapshot.detail.createdAt)
                    : EMPTY_TEXT,
                })}
              </Box>
            </Box>
          ) : (
            <UiAlert tone="info">
              {t("reports.packingLabel.snapshotMissing")}
            </UiAlert>
          )}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
