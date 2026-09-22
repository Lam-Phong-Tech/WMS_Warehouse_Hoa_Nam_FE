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
  BarChartOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import {
  useSkuCatalog,
  useSkuImportReports,
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
import { useReportExport } from "@/modules/reports/operations/report-export";
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

const C = {
  navy: "#073b7d",
  navyDark: "#002f67",
  primary: "#006ca8",
  primaryDark: "#00598d",
  cyanSoft: "#edf9ff",
  border: "#c9e7f4",
  borderStrong: "#a8d7ea",
  bg: "#f6fbfe",
  text: "#073b7d",
  muted: "#5275a5",
  green: "#1fa651",
  greenSoft: "#e8f8ee",
  orange: "#ff8b18",
  orangeSoft: "#fff4e8",
  red: "#ff3346",
  redSoft: "#fff0f2",
} as const;

const surface = {
  border: `1px solid ${C.border}`,
  borderRadius: "8px",
  bgcolor: "#fff",
  boxShadow: "0 1px 2px rgba(4, 70, 116, 0.03)",
} as const;

const dataTypeOptions = [
  { value: "all", label: "Tất cả" },
  { value: "PRODUCT", label: "Sản phẩm" },
  { value: "COMPONENT", label: "Linh kiện" },
];

const resultOptions = [
  { value: "", label: "Tất cả" },
  { value: "SUCCESS", label: "Khớp" },
  { value: "DUPLICATE", label: "Chênh lệch" },
  { value: "FAILED", label: "Lỗi dữ liệu" },
];

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
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
        "&:hover": onClick
          ? { transform: "translateY(-1px)", borderColor: C.borderStrong, boxShadow: "0 6px 18px rgba(0, 75, 120, .08)" }
          : undefined,
        "&:focus-visible": { outline: `2px solid ${C.primary}`, outlineOffset: 2 },
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
        <Box sx={{ color: C.text, fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
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
    <Box sx={{ mb: 0.55, fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: "18px" }}>
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
  if (row.failed > 0) return "Lỗi dữ liệu";
  if (row.duplicate > 0) return "Chênh lệch";
  return "Khớp";
}

export default function ImportQualityBaseline() {
  const t = useT();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => presetRange("this-month"));
  const [result, setResult] = useState<ImportMatchResultFilter>("");
  const [kind, setKind] = useState<ItemKind>("all");
  const [keyword, setKeyword] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [openBatch, setOpenBatch] = useState<ImportMatchBatch | null>(null);

  const from = range[0].format(API_DATE);
  const to = range[1].format(API_DATE);
  const invalid = range[0].isAfter(range[1], "day");
  const presets = useMemo(() => reportRangePresets(t), [t]);

  const catalog = useSkuCatalog();
  const users = useUserDirectory();
  const source = useSkuImportReports({ enabled: !invalid });
  const exporter = useReportExport();

  const allRows = useMemo(
    () =>
      sortByNewest(
        buildImportBatches(
          Array.isArray(source.data?.data) ? source.data.data : [],
          (actorId) => users.entries.find((entry) => entry.user_id === actorId)?.name ?? "",
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
    return issuesOnly ? rows.filter((row) => row.failed > 0 || row.duplicate > 0) : rows;
  }, [allRows, from, to, result, keyword, kind, catalog, issuesOnly]);

  const totals = useMemo(() => totalsOf(filteredRows), [filteredRows]);
  const trend = useMemo(() => trendByDay(filteredRows), [filteredRows]);
  const pagination = useClientPagination(filteredRows, 5);
  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.perPage));
  const issueCount = totals.failed + totals.duplicate;
  const qualityPct = totals.total > 0 ? (totals.success / totals.total) * 100 : 0;
  const greenStop = Math.max(0, Math.min(100, qualityPct));
  const orangeShare = totals.total > 0 ? (totals.duplicate / totals.total) * 100 : 0;
  const orangeStop = Math.max(greenStop, Math.min(100, greenStop + orangeShare));

  const { refreshing, refresh } = useReportRefresh({
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
    document.getElementById("rpt04-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportXlsx = () =>
    exporter.exportReport("xlsx", {
      reportCode: "import-match",
      fileStem: "bao-cao-nhap-lieu-doi-chieu-loi",
      fileSuffix: `-${from}-${to}`,
      filters: {
        from_date: from,
        to_date: to,
        ...(result ? { result } : {}),
        ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      },
    });

  const pageNumbers = useMemo(() => {
    if (lastPage <= 4) return Array.from({ length: lastPage }, (_, i) => i + 1);
    if (pagination.page <= 2) return [1, 2, 3];
    if (pagination.page >= lastPage - 1) return [lastPage - 2, lastPage - 1, lastPage];
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
        gap: { xs: 1.25, sm: 1.5, md: 1.25 },
        color: C.text,
        fontSize: { xs: 13, md: 14 },
        "& *": { boxSizing: "border-box" },
        "& .hn-vuexy-date-range.ant-picker": {
          minHeight: 42,
          borderColor: C.primary,
          borderRadius: "6px",
          boxShadow: "none",
          color: C.text,
        },
        "& .hn-vuexy-date-range.ant-picker:hover": { borderColor: C.primaryDark },
        "& .hn-vuexy-date-range.ant-picker-focused": {
          borderColor: C.primary,
          boxShadow: "0 0 0 2px rgba(0,108,168,.13)",
        },
        "& .hn-vuexy-date-range .ant-picker-active-bar": { background: C.primary },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "flex-end" }, gap: 1.25 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
            Báo cáo&nbsp;&nbsp;/&nbsp;&nbsp;Nhập liệu, đối chiếu & lỗi
          </Box>
          <Box
            component="h1"
            sx={{
              m: 0,
              mt: 0.35,
              color: C.navy,
              fontSize: { xs: 25, sm: 29, md: 31 },
              lineHeight: 1.08,
              letterSpacing: "-.028em",
              fontWeight: 800,
            }}
          >
            Báo cáo Nhập liệu, đối chiếu & lỗi
          </Box>
          <Box sx={{ mt: 0.25, color: "#086ec4", fontSize: { xs: 13.5, md: 15 }, lineHeight: 1.3 }}>
            Theo dõi chất lượng dữ liệu, kết quả đối chiếu và lỗi phát sinh
          </Box>
        </Box>

        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
          <UiStatusBadge tone="info" label="Dữ liệu minh họa" />
          <UiButton
            appearance="filled"
            loading={exporter.exporting === "xlsx"}
            disabled={invalid || source.isLoading}
            onClick={() => void exportXlsx()}
          >
            Xuất báo cáo
          </UiButton>
        </Stack>
      </Stack>

      <Box component="section" aria-label="Bộ lọc báo cáo" sx={{ ...surface, p: { xs: 1.25, sm: 1.5 } }}>
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
            <FilterLabel>Khoảng thời gian</FilterLabel>
            <UiVuexyDateRangePicker
              aria-label="Khoảng thời gian"
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
            <FilterLabel>Kho</FilterLabel>
            <Box
              aria-label="Kho Hoa Nam"
              sx={{
                minHeight: 42,
                px: 1.5,
                display: "flex",
                alignItems: "center",
                border: `1px solid ${C.border}`,
                borderRadius: "6px",
                bgcolor: "#f7fbfd",
                color: C.muted,
                fontWeight: 600,
              }}
            >
              Kho Hoa Nam
            </Box>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>Loại dữ liệu</FilterLabel>
            <UiSelect
              fullWidth
              aria-label="Loại dữ liệu"
              value={kind}
              onChange={(value) => {
                setKind(value as ItemKind);
                pagination.reset();
              }}
              options={dataTypeOptions}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>Kết quả</FilterLabel>
            <UiSelect
              fullWidth
              aria-label="Kết quả"
              value={result}
              placeholder="Tất cả"
              onChange={(value) => {
                setResult(value as ImportMatchResultFilter);
                setIssuesOnly(false);
                pagination.reset();
              }}
              options={resultOptions.filter((item) => item.value !== "")}
            />
          </Box>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ mt: 1.15, gap: 1, alignItems: "stretch" }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label="Tìm kiếm mã phiếu, SKU, serial, lô hoặc pallet"
              placeholder="Mã phiếu / SKU / Serial / Lô / Pallet"
              onChange={(value) => {
                setKeyword(value);
                pagination.reset();
              }}
            />
          </Box>
          <UiButton appearance="filled" onClick={apply} disabled={invalid}>
            Áp dụng
          </UiButton>
          <UiButton appearance="outlined" onClick={reset}>
            Đặt lại
          </UiButton>
          <UiButton
            appearance="text"
            startIcon={<ReloadOutlined />}
            loading={refreshing}
            onClick={refresh}
            disabled={invalid || source.isFetching}
          >
            Làm mới
          </UiButton>
        </Stack>
      </Box>

      {invalid ? <UiAlert tone="error">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</UiAlert> : null}
      {source.error ? (
        <ApiErrorAlert error={source.error} title="Không thể tải báo cáo" onRetry={refresh} />
      ) : null}

      <Box
        component="section"
        aria-label="Tổng quan chất lượng dữ liệu"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
          gap: { xs: 1, md: 1.15 },
        }}
      >
        <MetricCard
          label="Tổng bản ghi"
          value={fmt(totals.total)}
          hint="Trong kỳ báo cáo"
          tone="primary"
          icon={<BarChartOutlined />}
        />
        <MetricCard
          label="Khớp"
          value={fmt(totals.success)}
          hint={`${pct(totals.success, totals.total)} tổng bản ghi`}
          tone="success"
          icon={<CheckCircleOutlined />}
          onClick={() => {
            setResult("SUCCESS");
            setIssuesOnly(false);
            pagination.reset();
          }}
        />
        <MetricCard
          label="Chênh lệch"
          value={fmt(totals.duplicate)}
          hint="Cần kiểm tra"
          tone="warning"
          icon={<CopyOutlined />}
          onClick={() => {
            setResult("DUPLICATE");
            setIssuesOnly(false);
            pagination.reset();
          }}
        />
        <MetricCard
          label="Lỗi dữ liệu"
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
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.75fr) minmax(330px, .85fr)" },
          gap: 1.15,
        }}
      >
        <Box sx={{ ...surface, p: { xs: 1.25, md: 1.5 }, minWidth: 0 }}>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: .75, mb: .5 }}>
            <Box component="h2" sx={{ m: 0, color: C.navy, fontSize: { xs: 18, md: 19 }, lineHeight: 1.2, fontWeight: 800 }}>
              Kết quả đối chiếu theo ngày
            </Box>
            <Box sx={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>
              Tổng: {fmt(totals.total)} <Box component="span" sx={{ fontWeight: 500 }}>bản ghi</Box>
            </Box>
          </Stack>
          {source.isLoading ? (
            <Box sx={{ height: 270, display: "grid", placeItems: "center" }}><UiSpinner /></Box>
          ) : trend.length === 0 ? (
            <Box sx={{ height: 270, display: "grid", placeItems: "center", color: C.muted }}>Chưa có dữ liệu trong khoảng thời gian đã chọn.</Box>
          ) : (
            <MultiSeriesBarChart
              categories={trend.map((point) => axisDayLabel(point.day))}
              series={[
                { name: "Khớp", data: trend.map((point) => point.success), color: CHART_COLORS.success },
                { name: "Chênh lệch", data: trend.map((point) => point.duplicate), color: CHART_COLORS.warning },
                { name: "Lỗi dữ liệu", data: trend.map((point) => point.failed), color: CHART_COLORS.danger },
              ]}
              stacked
              showValues
              height={270}
              valueFormatter={fmt}
            />
          )}
        </Box>

        <Box sx={{ ...surface, p: { xs: 1.25, md: 1.5 }, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Box component="h2" sx={{ m: 0, color: C.navy, fontSize: { xs: 18, md: 19 }, lineHeight: 1.2, fontWeight: 800 }}>
            Chất lượng dữ liệu
          </Box>
          <Box
            sx={{
              flex: 1,
              py: 1.25,
              display: "grid",
              gridTemplateColumns: { xs: "minmax(145px, .9fr) 1fr", sm: "minmax(170px, .9fr) 1fr", xl: "1fr" },
              gap: 1.25,
              alignItems: "center",
            }}
          >
            <Box
              role="img"
              aria-label={`Tỷ lệ khớp ${qualityPct.toFixed(1)} phần trăm`}
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
                  bgcolor: "#fff",
                  position: "absolute",
                },
              }}
            >
              <Box sx={{ zIndex: 1, textAlign: "center", color: C.navy }}>
                <Box sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 26 }, lineHeight: 1 }}>{qualityPct.toFixed(1).replace(".", ",")}%</Box>
                <Box sx={{ mt: .35, fontSize: 11.5 }}>Khớp</Box>
              </Box>
            </Box>

            <Box sx={{ display: "grid", gap: .85 }}>
              {[
                ["Khớp", fmt(totals.success), C.green],
                ["Chênh lệch", fmt(totals.duplicate), C.orange],
                ["Lỗi dữ liệu", fmt(totals.failed), C.red],
              ].map(([label, value, color]) => (
                <Stack key={label} direction="row" sx={{ alignItems: "center", gap: .85 }}>
                  <Box sx={{ width: 15, height: 15, borderRadius: "50%", bgcolor: color, flex: "none" }} />
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
              p: .85,
              minHeight: 40,
              border: `1px solid ${C.orange}`,
              borderRadius: "6px",
              bgcolor: "#fffaf3",
              color: "#eb4c16",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ fontWeight: 700, fontSize: 12.5 }}>{fmt(issueCount)} bản ghi cần kiểm tra</Box>
            <UiButton
              appearance="outlined"
              onClick={() => {
                setResult("");
                setIssuesOnly(true);
                pagination.reset();
                document.getElementById("rpt04-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Xem {fmt(issueCount)} bản ghi
            </UiButton>
          </Stack>
        </Box>
      </Box>

      <Box id="rpt04-results" component="section" sx={{ ...surface, overflow: "hidden", scrollMarginTop: 96 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            px: { xs: 1.25, md: 1.5 },
            pt: 1.15,
            pb: .75,
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Stack direction="row" sx={{ alignItems: "center", gap: .8, flexWrap: "wrap" }}>
            <Box component="h2" sx={{ m: 0, color: C.navy, fontSize: { xs: 18, md: 19 }, fontWeight: 800 }}>
              Danh sách đối chiếu & lỗi
            </Box>
            <Box sx={{ px: 1, py: .25, borderRadius: 999, bgcolor: C.cyanSoft, color: C.navy, fontWeight: 800, fontSize: 12.5 }}>
              {fmt(pagination.total)}
            </Box>
          </Stack>
          <Box sx={{ width: { xs: "100%", sm: 290, md: 330 } }}>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label="Tìm trong danh sách đối chiếu và lỗi"
              placeholder="Tìm mã phiếu, SKU, serial..."
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
                header: "Mã tham chiếu / Đối tượng",
                render: (row) => (
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontWeight: 800, color: C.navy, overflowWrap: "anywhere" }}>{row.batchNo || "—"}</Box>
                    <Box sx={{ mt: .15, color: C.muted, fontSize: 11.5, overflowWrap: "anywhere" }}>{row.caption || row.sourceFile || "—"}</Box>
                  </Box>
                ),
              },
              {
                key: "comparison",
                header: "So sánh dữ liệu",
                render: (row) => (
                  <Box sx={{ fontSize: 12.5, whiteSpace: "normal" }}>
                    {fmt(row.total)} bản ghi → {fmt(row.success)} hợp lệ
                  </Box>
                ),
              },
              {
                key: "result",
                header: "Kết quả",
                width: 135,
                render: (row) => <UiStatusBadge tone={resultTone(row)} label={resultLabel(row)} />,
              },
              {
                key: "updated",
                header: "Cập nhật",
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
                ? "Không tìm thấy bản ghi phù hợp."
                : "Chưa có dữ liệu đối chiếu trong khoảng thời gian đã chọn."
            }
            renderRowActions={(row) => (
              <UiButton appearance="text" aria-label={`Xem chi tiết ${row.batchNo}`} onClick={() => setOpenBatch(row)}>
                ›
              </UiButton>
            )}
          />
        </Box>

        <Stack
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
            Hiển thị {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1}–
            {Math.min(pagination.page * pagination.perPage, pagination.total)} / {fmt(pagination.total)} bản ghi
          </Box>
          <Stack direction="row" sx={{ gap: .55, alignItems: "center", justifyContent: { xs: "flex-end", sm: "initial" }, flexWrap: "wrap" }}>
            <UiButton appearance="outlined" disabled={pagination.page <= 1} onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}>‹</UiButton>
            {pageNumbers.map((page) => (
              <UiButton
                key={page}
                appearance={page === pagination.page ? "filled" : "outlined"}
                onClick={() => pagination.setPage(page)}
              >
                {page}
              </UiButton>
            ))}
            {lastPage > 4 && pagination.page < lastPage - 2 ? <Box sx={{ px: .25 }}>…</Box> : null}
            {lastPage > 3 && !pageNumbers.includes(lastPage) ? (
              <UiButton appearance="outlined" onClick={() => pagination.setPage(lastPage)}>{lastPage}</UiButton>
            ) : null}
            <UiButton appearance="outlined" disabled={pagination.page >= lastPage} onClick={() => pagination.setPage(Math.min(lastPage, pagination.page + 1))}>›</UiButton>
          </Stack>
        </Stack>
      </Box>

      {openBatch ? (
        <DrillDownDialog
          title={`Chi tiết ${openBatch.batchNo || "bản ghi"}`}
          subtitle="Thông tin đối chiếu lấy từ dữ liệu hiện tại của hệ thống."
          onClose={() => setOpenBatch(null)}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 1,
            }}
          >
            {[
              ["Mã tham chiếu", openBatch.batchNo || "—"],
              ["Đối tượng", openBatch.caption || openBatch.sourceFile || "—"],
              ["Tổng bản ghi", fmt(openBatch.total)],
              ["Khớp", fmt(openBatch.success)],
              ["Chênh lệch", fmt(openBatch.duplicate)],
              ["Lỗi dữ liệu", fmt(openBatch.failed)],
              ["Tỷ lệ khớp", pct(openBatch.success, openBatch.total)],
              ["Cập nhật", openBatch.at ? fmtDateTime(openBatch.at) : "—"],
            ].map(([label, value]) => (
              <Box key={label} sx={{ p: 1.25, borderRadius: "7px", bgcolor: C.bg, border: `1px solid ${C.border}` }}>
                <Box sx={{ color: C.muted, fontSize: 11.5 }}>{label}</Box>
                <Box sx={{ mt: .25, color: C.navy, fontWeight: 700, overflowWrap: "anywhere" }}>{value}</Box>
              </Box>
            ))}
          </Box>
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
