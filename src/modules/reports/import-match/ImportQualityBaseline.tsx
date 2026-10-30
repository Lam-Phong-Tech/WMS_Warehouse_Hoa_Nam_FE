import { ReportWarehouseCard } from "@/modules/reports/components/ReportWarehouseCard";
import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useMemo, useState, type ReactNode } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiSelect,
  UiSpinner,
  UiStatusBadge,
  UiVuexyDateRangePicker,
} from "@/shared/ui";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import {
  useSkuCatalog,
  useUserDirectory,
} from "@/modules/reports/operations/report-data";
import {
  API_DATE,
  axisDayLabel,
  fmt,
  fmtDateTime,
  pct,
  presetRange,
  type ItemKind,
} from "@/modules/reports/operations/report-format";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import { useT } from "@/shared/i18n/useT";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { downloadImportQualityExport, useImportQualityBatches } from "./import-quality-api";
import { ImportQualityIssuePanel } from "./ImportQualityIssuePanel";
import { useClientPagination } from "@/modules/reports/operations/report-columns";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import {
  buildImportBatches,
  filterBatches,
  sortByNewest,
  totalsOf,
  trendByDay,
  type ImportMatchBatch,
  type ImportMatchResultFilter,
} from "./import-match-model";
import { tStatic as tUi } from "@/shared/i18n/useT";

const C = {
  navy: "var(--ops-heading)",
  navyDark: "var(--ops-heading)",
  primary: "var(--ops-primary)",
  primaryDark: "var(--ops-primary-hover)",
  cyanSoft: "var(--ops-pale)",
  border: "var(--ops-line)",
  borderStrong: "var(--ops-line)",
  bg: "var(--ops-canvas)",
  text: "var(--ops-text)",
  muted: "var(--ops-muted)",
  green: "var(--ops-success)",
  greenSoft: "var(--ops-success-soft)",
  orange: "var(--ops-warning)",
  orangeSoft: "var(--ops-warning-soft)",
  red: "var(--ops-danger)",
  redSoft: "var(--ops-danger-soft)",
} as const;

const surface = {
  border: `1px solid ${C.border}`,
  borderRadius: "var(--ops-radius-card)",
  bgcolor: "var(--ops-surface)",
  boxShadow: "0 1px 2px rgba(4, 70, 116, 0.03)",
} as const;

const getdataTypeOptions = localizedUiValue(() => [
  { value: "all", label: tUi("dashboard.operations.filterAll") },
  { value: "PRODUCT", label: tUi("dashboard.skuType.product") },
  { value: "COMPONENT", label: tUi("dashboard.skuType.component") },
]);

const getresultOptions = localizedUiValue(() => [
  { value: "", label: tUi("dashboard.operations.filterAll") },
  { value: "SUCCESS", label: tUi("reports.inventoryFlowReport.matched") },
  { value: "DUPLICATE", label: tUi("inventory.balance.colVariance") },
  { value: "FAILED", label: tUi("updatedUi.text_e557e75b43a7") },
]);

function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "success" | "warning" | "error";
  icon: ReactNode;
  onClick?: () => void;
}) {
  const tones = {
    primary: { fg: C.navy, bg: C.cyanSoft },
    success: { fg: C.green, bg: C.greenSoft },
    warning: { fg: C.orange, bg: C.orangeSoft },
    error: { fg: C.red, bg: C.redSoft },
  } as const;
  const t = tones[tone];
  return (
    <Box
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        ...surface,
        minHeight: { xs: 112, md: 116 },
        px: { xs: 1.5, md: 1.75 },
        py: 1.4,
        display: "grid",
        gridTemplateColumns: "60px minmax(0, 1fr)",
        alignItems: "center",
        gap: 1.25,
        cursor: onClick ? "pointer" : "default",
        transition:
          "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
        "&:hover": onClick
          ? {
              transform: "translateY(-1px)",
              borderColor: C.borderStrong,
              boxShadow: "0 6px 18px rgba(0, 75, 120, .08)",
            }
          : undefined,
        "&:focus-visible": {
          outline: `2px solid ${C.primary}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 58,
          height: 58,
          borderRadius: "9px",
          display: "grid",
          placeItems: "center",
          bgcolor: t.bg,
          color: t.fg,
          fontSize: 27,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            color: C.text,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {label}
        </Box>
        <Box
          sx={{
            mt: 0.2,
            color: C.navyDark,
            fontSize: "clamp(27px, 2.4vw, 36px)",
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-.025em",
          }}
        >
          {value}
        </Box>
        <Box sx={{ mt: 0.35, color: t.fg, fontSize: 12, lineHeight: 1.25 }}>
          {hint}
        </Box>
      </Box>
    </Box>
  );
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        mb: 0.55,
        fontSize: 12.5,
        fontWeight: 700,
        color: C.text,
        lineHeight: "18px",
      }}
    >
      {children}
    </Box>
  );
}

function resultTone(row: ImportMatchBatch): "success" | "warning" | "error" {
  if (row.failed > 0) return "error";
  if (row.duplicate > 0) return "warning";
  return "success";
}

function resultLabel(row: ImportMatchBatch): string {
  if (row.failed > 0) return tUi("updatedUi.text_e557e75b43a7");
  if (row.duplicate > 0) return tUi("inventory.balance.colVariance");
  return tUi("reports.inventoryFlowReport.matched");
}

export default function ImportQualityBaseline() {
  const t = useT();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() =>
    presetRange("this-month"),
  );
  const [result, setResult] = useState<ImportMatchResultFilter>("");
  const [kind, setKind] = useState<ItemKind>("all");
  const [keyword, setKeyword] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [openBatch, setOpenBatch] = useState<ImportMatchBatch | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const from = range[0].format(API_DATE);
  const to = range[1].format(API_DATE);
  const invalid = range[0].isAfter(range[1], "day");
  const presets = useMemo(() => reportRangePresets(t), [t]);

  const catalog = useSkuCatalog();
  const users = useUserDirectory();
  const source = useImportQualityBatches(!invalid);

  const allRows = useMemo(
    () =>
      sortByNewest(
        buildImportBatches(
          Array.isArray(source.data) ? source.data : [],
          (actorId) =>
            users.entries.find((entry) => entry.user_id === actorId)?.name ??
            "",
        ),
      ),
    [source.data, users.entries],
  );

  const filteredRows = useMemo(() => {
    const rows = filterBatches(
      allRows,
      { from, to, result, status: "", actor: "", keyword, sku: "", kind },
      (code) => catalog.kindOfCode(code),
    );
    return issuesOnly
      ? rows.filter((row) => row.failed > 0 || row.duplicate > 0)
      : rows;
  }, [allRows, from, to, result, keyword, kind, catalog, issuesOnly]);

  const totals = useMemo(() => totalsOf(filteredRows), [filteredRows]);
  const trend = useMemo(() => trendByDay(filteredRows), [filteredRows]);
  const pagination = useClientPagination(filteredRows, 5);
  const lastPage = Math.max(
    1,
    Math.ceil(pagination.total / pagination.perPage),
  );
  const issueCount = totals.failed + totals.duplicate;
  const qualityPct =
    totals.total > 0 ? (totals.success / totals.total) * 100 : 0;
  const greenStop = Math.max(0, Math.min(100, qualityPct));
  const orangeShare =
    totals.total > 0 ? (totals.duplicate / totals.total) * 100 : 0;
  const orangeStop = Math.max(
    greenStop,
    Math.min(100, greenStop + orangeShare),
  );

  const { refresh } = useReportRefresh({
    refetch: () => source.refetch(),
    readError: () => source.error,
  });

  const reset = () => {
    setRange(presetRange("this-month"));
    setResult("");
    setKind("all");
    setKeyword("");
    setIssuesOnly(false);
    pagination.reset();
  };

  const apply = () => {
    pagination.reset();
    document
      .getElementById("rpt04-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportXlsx = async () => {
    setExporting(true);
    setExportError("");
    try {
      await downloadImportQualityExport({
        from_date: from,
        to_date: to,
        ...(result ? { result } : {}),
        ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
        ...(issuesOnly ? { issues_only: "1" } : {}),
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Không thể tải báo cáo nhập liệu.");
    } finally {
      setExporting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    if (lastPage <= 4) return Array.from({ length: lastPage }, (_, i) => i + 1);
    if (pagination.page <= 2) return [1, 2, 3];
    if (pagination.page >= lastPage - 1)
      return [lastPage - 2, lastPage - 1, lastPage];
    return [pagination.page - 1, pagination.page, pagination.page + 1];
  }, [lastPage, pagination.page]);

  return (
    <Box
      data-testid="rpt-tab-import-quality"
      data-report-screen="RPT-04"
      sx={{
        width: "100%",
        minWidth: 0,
        display: "grid",
        gap: "var(--ops-gap)",
        color: C.text,
        fontSize: { xs: 13, md: 14 },
        "& *": { boxSizing: "border-box" },
        "& .hn-vuexy-date-range.ant-picker": {
          minHeight: "var(--ops-control-height)",
          borderColor: C.primary,
          borderRadius: "var(--ops-radius-control)",
          boxShadow: "none",
          color: C.text,
        },
        "& .hn-vuexy-date-range.ant-picker:hover": {
          borderColor: C.primaryDark,
        },
        "& .hn-vuexy-date-range.ant-picker-focused": {
          borderColor: C.primary,
          boxShadow: "0 0 0 2px rgba(0,108,168,.13)",
        },
        "& .hn-vuexy-date-range .ant-picker-active-bar": {
          background: C.primary,
        },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "flex-end" },
          gap: 1.25,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
            {tUi("updatedUi.text_55f997722908")}
          </Box>
          <Box
            component="h1"
            className="hn-report-page-title"
            sx={{
              m: 0,
              mt: 0.35,
              color: C.navy,
              fontSize: 24,
              lineHeight: "38px",
              letterSpacing: "-.028em",
              fontWeight: 700,
            }}
          >
            {tUi("updatedUi.text_1beab79ddbe5")}
          </Box>
          <Box
            sx={{
              mt: 0.25,
              color: "var(--ops-link)",
              fontSize: { xs: 13.5, md: 15 },
              lineHeight: 1.3,
            }}
          >
            {tUi("updatedUi.text_1522bfe664ca")}
          </Box>
        </Box>

        <Stack
          className="hn-report-warehouse-actions"
          direction="row"
          sx={{
            gap: 1,
            flexWrap: "wrap",
            justifyContent: { xs: "flex-start", md: "flex-end" },
          }}
        >
          <UiButton
            appearance="filled"
            startIcon={<DownloadOutlined />}
            loading={exporting}
            disabled={invalid || source.isLoading || kind !== "all"}
            onClick={() => void exportXlsx()}
          >
            {tUi("reports.traceability.exportReport")}
          </UiButton>

          <ReportWarehouseCard />
        </Stack>
      </Stack>

      <Box
        component="section"
        aria-label={tUi("reports.recipientAgency.filterTitle")}
        sx={{ ...surface, p: { xs: 1.25, sm: 1.5 } }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "1.25fr .9fr 1fr 1fr",
            },
            gap: { xs: 1.1, md: 1.25 },
            alignItems: "end",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>
              {tUi("reports.packingLabel.dateRangeLabel")}
            </FilterLabel>
            <UiVuexyDateRangePicker
              aria-label={tUi("reports.packingLabel.dateRangeLabel")}
              value={range}
              format="DD/MM/YYYY"
              allowClear={false}
              maxDate={dayjs().endOf("day")}
              presets={presets}
              className="hn-vuexy-date-range"
              popupClassName="hn-vuexy-date-popup"
              onChange={(value) => {
                if (value?.[0] && value[1]) {
                  setRange([value[0], value[1]]);
                  pagination.reset();
                }
              }}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>{tUi("updatedUi.text_19c608bfa103")}</FilterLabel>
            <Box
              aria-label="Kho Hoa Nam"
              sx={{
                minHeight: "var(--ops-control-height)",
                px: 1.5,
                display: "flex",
                alignItems: "center",
                border: `1px solid ${C.border}`,
                borderRadius: "var(--ops-radius-control)",
                bgcolor: "var(--ops-canvas)",
                color: C.muted,
                fontWeight: 600,
              }}
            >
              Kho Hoa Nam
            </Box>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>{tUi("updatedUi.text_cf769803384e")}</FilterLabel>
            <UiSelect
              fullWidth
              aria-label={tUi("updatedUi.text_cf769803384e")}
              value={kind}
              onChange={(value) => {
                setKind(value as ItemKind);
                pagination.reset();
              }}
              options={getdataTypeOptions()}
              menuClassName="rpt04-select-menu"
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>{tUi("inbound.detail.colResult")}</FilterLabel>
            <UiSelect
              fullWidth
              aria-label={tUi("inbound.detail.colResult")}
              value={result}
              placeholder={tUi("dashboard.operations.filterAll")}
              onChange={(value) => {
                setResult(value as ImportMatchResultFilter);
                setIssuesOnly(false);
                pagination.reset();
              }}
              options={getresultOptions().filter((item) => item.value !== "")}
              menuClassName="rpt04-select-menu"
            />
          </Box>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            mt: 1.15,
            gap: 1,
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Box
            className="rpt04-search-label"
            sx={{
              display: { xs: "none", lg: "flex" },
              minHeight: "var(--ops-control-height)",
              alignItems: "center",
              flex: "0 0 auto",
              color: C.text,
              fontSize: 13,
              fontWeight: 650,
            }}
          >
            {tUi("reports.packingLabel.searchLabel")}
          </Box>
          <Box className="rpt04-search-field" sx={{ flex: 1, minWidth: 0 }}>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label={tUi("updatedUi.text_e1a79d9e5b67")}
              placeholder={tUi("updatedUi.text_35f2275a1d2b")}
              onChange={(value) => {
                setKeyword(value);
                pagination.reset();
              }}
            />
          </Box>
          <UiButton appearance="filled" onClick={apply} disabled={invalid}>
            {tUi("dashboard.snapshot.apply")}
          </UiButton>
          <UiButton appearance="outlined" onClick={reset}>
            {tUi("reports.packingLabel.reset")}
          </UiButton>
        </Stack>
      </Box>

      {invalid ? (
        <UiAlert tone="error">{tUi("dashboard.snapshot.invalidOrder")}</UiAlert>
      ) : null}
      {source.error ? (
        <ApiErrorAlert
          error={source.error}
          title={tUi("updatedUi.text_c1e574adfa82")}
          onRetry={refresh}
        />
      ) : null}
      {exportError ? <UiAlert tone="error">{exportError}</UiAlert> : null}

      <Box
        component="section"
        aria-label={tUi("updatedUi.text_ca1f8a7c5025")}
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: { xs: 1, md: 1.15 },
        }}
      >
        <MetricCard
          label={tUi("updatedUi.text_fe86ff7f56fe")}
          value={fmt(totals.total)}
          hint="Trong kỳ báo cáo"
          tone="primary"
          icon={<FileTextOutlined />}
        />
        <MetricCard
          label={tUi("reports.inventoryFlowReport.matched")}
          value={fmt(totals.success)}
          hint={tUi("updatedUi.text_0f576ef1ed56", {
            value0: String(pct(totals.success, totals.total)),
          })}
          tone="success"
          icon={<CheckCircleOutlined />}
          onClick={() => {
            setResult("SUCCESS");
            setIssuesOnly(false);
            pagination.reset();
          }}
        />
        <MetricCard
          label={tUi("inventory.balance.colVariance")}
          value={fmt(totals.duplicate)}
          hint="Cần kiểm tra"
          tone="warning"
          icon={<WarningOutlined />}
          onClick={() => {
            setResult("DUPLICATE");
            setIssuesOnly(false);
            pagination.reset();
          }}
        />
        <MetricCard
          label={tUi("updatedUi.text_e557e75b43a7")}
          value={fmt(totals.failed)}
          hint="Không thể đối chiếu"
          tone="error"
          icon={<WarningOutlined />}
          onClick={() => {
            setResult("FAILED");
            setIssuesOnly(false);
            pagination.reset();
          }}
        />
      </Box>

      <Box
        component="section"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.75fr) minmax(330px, .85fr)",
          },
          gap: 1.15,
        }}
      >
        <Box sx={{ ...surface, p: { xs: 1.25, md: 1.5 }, minWidth: 0 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{ justifyContent: "space-between", gap: 0.75, mb: 0.5 }}
          >
            <Box
              component="h2"
              sx={{
                m: 0,
                color: C.navy,
                fontSize: 18,
                lineHeight: "26px",
                fontWeight: 600,
              }}
            >
              {tUi("updatedUi.text_9c5271fe15dc")}
            </Box>
            <Box sx={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>
              {tUi("updatedUi.text_09caee89904d") + " "}
              {fmt(totals.total)}{" "}
              <Box component="span" sx={{ fontWeight: 500 }}>
                {tUi("updatedUi.text_3c28fe9f81e1")}
              </Box>
            </Box>
          </Stack>
          {source.isLoading ? (
            <Box sx={{ height: 190, display: "grid", placeItems: "center" }}>
              <UiSpinner />
            </Box>
          ) : trend.length === 0 ? (
            <Box
              sx={{
                height: 190,
                display: "grid",
                placeItems: "center",
                color: C.muted,
              }}
            >
              {tUi("updatedUi.text_47bca3969590")}
            </Box>
          ) : (
            <MultiSeriesBarChart
              categories={trend.map((point) => axisDayLabel(point.day))}
              series={[
                {
                  name: tUi("reports.inventoryFlowReport.matched"),
                  data: trend.map((point) => point.success),
                  color: CHART_COLORS.success,
                },
                {
                  name: tUi("inventory.balance.colVariance"),
                  data: trend.map((point) => point.duplicate),
                  color: CHART_COLORS.warning,
                },
                {
                  name: tUi("updatedUi.text_e557e75b43a7"),
                  data: trend.map((point) => point.failed),
                  color: CHART_COLORS.danger,
                },
              ]}
              stacked
              showValues
              height={190}
              valueFormatter={fmt}
            />
          )}
        </Box>

        <Box
          sx={{
            ...surface,
            p: { xs: 1.25, md: 1.5 },
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            component="h2"
            sx={{
              m: 0,
              color: C.navy,
              fontSize: 18,
              lineHeight: "26px",
              fontWeight: 600,
            }}
          >
            {tUi("dashboard.insight.qualityTitle")}
          </Box>
          <Box
            sx={{
              flex: 1,
              py: 1.25,
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(145px, .9fr) 1fr",
                sm: "minmax(170px, .9fr) 1fr",
                xl: "1fr",
              },
              gap: 1.25,
              alignItems: "center",
            }}
          >
            <Box
              role="img"
              aria-label={tUi("updatedUi.text_4cf91aedba2d", {
                value0: String(qualityPct.toFixed(1)),
              })}
              sx={{
                width: { xs: 145, sm: 168 },
                aspectRatio: "1",
                mx: "auto",
                borderRadius: "50%",
                background: `conic-gradient(${C.green} 0 ${greenStop}%, ${C.orange} ${greenStop}% ${orangeStop}%, ${C.red} ${orangeStop}% 100%)`,
                display: "grid",
                placeItems: "center",
                position: "relative",
                "&::after": {
                  content: '""',
                  width: "64%",
                  height: "64%",
                  borderRadius: "50%",
                  bgcolor: "var(--ops-surface)",
                  position: "absolute",
                },
              }}
            >
              <Box sx={{ zIndex: 1, textAlign: "center", color: C.navy }}>
                <Box
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: 22, sm: 26 },
                    lineHeight: 1,
                  }}
                >
                  {qualityPct.toFixed(1).replace(".", ",")}%
                </Box>
                <Box sx={{ mt: 0.35, fontSize: 11.5 }}>
                  {tUi("reports.inventoryFlowReport.matched")}
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: "grid", gap: 0.85 }}>
              {[
                [
                  tUi("reports.inventoryFlowReport.matched"),
                  fmt(totals.success),
                  C.green,
                ],
                [
                  tUi("inventory.balance.colVariance"),
                  fmt(totals.duplicate),
                  C.orange,
                ],
                [tUi("updatedUi.text_e557e75b43a7"), fmt(totals.failed), C.red],
              ].map(([label, value, color]) => (
                <Stack
                  key={label}
                  direction="row"
                  sx={{ alignItems: "center", gap: 0.85 }}
                >
                  <Box
                    sx={{
                      width: 15,
                      height: 15,
                      borderRadius: "50%",
                      bgcolor: color,
                      flex: "none",
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0, fontSize: 13 }}>{label}</Box>
                  <Box sx={{ fontWeight: 800, fontSize: 13.5 }}>{value}</Box>
                </Stack>
              ))}
            </Box>
          </Box>

          <Stack
            direction="row"
            sx={{
              mt: "auto",
              p: 0.85,
              minHeight: "var(--ops-control-height)",
              border: `1px solid ${C.orange}`,
              borderRadius: "var(--ops-radius-control)",
              bgcolor: "#fffaf3",
              color: "#eb4c16",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ fontWeight: 700, fontSize: 12.5 }}>
              {fmt(issueCount)}
              {" " + tUi("updatedUi.text_e88f44e08fbd")}
            </Box>
            <UiButton
              appearance="outlined"
              onClick={() => {
                setResult("");
                setIssuesOnly(true);
                pagination.reset();
                document
                  .getElementById("rpt04-results")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Xem {fmt(issueCount)}
              {" " + tUi("updatedUi.text_3c28fe9f81e1")}
            </UiButton>
          </Stack>
        </Box>
      </Box>

      <Box
        id="rpt04-results"
        component="section"
        sx={{ ...surface, overflow: "hidden", scrollMarginTop: 96 }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            px: { xs: 1.25, md: 1.5 },
            pt: 1.15,
            pb: 0.75,
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 0.8, flexWrap: "wrap" }}
          >
            <Box
              component="h2"
              sx={{ m: 0, color: C.navy, fontSize: 18, fontWeight: 600 }}
            >
              {tUi("updatedUi.text_ff603e37b9df")}
            </Box>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 999,
                bgcolor: C.cyanSoft,
                color: C.navy,
                fontWeight: 800,
                fontSize: 12.5,
              }}
            >
              {fmt(pagination.total)}
            </Box>
          </Stack>
          <Box sx={{ width: { xs: "100%", sm: 290, md: 330 } }}>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label={tUi("updatedUi.text_bddbe4bba7b5")}
              placeholder={tUi("updatedUi.text_b4e6c9c5842a")}
              onChange={(value) => {
                setKeyword(value);
                pagination.reset();
              }}
            />
          </Box>
        </Stack>

        <Box sx={{ px: { xs: 1, md: 1.25 } }}>
          <ResponsiveDataTable<ImportMatchBatch>
            columns={[
              {
                key: "reference",
                header: tUi("updatedUi.text_cbd08c7c8080"),
                render: (row) => (
                  <Box sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        fontWeight: 800,
                        color: C.navy,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {row.batchNo || "—"}
                    </Box>
                    <Box
                      sx={{
                        mt: 0.15,
                        color: C.muted,
                        fontSize: 11.5,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {row.caption || row.sourceFile || "—"}
                    </Box>
                  </Box>
                ),
              },
              {
                key: "comparison",
                header: tUi("updatedUi.text_d8451df71267"),
                render: (row) => (
                  <Box sx={{ fontSize: 12.5, whiteSpace: "normal" }}>
                    {fmt(row.total)}
                    {" " + tUi("updatedUi.text_da71bc75ab04") + " "}
                    {fmt(row.success)}
                    {" " + tUi("updatedUi.text_271749576b70")}
                  </Box>
                ),
              },
              {
                key: "result",
                header: tUi("inbound.detail.colResult"),
                width: 135,
                render: (row) => (
                  <UiStatusBadge
                    tone={resultTone(row)}
                    label={resultLabel(row)}
                  />
                ),
              },
              {
                key: "updated",
                header: tUi("updatedUi.text_5293d03c5908"),
                width: 170,
                render: (row) => (row.at ? fmtDateTime(row.at) : "—"),
              },
            ]}
            rows={pagination.pageRows}
            rowKey={(row) => `${row.context}:${row.id}`}
            loading={source.isLoading}
            onRowClick={(row) => setOpenBatch(row)}
            emptyText={
              keyword.trim() || result || issuesOnly
                ? tUi("updatedUi.text_68e8bdb5a388")
                : tUi("updatedUi.text_193f83e1a797")
            }
            renderRowActions={(row) => (
              <RowActionGroup>
                <RowActionButton
                  kind="view"
                  aria-label={tUi("updatedUi.text_5f302da6778a", {
                    value0: String(row.batchNo),
                  })}
                  onClick={() => setOpenBatch(row)}
                >
                  Xem
                </RowActionButton>
              </RowActionGroup>
            )}
          />
        </Box>

        <Stack
          className="hn-report-pagination-footer"
          direction={{ xs: "column", sm: "row" }}
          sx={{
            px: { xs: 1.25, md: 1.5 },
            py: 1.1,
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ fontSize: 12.5, color: C.text }}>
            {tUi("putaway.queue.showing")}{" "}
            {pagination.total === 0
              ? 0
              : (pagination.page - 1) * pagination.perPage + 1}
            –{Math.min(pagination.page * pagination.perPage, pagination.total)}{" "}
            / {fmt(pagination.total)}
            {" " + tUi("updatedUi.text_3c28fe9f81e1")}
          </Box>
          <Stack
            className="hn-report-pagination"
            direction="row"
            sx={{
              gap: 0.55,
              alignItems: "center",
              justifyContent: { xs: "flex-end", sm: "initial" },
              flexWrap: "wrap",
            }}
          >
            <UiButton
              appearance="outlined"
              disabled={pagination.page <= 1}
              onClick={() =>
                pagination.setPage(Math.max(1, pagination.page - 1))
              }
            >
              ‹
            </UiButton>
            {pageNumbers.map((page) => (
              <UiButton
                key={page}
                appearance={page === pagination.page ? "filled" : "outlined"}
                onClick={() => pagination.setPage(page)}
              >
                {page}
              </UiButton>
            ))}
            {lastPage > 4 && pagination.page < lastPage - 2 ? (
              <Box sx={{ px: 0.25 }}>…</Box>
            ) : null}
            {lastPage > 3 && !pageNumbers.includes(lastPage) ? (
              <UiButton
                appearance="outlined"
                onClick={() => pagination.setPage(lastPage)}
              >
                {lastPage}
              </UiButton>
            ) : null}
            <UiButton
              appearance="outlined"
              disabled={pagination.page >= lastPage}
              onClick={() =>
                pagination.setPage(Math.min(lastPage, pagination.page + 1))
              }
            >
              ›
            </UiButton>
          </Stack>
        </Stack>
      </Box>

      {openBatch ? (
        <DrillDownDialog
          title={tUi("updatedUi.text_ecd76b3f0e22", {
            value0: String(
              openBatch.batchNo || tUi("updatedUi.text_3c28fe9f81e1"),
            ),
          })}
          subtitle={tUi("updatedUi.text_8227ce3f3753")}
          onClose={() => setOpenBatch(null)}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1,
            }}
          >
            {[
              [tUi("updatedUi.text_f235d93f10dd"), openBatch.batchNo || "—"],
              [
                tUi("audit.colObject"),
                openBatch.caption || openBatch.sourceFile || "—",
              ],
              [tUi("updatedUi.text_fe86ff7f56fe"), fmt(openBatch.total)],
              [
                tUi("reports.inventoryFlowReport.matched"),
                fmt(openBatch.success),
              ],
              [tUi("inventory.balance.colVariance"), fmt(openBatch.duplicate)],
              [tUi("updatedUi.text_e557e75b43a7"), fmt(openBatch.failed)],
              [
                tUi("updatedUi.text_0a3f7deb0656"),
                pct(openBatch.success, openBatch.total),
              ],
              [
                tUi("updatedUi.text_5293d03c5908"),
                openBatch.at ? fmtDateTime(openBatch.at) : "—",
              ],
            ].map(([label, value]) => (
              <Box
                key={label}
                sx={{
                  p: 1.25,
                  borderRadius: "7px",
                  bgcolor: C.bg,
                  border: `1px solid ${C.border}`,
                }}
              >
                <Box sx={{ color: C.muted, fontSize: 11.5 }}>{label}</Box>
                <Box
                  sx={{
                    mt: 0.25,
                    color: C.navy,
                    fontWeight: 700,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </Box>
              </Box>
            ))}
          </Box>
          {openBatch.id ? <ImportQualityIssuePanel key={openBatch.id} batchId={openBatch.id} sourceFile={openBatch.sourceFile} /> : null}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
