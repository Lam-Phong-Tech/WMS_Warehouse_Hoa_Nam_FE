import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiSelect,
  UiSpinner,
  UiVuexyDateRangePicker,
} from "@/shared/ui";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  InboxOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { WarrantyDetailModal } from "@/modules/warranty/components/WarrantyDetailModal";
import { ComponentIssueModal } from "@/modules/warranty/components/ComponentIssueModal";
import { useWarrantyReport } from "@/modules/reports/operations/report-data";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import { useReportExport } from "@/modules/reports/operations/report-export";
import { useClientPagination } from "@/modules/reports/operations/report-columns";
import {
  fmt,
  fmtDate,
  listOf,
  text,
} from "@/modules/reports/operations/report-format";
import { useT } from "@/shared/i18n/useT";
import { tStatic as tUi } from "@/shared/i18n/useT";

const C = {
  navy: "var(--ops-heading)",
  navyDark: "var(--ops-heading)",
  ocean: "var(--ops-primary)",
  oceanDark: "var(--ops-primary-hover)",
  cyan: "var(--ops-link)",
  cyanSoft: "var(--ops-pale)",
  border: "var(--ops-line)",
  borderStrong: "var(--ops-line)",
  text: "var(--ops-text)",
  muted: "var(--ops-muted)",
  bg: "var(--ops-canvas)",
  green: "var(--ops-success)",
  greenSoft: "var(--ops-success-soft)",
  orange: "var(--ops-warning)",
  orangeSoft: "var(--ops-warning-soft)",
  red: "var(--ops-danger)",
  redSoft: "var(--ops-danger-soft)",
  skeleton: "var(--ops-line)",
} as const;

const surface = {
  border: "1px solid " + C.border,
  borderRadius: "var(--ops-radius-card)",
  bgcolor: "var(--ops-surface)",
  boxShadow: "0 1px 2px rgba(0,78,116,.035)",
} as const;

type UiStatus = "complete" | "processing" | "waiting";
type UiRow = {
  id: string;
  caseNo: string;
  serial: string;
  skuCode: string;
  skuName: string;
  component: string;
  receivedAt: string;
  dueDate: string;
  status: UiStatus;
  statusLabel: string;
  overdueDays: number;
};

type ForcedState =
  | "loading"
  | "refreshing"
  | "empty"
  | "no-result"
  | "error"
  | "offline"
  | "partial"
  | "invalid-date"
  | "export-failed"
  | "exporting"
  | "export-success"
  | "export-unknown"
  | "detail-processing"
  | "detail-error"
  | null;

function mapStatus(value: string): UiStatus {
  const normalized = value.toUpperCase();
  if (["COMPLETED", "RETURNED", "DONE", "CLOSED"].includes(normalized))
    return "complete";
  if (["RECEIVED", "WAITING", "PENDING", "NEW"].includes(normalized))
    return "waiting";
  return "processing";
}

function labelOf(status: UiStatus): string {
  if (status === "complete") return tUi("iam.permissionAction.post");
  if (status === "waiting") return tUi("updatedUi.text_d3db3ce66df9");
  return tUi("dashboard.snapshot.stateProcessing");
}

function normalizeRows(payload: unknown): UiRow[] {
  return listOf((payload as { rows?: unknown } | undefined)?.rows).map(
    (row, index) => {
      const rawStatus = text(row.status, "");
      const status = mapStatus(rawStatus);
      const dueDate = text(row.estimated_completion_date ?? row.due_date, "");
      const overdueDays =
        status !== "complete" &&
        dueDate &&
        dayjs(dueDate).isValid() &&
        dayjs(dueDate).isBefore(dayjs(), "day")
          ? Math.max(
              1,
              dayjs().startOf("day").diff(dayjs(dueDate).startOf("day"), "day"),
            )
          : 0;
      return {
        id: text(row.warranty_case_id ?? row.id, String(index)),
        caseNo: text(row.case_no ?? row.warranty_case_code, "—"),
        serial: text(row.serial_no ?? row.serial ?? row.serial_number, "—"),
        skuCode: text(row.model ?? row.sku_code, "—"),
        skuName: text(row.sku_name ?? row.product_name, "—"),
        component: text(
          row.components_issued ??
            row.component_name ??
            row.component ??
            row.defect ??
            row.defect_name,
          "—",
        ),
        receivedAt: text(row.received_at ?? row.created_at, ""),
        dueDate,
        status,
        statusLabel: labelOf(status),
        overdueDays,
      };
    },
  );
}

function pct(value: number, total: number): string {
  if (!total) return "—";
  return ((value / total) * 100).toFixed(1).replace(".", ",") + "%";
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        mb: 0.4,
        color: C.text,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: "17px",
      }}
    >
      {children}
    </Box>
  );
}

function SkeletonLine({
  width,
  height = 12,
}: {
  width: string | number;
  height?: number;
}) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width,
        height,
        borderRadius: "var(--ops-radius-control)",
        bgcolor: C.skeleton,
        backgroundImage:
          "linear-gradient(90deg, rgba(211,225,239,.8), rgba(239,246,251,.96), rgba(211,225,239,.8))",
        backgroundSize: "220% 100%",
        animation: "hnWarrantySkeleton 1.35s ease-in-out infinite",
      }}
    />
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  hint: ReactNode;
  icon: ReactNode;
  tone: "primary" | "success" | "info" | "warning";
  loading?: boolean;
}) {
  const palette = {
    primary: { fg: C.navy, bg: C.cyanSoft },
    success: { fg: C.green, bg: C.greenSoft },
    info: { fg: "#087dca", bg: "#e9f7fd" },
    warning: { fg: C.orange, bg: C.orangeSoft },
  }[tone];
  return (
    <Box
      sx={{
        ...surface,
        minHeight: { xs: 106, md: 108 },
        px: { xs: 1.35, md: 1.5 },
        py: 1.1,
        display: "grid",
        gridTemplateColumns: "52px minmax(0,1fr)",
        gap: 1.25,
        alignItems: "center",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 50,
          height: 50,
          borderRadius: "var(--ops-radius-card)",
          display: "grid",
          placeItems: "center",
          bgcolor: palette.bg,
          color: palette.fg,
          fontSize: 25,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            color: C.text,
            fontSize: 12.5,
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {label}
        </Box>
        {loading ? (
          <Box sx={{ mt: 0.8, display: "grid", gap: 0.75 }}>
            <SkeletonLine width="58%" height={30} />
            <SkeletonLine width="72%" height={14} />
          </Box>
        ) : (
          <>
            <Box
              sx={{
                mt: 0.18,
                color: C.navy,
                fontSize: "clamp(28px,2vw,34px)",
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-.025em",
              }}
            >
              {value}
            </Box>
            <Box
              sx={{
                mt: 0.3,
                color: palette.fg,
                fontSize: 11.75,
                lineHeight: 1.2,
              }}
            >
              {hint}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

function StatusPill({ row }: { row: UiRow }) {
  const palette =
    row.status === "complete"
      ? { bg: C.greenSoft, fg: "#16833e" }
      : row.status === "waiting"
        ? { bg: C.orangeSoft, fg: "#c86a00" }
        : { bg: "#e5f5fc", fg: "#0874b7" };
  return (
    <Box sx={{ display: "grid", justifyItems: "center", gap: 0.1 }}>
      <Box
        sx={{
          minWidth: 124,
          px: 1.1,
          py: 0.32,
          borderRadius: 999,
          bgcolor: palette.bg,
          color: palette.fg,
          textAlign: "center",
          fontSize: 11.5,
        }}
      >
        {row.statusLabel}
      </Box>
      {row.overdueDays > 0 ? (
        <Box sx={{ color: C.red, fontSize: 10.5 }}>
          {tUi("dashboard.snapshot.stateOverdue") + " "}
          {row.overdueDays}
          {" " + tUi("reports.agencyComparison.unitDay")}
        </Box>
      ) : null}
    </Box>
  );
}

function EmptyState({ noResult }: { noResult: boolean }) {
  return (
    <Box
      sx={{
        minHeight: 245,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        px: 3,
      }}
    >
      <Box>
        {!noResult ? (
          <Box sx={{ color: "var(--ops-muted)", fontSize: 48, mb: 0.75 }}>
            <InboxOutlined />
          </Box>
        ) : null}
        <Box sx={{ color: C.navy, fontSize: 19, fontWeight: 800 }}>
          {noResult
            ? tUi("updatedUi.text_8a0dfd2bc403")
            : tUi("updatedUi.text_e1e7a06bd009")}
        </Box>
        <Box sx={{ mt: 0.55, color: C.muted, fontSize: 13 }}>
          {noResult
            ? tUi("updatedUi.text_3bbb177609bb")
            : tUi("updatedUi.text_eeffc0b6b7ba")}
        </Box>
        {!noResult ? (
          <Box sx={{ mt: 0.2, color: C.muted, fontSize: 13 }}>
            {tUi("updatedUi.text_cde9d2ff0b9b")}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function FailurePanel({
  offline,
  retry,
}: {
  offline: boolean;
  retry: () => void;
}) {
  return (
    <Box
      sx={{
        ...surface,
        minHeight: 330,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        px: 3,
      }}
    >
      <Box>
        <Box
          sx={{
            mx: "auto",
            mb: 1.15,
            width: 72,
            height: 72,
            display: "grid",
            placeItems: "center",
            borderRadius: "10px",
            bgcolor: offline ? "var(--ops-canvas)" : C.redSoft,
            color: offline ? "var(--ops-muted)" : C.red,
            fontSize: 40,
          }}
        >
          {offline ? <SyncOutlined /> : <WarningOutlined />}
        </Box>
        <Box sx={{ color: C.navy, fontSize: 25, fontWeight: 800 }}>
          {offline
            ? tUi("updatedUi.text_ce0ba8d55ff5")
            : tUi("dashboard.alert.failedBadge")}
        </Box>
        <Box sx={{ mt: 0.55, color: C.muted, fontSize: 14 }}>
          {offline
            ? tUi("updatedUi.text_3ad5d030ccde")
            : tUi("updatedUi.text_746ce26e0f2a")}
        </Box>
        {!offline ? (
          <UiButton appearance="filled" sx={{ mt: 1.8 }} onClick={retry}>
            {tUi("common.retry")}
          </UiButton>
        ) : null}
      </Box>
    </Box>
  );
}

export default function WarrantyComponentsReport() {
  const t = useT();
  const presets = useMemo(() => reportRangePresets(t), [t]);
  const forcedState = useMemo<ForcedState>(() => {
    const value = new URLSearchParams(window.location.search).get("state");
    const supported = new Set([
      "loading",
      "refreshing",
      "empty",
      "no-result",
      "error",
      "offline",
      "partial",
      "invalid-date",
      "export-failed",
      "exporting",
      "export-success",
      "export-unknown",
      "detail-processing",
      "detail-error",
    ]);
    return supported.has(value ?? "") ? (value as ForcedState) : null;
  }, []);

  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs("2026-09-04"),
    dayjs("2026-09-10"),
  ]);
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState(
    forcedState === "no-result" ? "abcxyz" : "",
  );
  const [online, setOnline] = useState(() => navigator.onLine);
  const [detailBusyId, setDetailBusyId] = useState<string | null>(null);
  const [detailErrorId, setDetailErrorId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [componentTarget, setComponentTarget] = useState<{
    caseId: string;
    caseCode?: string;
    caseActive: boolean;
    documentId?: string | null;
  } | null>(null);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const from = range[0].format("YYYY-MM-DD");
  const to = range[1].format("YYYY-MM-DD");
  const invalid =
    range[0].isAfter(range[1], "day") || forcedState === "invalid-date";
  const source = useWarrantyReport({
    from,
    to,
    enabled:
      !invalid &&
      online &&
      forcedState !== "offline" &&
      forcedState !== "error",
  });
  const exporter = useReportExport();

  const apiRows = useMemo(() => normalizeRows(source.data), [source.data]);
  const rows = forcedState === "empty" ? [] : apiRows;
  const loading = source.isLoading || forcedState === "loading";
  const refreshing =
    (!loading && source.isFetching) || forcedState === "refreshing";
  const offline = !online || forcedState === "offline";
  const hardError =
    forcedState === "error" ||
    (source.isError && rows.length === 0 && !offline);
  const partial =
    forcedState === "partial" || (source.isError && rows.length > 0);

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!q) return true;
      return [row.caseNo, row.serial, row.skuCode, row.skuName, row.component]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(q);
    });
  }, [rows, status, keyword]);

  const complete = rows.filter((row) => row.status === "complete").length;
  const waiting = rows.filter((row) => row.status === "waiting").length;
  const processing = Math.max(0, rows.length - complete - waiting);
  const unfinished = processing + waiting;
  const overdue = rows.filter((row) => row.overdueDays > 0).length;
  const completionPct = rows.length ? (complete / rows.length) * 100 : 0;
  const processingPct = rows.length ? (processing / rows.length) * 100 : 0;
  const waitingPct = rows.length ? (waiting / rows.length) * 100 : 0;
  const pagination = useClientPagination(filteredRows, 5);
  const lastPage = Math.max(
    1,
    Math.ceil(pagination.total / pagination.perPage),
  );

  useEffect(() => {
    pagination.reset();
  }, [status, keyword]);

  const resetFilters = () => {
    setRange([dayjs("2026-09-04"), dayjs("2026-09-10")]);
    setStatus("");
    setKeyword("");
    pagination.reset();
  };

  const exportXlsx = () => {
    void exporter.exportReport("xlsx", {
      reportCode: "warranty-defects",
      fileStem: "bao-cao-bao-hanh",
      fileSuffix: "-" + from + "-" + to,
      filters: {
        from_date: from,
        to_date: to,
        ...(status ? { status } : {}),
        ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      },
    });
  };

  const exporting =
    exporter.exporting === "xlsx" || forcedState === "exporting";
  const exportFailed = forcedState === "export-failed";
  const exportSuccess = forcedState === "export-success";
  const exportUnknown = forcedState === "export-unknown";

  const openDetail = (row: UiRow) => {
    setDetailErrorId(null);
    setDetailBusyId(row.id);
    setDetailId(row.id);
  };

  const effectiveBusyId =
    forcedState === "detail-processing" && filteredRows[0]
      ? filteredRows[0].id
      : detailBusyId;
  const effectiveDetailError =
    forcedState === "detail-error" && filteredRows[0]
      ? filteredRows[0].caseNo
      : detailErrorId;

  const pageNumbers = useMemo(() => {
    if (lastPage <= 3)
      return Array.from({ length: lastPage }, (_, index) => index + 1);
    if (pagination.page <= 2) return [1, 2, 3];
    if (pagination.page >= lastPage - 1)
      return [lastPage - 2, lastPage - 1, lastPage];
    return [pagination.page - 1, pagination.page, pagination.page + 1];
  }, [lastPage, pagination.page]);

  return (
    <Box
      data-testid="report-07-warranty-components"
      data-report-screen="RPT-06"
      sx={{
        width: "100%",
        minWidth: 0,
        color: C.text,
        display: "grid",
        gap: { xs: 1, md: 1.1 },
        pb: 2.5,
        fontSize: { xs: 12.5, md: 13 },
        "& *": { boxSizing: "border-box" },
        "@keyframes hnWarrantySkeleton": {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
        "& .hn-vuexy-date-range.ant-picker": {
          minHeight: "var(--ops-control-height)",
          borderColor: invalid ? C.red : C.ocean,
          borderRadius: "var(--ops-radius-control)",
          boxShadow: "none",
          color: C.text,
          bgcolor: "var(--ops-surface)",
        },
        "& .hn-vuexy-date-range.ant-picker:hover": {
          borderColor: invalid ? C.red : C.oceanDark,
        },
        "& .hn-vuexy-date-range.ant-picker-focused": {
          borderColor: invalid ? C.red : C.ocean,
          boxShadow: invalid
            ? "0 0 0 2px rgba(245,34,45,.10)"
            : "0 0 0 2px rgba(0,108,168,.12)",
        },
        "& .hn-vuexy-date-range .ant-picker-active-bar": {
          background: C.ocean,
        },
        "& .warranty-tablet-only": { display: "none" },
        "@media (max-width:1100px)": {
          "& .warranty-desktop-only": { display: "none" },
          "& .warranty-tablet-only": { display: "table-cell" },
        },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "flex-end" },
          gap: 1.2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>
            {tUi("updatedUi.text_a274c3357d1a")}
          </Box>
          <Box
            component="h1"
            className="hn-report-page-title"
            sx={{
              m: 0,
              mt: 0.25,
              color: C.navy,
              fontSize: 24,
              lineHeight: "38px",
              letterSpacing: "-.028em",
              fontWeight: 700,
            }}
          >
            {tUi("updatedUi.text_cec73d47ebd3")}
          </Box>
          <Box
            sx={{
              mt: 0.15,
              color: "var(--ops-link)",
              fontSize: { xs: 12.75, md: 13.5 },
              lineHeight: 1.3,
            }}
          >
            {tUi("updatedUi.text_af670993f5f4")}
          </Box>
        </Box>
        <Stack
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
            disabled={invalid || loading || offline}
            onClick={exportXlsx}
          >
            {exporting
              ? tUi("outbound.detail.preparing")
              : tUi("reports.traceability.exportReport")}
          </UiButton>
        </Stack>
      </Stack>

      {offline ? (
        <UiAlert tone="warning">{tUi("updatedUi.text_793312837e7f")}</UiAlert>
      ) : null}

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
              sm: "repeat(2,minmax(0,1fr))",
              lg: "1.2fr 1.05fr .9fr 1.1fr auto auto",
            },
            gap: { xs: 1, md: 1.05 },
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
              presets={presets}
              className="hn-vuexy-date-range"
              popupClassName="hn-vuexy-date-popup"
              onChange={(value) => {
                if (value?.[0] && value?.[1]) {
                  setRange([value[0], value[1]]);
                  pagination.reset();
                }
              }}
            />
            <Box
              sx={{
                mt: 0.35,
                color: invalid ? C.red : "var(--ops-muted)",
                fontSize: 10.8,
              }}
            >
              {invalid
                ? tUi("dashboard.dateError.order")
                : tUi("updatedUi.text_1af3943a0084")}
            </Box>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>{tUi("updatedUi.text_19c608bfa103")}</FilterLabel>
            <Box
              aria-label="Kho Hoa Nam"
              sx={{
                minHeight: "var(--ops-control-height)",
                px: 1.35,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                border: "1px solid " + C.border,
                borderRadius: "var(--ops-radius-control)",
                bgcolor: "var(--ops-canvas)",
                color: C.muted,
                fontWeight: 650,
              }}
            >
              ◇ <Box component="span">Kho Hoa Nam</Box>
            </Box>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>{tUi("dashboard.composition.colStatus")}</FilterLabel>
            <UiSelect
              fullWidth
              aria-label={tUi("dashboard.composition.colStatus")}
              value={status}
              placeholder={tUi("dashboard.operations.filterAll")}
              menuClassName="rpt06-select-menu"
              searchable={false}
              onChange={setStatus}
              options={[
                { value: "complete", label: tUi("iam.permissionAction.post") },
                {
                  value: "processing",
                  label: tUi("dashboard.snapshot.stateProcessing"),
                },
                { value: "waiting", label: tUi("updatedUi.text_d3db3ce66df9") },
              ]}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>{tUi("reports.packingLabel.searchLabel")}</FilterLabel>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label={tUi("updatedUi.text_b9892e42c46b")}
              placeholder={tUi("updatedUi.text_71da4c0795f3")}
              onChange={(value) => setKeyword(value)}
            />
          </Box>
          <UiButton
            appearance="filled"
            disabled={invalid || loading}
            onClick={() => pagination.reset()}
          >
            {tUi("dashboard.snapshot.apply")}
          </UiButton>
          <UiButton appearance="text" onClick={resetFilters}>
            {tUi("reports.packingLabel.reset")}
          </UiButton>
        </Box>

        {exporting ? (
          <Box sx={{ mt: 0.75 }}>
            <UiAlert tone="info">{tUi("updatedUi.text_c4136b7b0b71")}</UiAlert>
          </Box>
        ) : exportFailed ? (
          <Box sx={{ mt: 0.75 }}>
            <UiAlert tone="error">{tUi("updatedUi.text_f2af03f694e3")}</UiAlert>
          </Box>
        ) : exportSuccess ? (
          <Box sx={{ mt: 0.75 }}>
            <UiAlert tone="success">
              {tUi("updatedUi.text_a808b9e33648")}
            </UiAlert>
          </Box>
        ) : exportUnknown ? (
          <Box sx={{ mt: 0.75 }}>
            <UiAlert tone="warning">
              {tUi("updatedUi.text_4d900e9a46cd")}
            </UiAlert>
          </Box>
        ) : null}
      </Box>

      {hardError || offline ? (
        <FailurePanel offline={offline} retry={() => void source.refetch()} />
      ) : (
        <>
          {partial ? (
            <UiAlert tone="warning">
              {tUi("updatedUi.text_3349b06e35cf")}
            </UiAlert>
          ) : null}

          <Box
            component="section"
            aria-label={tUi("dashboard.title")}
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2,minmax(0,1fr))",
                xl: "repeat(4,minmax(0,1fr))",
              },
              gap: 1,
            }}
          >
            <MetricCard
              label={tUi("updatedUi.text_2d173f0e4679")}
              value={fmt(rows.length)}
              hint="Phiếu trong kỳ"
              tone="primary"
              icon={<FileTextOutlined />}
              loading={loading}
            />
            <MetricCard
              label={tUi("iam.permissionAction.post")}
              value={fmt(complete)}
              hint={
                pct(complete, rows.length) +
                " " +
                tUi("updatedUi.text_9871199f609c")
              }
              tone="success"
              icon={<CheckCircleOutlined />}
              loading={loading}
            />
            <MetricCard
              label={tUi("dashboard.snapshot.stateProcessing")}
              value={fmt(processing)}
              hint={
                pct(processing, rows.length) +
                " " +
                tUi("updatedUi.text_9871199f609c")
              }
              tone="info"
              icon={<SyncOutlined />}
              loading={loading}
            />
            <MetricCard
              label={tUi("updatedUi.text_d3db3ce66df9")}
              value={fmt(waiting)}
              hint={
                pct(waiting, rows.length) +
                " " +
                tUi("updatedUi.text_9871199f609c")
              }
              tone="warning"
              icon={<ReloadOutlined />}
              loading={loading}
            />
          </Box>

          <Box
            component="section"
            sx={{ ...surface, p: { xs: 1.35, md: 1.5 } }}
          >
            <Stack
              direction={{ xs: "column", lg: "row" }}
              sx={{
                alignItems: { xs: "stretch", lg: "center" },
                gap: { xs: 1.4, lg: 2 },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Box
                    component="h2"
                    sx={{ m: 0, color: C.navy, fontSize: 18, fontWeight: 600 }}
                  >
                    {tUi("updatedUi.text_39e4ce8fcc3c")}
                  </Box>
                  {refreshing ? (
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: "center",
                        gap: 0.65,
                        color: "var(--ops-link)",
                        fontSize: 11.5,
                      }}
                    >
                      <UiSpinner size={15} label={null} />
                      {" " + tUi("updatedUi.text_0c576314af49")}
                    </Stack>
                  ) : partial ? (
                    <Box
                      sx={{
                        px: 0.85,
                        py: 0.2,
                        borderRadius: 999,
                        bgcolor: "#fff1d8",
                        color: "#b86100",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {tUi("updatedUi.text_ebc5a4d489c7")}
                    </Box>
                  ) : null}
                </Stack>

                {partial ? (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    sx={{
                      alignItems: { xs: "stretch", sm: "center" },
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: "center",
                        gap: 0.8,
                        color: C.red,
                        fontSize: 13,
                      }}
                    >
                      <WarningOutlined />
                      {" " + tUi("updatedUi.text_3b3783c0c827")}
                    </Stack>
                    <UiButton
                      appearance="filled"
                      startIcon={<ReloadOutlined />}
                      onClick={() => void source.refetch()}
                    >
                      {tUi("shared.address.retry")}
                    </UiButton>
                  </Stack>
                ) : loading ? (
                  <Box sx={{ display: "grid", gap: 0.8 }}>
                    <SkeletonLine width="85%" height={32} />
                    <Stack direction="row" sx={{ gap: 2.2 }}>
                      <SkeletonLine width="24%" height={12} />
                      <SkeletonLine width="24%" height={12} />
                      <SkeletonLine width="24%" height={12} />
                    </Stack>
                  </Box>
                ) : (
                  <>
                    <Box
                      aria-label={
                        tUi("iam.permissionAction.post") +
                        " " +
                        pct(complete, rows.length)
                      }
                      sx={{
                        height: 36,
                        display: "flex",
                        overflow: "hidden",
                        borderRadius: "var(--ops-radius-control)",
                        bgcolor: "var(--ops-line)",
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    >
                      <Box
                        sx={{
                          width: completionPct + "%",
                          minWidth: complete ? 40 : 0,
                          display: "grid",
                          placeItems: "center",
                          bgcolor: C.green,
                        }}
                      >
                        {complete || ""}
                      </Box>
                      <Box
                        sx={{
                          width: processingPct + "%",
                          minWidth: processing ? 40 : 0,
                          display: "grid",
                          placeItems: "center",
                          bgcolor: "#18a0d5",
                        }}
                      >
                        {processing || ""}
                      </Box>
                      <Box
                        sx={{
                          width: waitingPct + "%",
                          minWidth: waiting ? 40 : 0,
                          display: "grid",
                          placeItems: "center",
                          bgcolor: "#ff9528",
                        }}
                      >
                        {waiting || ""}
                      </Box>
                    </Box>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      sx={{
                        mt: 0.85,
                        gap: { xs: 0.5, sm: 2.8 },
                        flexWrap: "wrap",
                      }}
                    >
                      <Box sx={{ fontSize: 11.5 }}>
                        <Box component="span" sx={{ color: C.green }}>
                          ●
                        </Box>
                        {"  " + tUi("updatedUi.text_5fc81d24b14c")}
                        {complete}) &nbsp;
                        <b>{pct(complete, rows.length)}</b>
                      </Box>
                      <Box sx={{ fontSize: 11.5 }}>
                        <Box component="span" sx={{ color: "#18a0d5" }}>
                          ●
                        </Box>
                        {"  " + tUi("updatedUi.text_58d81071493e")}
                        {processing}) &nbsp;
                        <b>{pct(processing, rows.length)}</b>
                      </Box>
                      <Box sx={{ fontSize: 11.5 }}>
                        <Box component="span" sx={{ color: "#ff9528" }}>
                          ●
                        </Box>
                        {"  " + tUi("updatedUi.text_0fb0f8863bb6")}
                        {waiting}) &nbsp;
                        <b>{pct(waiting, rows.length)}</b>
                      </Box>
                    </Stack>
                  </>
                )}
              </Box>

              {!partial ? (
                <>
                  <Box
                    sx={{
                      minWidth: { xs: 0, lg: 180 },
                      py: { xs: 0, lg: 0.7 },
                      px: { xs: 0, lg: 2 },
                      borderLeft: { xs: 0, lg: "1px solid " + C.border },
                      textAlign: "center",
                    }}
                  >
                    {loading ? (
                      <SkeletonLine width="80%" height={56} />
                    ) : (
                      <>
                        <Box
                          sx={{
                            color: C.green,
                            fontSize: 36,
                            lineHeight: 1,
                            fontWeight: 800,
                          }}
                        >
                          {pct(complete, rows.length)}
                        </Box>
                        <Box sx={{ mt: 0.35, color: C.text, fontSize: 12.5 }}>
                          {tUi("updatedUi.text_13625dbf64fd")}
                        </Box>
                      </>
                    )}
                  </Box>
                  <Box
                    sx={{
                      minWidth: { xs: 0, lg: 260 },
                      p: 1.25,
                      display: "grid",
                      gridTemplateColumns: "58px 1fr",
                      gap: 1,
                      alignItems: "center",
                      borderRadius: "7px",
                      bgcolor: C.redSoft,
                    }}
                  >
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: "var(--ops-radius-card)",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "#ffe3e5",
                        color: C.red,
                        fontSize: 28,
                      }}
                    >
                      <WarningOutlined />
                    </Box>
                    {loading ? (
                      <Box sx={{ display: "grid", gap: 0.65 }}>
                        <SkeletonLine width="80%" height={16} />
                        <SkeletonLine width="72%" height={12} />
                      </Box>
                    ) : (
                      <Box>
                        <Box
                          sx={{ color: C.red, fontSize: 19, fontWeight: 800 }}
                        >
                          {overdue}
                          {" " + tUi("updatedUi.text_9f85e38f3fff")}
                        </Box>
                        <Box sx={{ mt: 0.2, color: C.muted, fontSize: 11.5 }}>
                          {tUi("updatedUi.text_c304748868e0") + " "}
                          {unfinished}
                          {" " + tUi("updatedUi.text_6703ab94972c")}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </>
              ) : null}
            </Stack>
          </Box>

          <Box component="section" sx={{ ...surface, overflow: "hidden" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                px: { xs: 1.2, md: 1.45 },
                pt: 1,
                pb: 0.65,
                alignItems: { xs: "stretch", sm: "center" },
                justifyContent: "space-between",
                gap: 0.85,
              }}
            >
              <Stack
                direction="row"
                sx={{ alignItems: "center", gap: 0.75, flexWrap: "wrap" }}
              >
                <Box
                  component="h2"
                  sx={{ m: 0, color: C.navy, fontSize: 18, fontWeight: 600 }}
                >
                  {tUi("updatedUi.text_c62ca4dc7b07")}
                </Box>
                <Box
                  sx={{
                    px: 0.9,
                    py: 0.2,
                    borderRadius: 999,
                    bgcolor: C.cyanSoft,
                    color: C.navy,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {forcedState === "no-result"
                    ? tUi("updatedUi.text_f3674c04b5e8") +
                      " " +
                      fmt(rows.length) +
                      " " +
                      tUi("updatedUi.text_20d8a6e7893b")
                    : fmt(rows.length)}
                </Box>
                {loading ? (
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: "center",
                      gap: 0.5,
                      color: "var(--ops-link)",
                      fontSize: 11.5,
                    }}
                  >
                    <UiSpinner size={15} label={null} />
                    {" " + tUi("masterData.common.loadingData")}
                  </Stack>
                ) : null}
              </Stack>
              <Box sx={{ width: { xs: "100%", sm: 290, lg: 330 } }}>
                <SearchInput
                  width="100%"
                  value={keyword}
                  aria-label={tUi("updatedUi.text_3f7976cb08ea")}
                  placeholder={tUi("updatedUi.text_451efe6a12da")}
                  onChange={(value) => setKeyword(value)}
                />
              </Box>
            </Stack>

            {effectiveDetailError ? (
              <Box sx={{ px: 1.2, pb: 0.75 }}>
                <UiAlert tone="error">
                  <b>{effectiveDetailError}</b>
                  {"  " + tUi("updatedUi.text_b31b4145e6d2")}
                </UiAlert>
              </Box>
            ) : null}

            <Box sx={{ px: { xs: 0.9, md: 1.2 } }}>
              <Box
                sx={{
                  overflowX: "auto",
                  border: "1px solid " + C.border,
                  borderRadius: "var(--ops-radius-control)",
                }}
              >
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    minWidth: { xs: 760, md: 980 },
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                    color: C.text,
                    "& th": {
                      bgcolor: "var(--ops-pale)",
                      color: "var(--ops-link)",
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: "left",
                      px: 1.15,
                      py: 0.72,
                      borderRight: "1px solid " + C.border,
                      borderBottom: "1px solid " + C.border,
                    },
                    "& td": {
                      px: 1.15,
                      py: 0.62,
                      fontSize: 12,
                      lineHeight: 1.25,
                      verticalAlign: "middle",
                      borderRight: "1px solid " + C.border,
                      borderBottom: "1px solid " + C.border,
                    },
                    "& tr:last-child td": { borderBottom: 0 },
                    "& th:last-child, & td:last-child": { borderRight: 0 },
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ width: 46 }}>
                        <input
                          type="checkbox"
                          aria-label={tUi(
                            "reports.agencyComparison.pickerSelectAll",
                          )}
                        />
                      </th>
                      <th style={{ width: 178 }}>
                        {tUi("updatedUi.text_922013da333f")}
                      </th>
                      <th style={{ width: 195 }}>
                        {tUi("updatedUi.text_100237901dd9")}
                      </th>
                      <th style={{ width: 170 }}>
                        {tUi("updatedUi.text_6a91c6be24df")}
                      </th>
                      <th
                        className="warranty-desktop-only"
                        style={{ width: 145 }}
                      >
                        {tUi("warranty.detail.fieldReceivedAt")}
                      </th>
                      <th
                        className="warranty-desktop-only"
                        style={{ width: 145 }}
                      >
                        {tUi("updatedUi.text_61151ea4d85c")}
                      </th>
                      <th
                        className="warranty-tablet-only"
                        style={{ width: 150 }}
                      >
                        {tUi("updatedUi.text_2a2f8a4381c7")}
                      </th>
                      <th style={{ width: 155 }}>
                        {tUi("dashboard.composition.colStatus")}
                      </th>
                      <th style={{ width: 92 }}>
                        {tUi("reports.importMatchReport.detail")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={"skeleton-" + index}>
                          <td>
                            <input
                              type="checkbox"
                              disabled
                              aria-label={
                                tUi("updatedUi.text_42c8e174b25a") +
                                " " +
                                (index + 1)
                              }
                            />
                          </td>
                          <td>
                            <SkeletonLine width="80%" />
                            <Box sx={{ mt: 0.5 }}>
                              <SkeletonLine width="66%" height={9} />
                            </Box>
                          </td>
                          <td>
                            <SkeletonLine width="78%" />
                            <Box sx={{ mt: 0.5 }}>
                              <SkeletonLine width="65%" height={9} />
                            </Box>
                          </td>
                          <td>
                            <SkeletonLine width="68%" />
                          </td>
                          <td className="warranty-desktop-only">
                            <SkeletonLine width="64%" />
                          </td>
                          <td className="warranty-desktop-only">
                            <SkeletonLine width="64%" />
                          </td>
                          <td className="warranty-tablet-only">
                            <SkeletonLine width="68%" />
                            <Box sx={{ mt: 0.5 }}>
                              <SkeletonLine width="62%" height={9} />
                            </Box>
                          </td>
                          <td>
                            <SkeletonLine width="80%" height={22} />
                          </td>
                          <td>
                            <Box sx={{ color: C.muted }}>Xem&nbsp;&nbsp;›</Box>
                          </td>
                        </tr>
                      ))
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ borderRight: 0 }}>
                          <EmptyState noResult={rows.length > 0} />
                        </td>
                      </tr>
                    ) : (
                      pagination.pageRows.map((row) => (
                        <tr id={"warranty-row-" + row.id} key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={
                                tUi("shared.table.selectRow") + " " + row.caseNo
                              }
                            />
                          </td>
                          <td>
                            <Box sx={{ color: C.navy, fontWeight: 800 }}>
                              {row.caseNo}
                            </Box>
                            <Box
                              sx={{
                                mt: 0.08,
                                color: "var(--ops-link)",
                                fontSize: 10.5,
                              }}
                            >
                              {row.serial}
                            </Box>
                          </td>
                          <td className="warranty-sku-cell">
                            <Box
                              title={row.skuCode}
                              sx={{
                                display: "block",
                                width: "100%",
                                maxWidth: "100%",
                                overflow: "hidden",
                                color: C.navy,
                                fontWeight: 800,
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.skuCode}
                            </Box>
                            <Box
                              title={row.skuName}
                              sx={{
                                display: "block",
                                width: "100%",
                                maxWidth: "100%",
                                mt: 0.08,
                                overflow: "hidden",
                                color: C.muted,
                                fontSize: 10.5,
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.skuName}
                            </Box>
                          </td>
                          <td>
                            <Box
                              className="warranty-component-cell"
                              title={row.component}
                              sx={{
                                display: "block",
                                width: "100%",
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.component}
                            </Box>
                          </td>
                          <td className="warranty-desktop-only">
                            {row.receivedAt ? fmtDate(row.receivedAt) : "—"}
                          </td>
                          <td className="warranty-desktop-only">
                            {row.dueDate ? fmtDate(row.dueDate) : "—"}
                          </td>
                          <td className="warranty-tablet-only">
                            <Box>
                              {row.receivedAt ? fmtDate(row.receivedAt) : "—"}
                            </Box>
                            <Box sx={{ mt: 0.08, color: C.muted }}>
                              {row.dueDate ? fmtDate(row.dueDate) : "—"}
                            </Box>
                          </td>
                          <td>
                            <StatusPill row={row} />
                          </td>
                          <td>
                            <RowActionGroup>
                              <RowActionButton
                                kind="view"
                                disabled={effectiveBusyId === row.id}
                                onClick={() => openDetail(row)}
                                loading={effectiveBusyId === row.id}
                              >
                                Xem
                              </RowActionButton>
                            </RowActionGroup>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Box>
              </Box>
            </Box>

            <Stack
              className="hn-report-pagination-footer"
              direction={{ xs: "column", sm: "row" }}
              sx={{
                px: { xs: 1.2, md: 1.45 },
                py: 1.05,
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
                –
                {Math.min(
                  pagination.page * pagination.perPage,
                  pagination.total,
                )}{" "}
                / {fmt(pagination.total)}
                {" " + tUi("updatedUi.text_20d8a6e7893b")}
              </Box>
              <Stack
                className="rpt06-pagination hn-report-pagination"
                direction="row"
                sx={{
                  gap: 0.45,
                  alignItems: "center",
                  justifyContent: { xs: "flex-end", sm: "center" },
                  flexWrap: "wrap",
                }}
              >
                <UiButton
                  appearance="outlined"
                  disabled={pagination.page <= 1 || pagination.total === 0}
                  onClick={() =>
                    pagination.setPage(Math.max(1, pagination.page - 1))
                  }
                >
                  ‹
                </UiButton>
                {pageNumbers.map((page) => (
                  <UiButton
                    key={page}
                    appearance={
                      page === pagination.page ? "filled" : "outlined"
                    }
                    onClick={() => pagination.setPage(page)}
                  >
                    {page}
                  </UiButton>
                ))}
                {lastPage > 4 && pagination.page < lastPage - 2 ? (
                  <Box sx={{ px: 0.35 }}>…</Box>
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
                  disabled={
                    pagination.page >= lastPage || pagination.total === 0
                  }
                  onClick={() =>
                    pagination.setPage(Math.min(lastPage, pagination.page + 1))
                  }
                >
                  ›
                </UiButton>
              </Stack>
              <Box
                sx={{
                  color: "var(--ops-link)",
                  fontSize: 11.5,
                  textAlign: { xs: "right", sm: "left" },
                }}
              >
                {range[0].format("DD/MM/YYYY")}–{range[1].format("DD/MM/YYYY")}
              </Box>
            </Stack>
          </Box>
        </>
      )}

      {detailId ? (
        <WarrantyDetailModal
          caseId={detailId}
          onClose={() => {
            setDetailId(null);
            setDetailBusyId(null);
          }}
          onOpenComponentIssue={(target) => setComponentTarget(target)}
        />
      ) : null}

      {componentTarget ? (
        <ComponentIssueModal
          caseId={componentTarget.caseId}
          caseCode={componentTarget.caseCode}
          caseActive={componentTarget.caseActive}
          documentId={componentTarget.documentId}
          onClose={() => setComponentTarget(null)}
          onChanged={() => void source.refetch()}
        />
      ) : null}
    </Box>
  );
}
