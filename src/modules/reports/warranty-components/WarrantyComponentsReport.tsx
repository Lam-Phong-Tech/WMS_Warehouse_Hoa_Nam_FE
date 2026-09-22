import { useEffect, useMemo, useState, type ReactNode } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
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

const C = {
  navy: "#073b7d",
  navyDark: "#004e74",
  ocean: "#006ca8",
  oceanDark: "#005980",
  cyan: "#0c9ed5",
  cyanSoft: "#edf9ff",
  border: "#c9e7f4",
  borderStrong: "#9bd2e8",
  text: "#073b7d",
  muted: "#5275a5",
  bg: "#f5fbfe",
  green: "#129b45",
  greenSoft: "#e9f8ee",
  orange: "#ff870c",
  orangeSoft: "#fff4e8",
  red: "#f5222d",
  redSoft: "#fff0f1",
  skeleton: "#dce8f4",
} as const;

const surface = {
  border: "1px solid " + C.border,
  borderRadius: "8px",
  bgcolor: "#fff",
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
  if (["COMPLETED", "RETURNED", "DONE", "CLOSED"].includes(normalized)) return "complete";
  if (["RECEIVED", "WAITING", "PENDING", "NEW"].includes(normalized)) return "waiting";
  return "processing";
}

function labelOf(status: UiStatus): string {
  if (status === "complete") return "Hoàn tất";
  if (status === "waiting") return "Chờ tiếp nhận";
  return "Đang xử lý";
}

function normalizeRows(payload: unknown): UiRow[] {
  return listOf((payload as { rows?: unknown } | undefined)?.rows).map((row, index) => {
    const rawStatus = text(row.status, "");
    const status = mapStatus(rawStatus);
    const dueDate = text(row.estimated_completion_date ?? row.due_date, "");
    const overdueDays =
      status !== "complete" &&
      dueDate &&
      dayjs(dueDate).isValid() &&
      dayjs(dueDate).isBefore(dayjs(), "day")
        ? Math.max(1, dayjs().startOf("day").diff(dayjs(dueDate).startOf("day"), "day"))
        : 0;
    return {
      id: text(row.warranty_case_id ?? row.id, String(index)),
      caseNo: text(row.case_no ?? row.warranty_case_code, "—"),
      serial: text(row.serial_no ?? row.serial ?? row.serial_number, "—"),
      skuCode: text(row.model ?? row.sku_code, "—"),
      skuName: text(row.sku_name ?? row.product_name, "—"),
      component: text(row.components_issued ?? row.component_name ?? row.component ?? row.defect ?? row.defect_name, "—"),
      receivedAt: text(row.received_at ?? row.created_at, ""),
      dueDate,
      status,
      statusLabel: labelOf(status),
      overdueDays,
    };
  });
}

function pct(value: number, total: number): string {
  if (!total) return "—";
  return ((value / total) * 100).toFixed(1).replace(".", ",") + "%";
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ mb: .45, color: C.text, fontSize: 12.5, fontWeight: 700, lineHeight: "18px" }}>
      {children}
    </Box>
  );
}

function SkeletonLine({ width, height = 12 }: { width: string | number; height?: number }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width,
        height,
        borderRadius: "6px",
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
        minHeight: { xs: 118, md: 122 },
        px: { xs: 1.4, md: 1.6 },
        py: 1.25,
        display: "grid",
        gridTemplateColumns: "62px minmax(0,1fr)",
        gap: 1.25,
        alignItems: "center",
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
          bgcolor: palette.bg,
          color: palette.fg,
          fontSize: 29,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ color: C.text, fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>
          {label}
        </Box>
        {loading ? (
          <Box sx={{ mt: .8, display: "grid", gap: .75 }}>
            <SkeletonLine width="58%" height={30} />
            <SkeletonLine width="72%" height={14} />
          </Box>
        ) : (
          <>
            <Box
              sx={{
                mt: .18,
                color: C.navy,
                fontSize: "clamp(31px,2.4vw,39px)",
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-.025em",
              }}
            >
              {value}
            </Box>
            <Box sx={{ mt: .35, color: palette.fg, fontSize: 12.5, lineHeight: 1.2 }}>
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
    <Box sx={{ display: "grid", justifyItems: "center", gap: .1 }}>
      <Box
        sx={{
          minWidth: 124,
          px: 1.1,
          py: .32,
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
        <Box sx={{ color: C.red, fontSize: 10.5 }}>Quá hạn {row.overdueDays} ngày</Box>
      ) : null}
    </Box>
  );
}

function EmptyState({ noResult }: { noResult: boolean }) {
  return (
    <Box sx={{ minHeight: 245, display: "grid", placeItems: "center", textAlign: "center", px: 3 }}>
      <Box>
        {!noResult ? (
          <Box sx={{ color: "#8aa7c6", fontSize: 48, mb: .75 }}>
            <InboxOutlined />
          </Box>
        ) : null}
        <Box sx={{ color: C.navy, fontSize: 19, fontWeight: 800 }}>
          {noResult ? "Không tìm thấy phiếu phù hợp" : "Chưa có dữ liệu bảo hành"}
        </Box>
        <Box sx={{ mt: .55, color: C.muted, fontSize: 13 }}>
          {noResult
            ? "Thử thay đổi từ khóa hoặc bộ lọc."
            : "Không có phiếu bảo hành trong khoảng thời gian đã chọn."}
        </Box>
        {!noResult ? (
          <Box sx={{ mt: .2, color: C.muted, fontSize: 13 }}>
            Thay đổi khoảng thời gian hoặc dùng Đặt lại ở bộ lọc.
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
    <Box sx={{ ...surface, minHeight: 330, display: "grid", placeItems: "center", textAlign: "center", px: 3 }}>
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
            bgcolor: offline ? "#f3f7fb" : C.redSoft,
            color: offline ? "#7897b9" : C.red,
            fontSize: 40,
          }}
        >
          {offline ? <SyncOutlined /> : <WarningOutlined />}
        </Box>
        <Box sx={{ color: C.navy, fontSize: 25, fontWeight: 800 }}>
          {offline ? "Không có kết nối mạng" : "Không thể tải dữ liệu"}
        </Box>
        <Box sx={{ mt: .55, color: C.muted, fontSize: 14 }}>
          {offline ? "Kiểm tra kết nối và thử lại." : "Đã xảy ra lỗi khi tải báo cáo. Vui lòng thử lại."}
        </Box>
        {!offline ? (
          <UiButton appearance="filled" sx={{ mt: 1.8 }} onClick={retry}>
            Thử lại
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
  const [keyword, setKeyword] = useState(forcedState === "no-result" ? "abcxyz" : "");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [detailBusyId, setDetailBusyId] = useState<string | null>(null);
  const [detailErrorId, setDetailErrorId] = useState<string | null>(null);

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
  const invalid = range[0].isAfter(range[1], "day") || forcedState === "invalid-date";
  const source = useWarrantyReport({
    from,
    to,
    enabled: !invalid && online && forcedState !== "offline" && forcedState !== "error",
  });
  const exporter = useReportExport();

  const apiRows = useMemo(() => normalizeRows(source.data), [source.data]);
  const rows = forcedState === "empty" ? [] : apiRows;
  const loading = source.isLoading || forcedState === "loading";
  const refreshing = (!loading && source.isFetching) || forcedState === "refreshing";
  const offline = !online || forcedState === "offline";
  const hardError = forcedState === "error" || (source.isError && rows.length === 0 && !offline);
  const partial = forcedState === "partial" || (source.isError && rows.length > 0);

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
  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.perPage));

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

  const exporting = exporter.exporting === "xlsx" || forcedState === "exporting";
  const exportFailed = forcedState === "export-failed";
  const exportSuccess = forcedState === "export-success";
  const exportUnknown = forcedState === "export-unknown";

  const openDetail = (row: UiRow) => {
    setDetailErrorId(null);
    setDetailBusyId(row.id);
    window.setTimeout(() => {
      setDetailBusyId(null);
      const element = document.getElementById("warranty-row-" + row.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 450);
  };

  const effectiveBusyId =
    forcedState === "detail-processing" && filteredRows[0] ? filteredRows[0].id : detailBusyId;
  const effectiveDetailError =
    forcedState === "detail-error" && filteredRows[0] ? filteredRows[0].caseNo : detailErrorId;

  const pageNumbers = useMemo(() => {
    if (lastPage <= 3) return Array.from({ length: lastPage }, (_, index) => index + 1);
    if (pagination.page <= 2) return [1, 2, 3];
    if (pagination.page >= lastPage - 1) return [lastPage - 2, lastPage - 1, lastPage];
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
        gap: { xs: 1.2, md: 1.25 },
        pb: 2.5,
        fontSize: { xs: 13, md: 14 },
        "& *": { boxSizing: "border-box" },
        "@keyframes hnWarrantySkeleton": {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
        "& .hn-vuexy-date-range.ant-picker": {
          minHeight: 42,
          borderColor: invalid ? C.red : C.ocean,
          borderRadius: "6px",
          boxShadow: "none",
          color: C.text,
          bgcolor: "#fff",
        },
        "& .hn-vuexy-date-range.ant-picker:hover": {
          borderColor: invalid ? C.red : C.oceanDark,
        },
        "& .hn-vuexy-date-range.ant-picker-focused": {
          borderColor: invalid ? C.red : C.ocean,
          boxShadow: invalid ? "0 0 0 2px rgba(245,34,45,.10)" : "0 0 0 2px rgba(0,108,168,.12)",
        },
        "& .hn-vuexy-date-range .ant-picker-active-bar": { background: C.ocean },
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
            Báo cáo&nbsp;&nbsp;/&nbsp;&nbsp;Bảo hành linh kiện
          </Box>
          <Box
            component="h1"
            sx={{
              m: 0,
              mt: .25,
              color: C.navy,
              fontSize: { xs: 25, sm: 29, md: 31 },
              lineHeight: 1.08,
              letterSpacing: "-.028em",
              fontWeight: 800,
            }}
          >
            Báo cáo Bảo hành linh kiện
          </Box>
          <Box sx={{ mt: .2, color: "#086ec4", fontSize: { xs: 13.5, md: 15 }, lineHeight: 1.3 }}>
            Theo dõi tiến độ bảo hành, linh kiện thay thế và tình trạng xử lý
          </Box>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
          <Box
            role="note"
            sx={{
              minHeight: 40,
              px: 1.4,
              display: "flex",
              alignItems: "center",
              gap: .65,
              borderRadius: "7px",
              bgcolor: C.cyanSoft,
              color: C.navy,
              fontSize: 12.5,
              fontWeight: 650,
            }}
          >
            ⓘ <Box component="span">Dữ liệu minh họa</Box>
          </Box>
          <UiButton
            appearance="filled"
            startIcon={<DownloadOutlined />}
            loading={exporting}
            disabled={invalid || loading || offline}
            onClick={exportXlsx}
          >
            {exporting ? "Đang chuẩn bị..." : "Xuất báo cáo"}
          </UiButton>
        </Stack>
      </Stack>

      {offline ? (
        <UiAlert tone="warning">Bạn đang ngoại tuyến. Không thể tải dữ liệu mới.</UiAlert>
      ) : null}

      <Box component="section" aria-label="Bộ lọc báo cáo" sx={{ ...surface, p: { xs: 1.25, sm: 1.5 } }}>
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
            <FilterLabel>Khoảng thời gian</FilterLabel>
            <UiVuexyDateRangePicker
              aria-label="Khoảng thời gian"
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
            <Box sx={{ mt: .35, color: invalid ? C.red : "#1683c7", fontSize: 10.8 }}>
              {invalid
                ? "Ngày bắt đầu không được sau ngày kết thúc."
                : "7 ngày gần nhất  ·  Múi giờ Việt Nam"}
            </Box>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>Kho</FilterLabel>
            <Box
              aria-label="Kho Hoa Nam"
              sx={{
                minHeight: 42,
                px: 1.35,
                display: "flex",
                alignItems: "center",
                gap: .75,
                border: "1px solid " + C.border,
                borderRadius: "6px",
                bgcolor: "#f8fbfd",
                color: C.muted,
                fontWeight: 650,
              }}
            >
              ◇ <Box component="span">Kho Hoa Nam</Box>
            </Box>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>Trạng thái</FilterLabel>
            <Box
              component="select"
              aria-label="Trạng thái"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              sx={{
                width: "100%",
                minHeight: 42,
                px: 1.25,
                border: "1px solid " + C.borderStrong,
                borderRadius: "6px",
                bgcolor: "#fff",
                color: C.text,
                font: "inherit",
                outline: "none",
                "&:focus": { borderColor: C.ocean, boxShadow: "0 0 0 2px rgba(0,108,168,.10)" },
              }}
            >
              <option value="">Tất cả</option>
              <option value="complete">Hoàn tất</option>
              <option value="processing">Đang xử lý</option>
              <option value="waiting">Chờ tiếp nhận</option>
            </Box>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FilterLabel>Tìm kiếm</FilterLabel>
            <SearchInput
              width="100%"
              value={keyword}
              aria-label="Tìm mã phiếu, serial, SKU, linh kiện"
              placeholder="Mã phiếu, serial, SKU, linh kiện..."
              onChange={(value) => setKeyword(value)}
            />
          </Box>
          <UiButton
            appearance="filled"
            disabled={invalid || loading}
            onClick={() => pagination.reset()}
          >
            Áp dụng
          </UiButton>
          <UiButton appearance="text" onClick={resetFilters}>
            Đặt lại
          </UiButton>
        </Box>

        {exporting ? (
          <Box sx={{ mt: .75 }}>
            <UiAlert tone="info">Đang chuẩn bị dữ liệu xuất báo cáo.</UiAlert>
          </Box>
        ) : exportFailed ? (
          <Box sx={{ mt: .75 }}>
            <UiAlert tone="error">Không thể xuất báo cáo. Vui lòng thử lại.</UiAlert>
          </Box>
        ) : exportSuccess ? (
          <Box sx={{ mt: .75 }}>
            <UiAlert tone="success">Xuất báo cáo thành công.</UiAlert>
          </Box>
        ) : exportUnknown ? (
          <Box sx={{ mt: .75 }}>
            <UiAlert tone="warning">
              Chưa xác định trạng thái xuất báo cáo. Hệ thống đang kiểm tra kết quả.
            </UiAlert>
          </Box>
        ) : null}
      </Box>

      {hardError || offline ? (
        <FailurePanel offline={offline} retry={() => void source.refetch()} />
      ) : (
        <>
          {partial ? (
            <UiAlert tone="warning">Dữ liệu có thể chưa đầy đủ</UiAlert>
          ) : null}

          <Box
            component="section"
            aria-label="Tổng quan vận hành"
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
              label="Tổng phiếu"
              value={fmt(rows.length)}
              hint="Phiếu trong kỳ"
              tone="primary"
              icon={<FileTextOutlined />}
              loading={loading}
            />
            <MetricCard
              label="Hoàn tất"
              value={fmt(complete)}
              hint={pct(complete, rows.length) + " tổng phiếu"}
              tone="success"
              icon={<CheckCircleOutlined />}
              loading={loading}
            />
            <MetricCard
              label="Đang xử lý"
              value={fmt(processing)}
              hint={pct(processing, rows.length) + " tổng phiếu"}
              tone="info"
              icon={<SyncOutlined />}
              loading={loading}
            />
            <MetricCard
              label="Chờ tiếp nhận"
              value={fmt(waiting)}
              hint={pct(waiting, rows.length) + " tổng phiếu"}
              tone="warning"
              icon={<ReloadOutlined />}
              loading={loading}
            />
          </Box>

          <Box component="section" sx={{ ...surface, p: { xs: 1.35, md: 1.5 } }}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              sx={{ alignItems: { xs: "stretch", lg: "center" }, gap: { xs: 1.4, lg: 2 } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
                  <Box component="h2" sx={{ m: 0, color: C.navy, fontSize: { xs: 19, md: 20 }, fontWeight: 800 }}>
                    Tiến độ bảo hành
                  </Box>
                  {refreshing ? (
                    <Stack direction="row" sx={{ alignItems: "center", gap: .65, color: "#0879ca", fontSize: 11.5 }}>
                      <UiSpinner size={15} label={null} /> Đang cập nhật dữ liệu...
                    </Stack>
                  ) : partial ? (
                    <Box sx={{ px: .85, py: .2, borderRadius: 999, bgcolor: "#fff1d8", color: "#b86100", fontSize: 11, fontWeight: 700 }}>
                      Chưa cập nhật
                    </Box>
                  ) : null}
                </Stack>

                {partial ? (
                  <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1 }}>
                    <Stack direction="row" sx={{ alignItems: "center", gap: .8, color: C.red, fontSize: 13 }}>
                      <WarningOutlined /> Không thể cập nhật tiến độ bảo hành.
                    </Stack>
                    <UiButton appearance="filled" startIcon={<ReloadOutlined />} onClick={() => void source.refetch()}>
                      Tải lại
                    </UiButton>
                  </Stack>
                ) : loading ? (
                  <Box sx={{ display: "grid", gap: .8 }}>
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
                      aria-label={"Hoàn tất " + pct(complete, rows.length)}
                      sx={{
                        height: 36,
                        display: "flex",
                        overflow: "hidden",
                        borderRadius: "6px",
                        bgcolor: "#e1ebf5",
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    >
                      <Box sx={{ width: completionPct + "%", minWidth: complete ? 40 : 0, display: "grid", placeItems: "center", bgcolor: C.green }}>
                        {complete || ""}
                      </Box>
                      <Box sx={{ width: processingPct + "%", minWidth: processing ? 40 : 0, display: "grid", placeItems: "center", bgcolor: "#18a0d5" }}>
                        {processing || ""}
                      </Box>
                      <Box sx={{ width: waitingPct + "%", minWidth: waiting ? 40 : 0, display: "grid", placeItems: "center", bgcolor: "#ff9528" }}>
                        {waiting || ""}
                      </Box>
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} sx={{ mt: .85, gap: { xs: .5, sm: 2.8 }, flexWrap: "wrap" }}>
                      <Box sx={{ fontSize: 11.5 }}><Box component="span" sx={{ color: C.green }}>●</Box>&nbsp; Hoàn tất ({complete}) &nbsp;<b>{pct(complete, rows.length)}</b></Box>
                      <Box sx={{ fontSize: 11.5 }}><Box component="span" sx={{ color: "#18a0d5" }}>●</Box>&nbsp; Đang xử lý ({processing}) &nbsp;<b>{pct(processing, rows.length)}</b></Box>
                      <Box sx={{ fontSize: 11.5 }}><Box component="span" sx={{ color: "#ff9528" }}>●</Box>&nbsp; Chờ tiếp nhận ({waiting}) &nbsp;<b>{pct(waiting, rows.length)}</b></Box>
                    </Stack>
                  </>
                )}
              </Box>

              {!partial ? (
                <>
                  <Box sx={{ minWidth: { xs: 0, lg: 180 }, py: { xs: 0, lg: .7 }, px: { xs: 0, lg: 2 }, borderLeft: { xs: 0, lg: "1px solid " + C.border }, textAlign: "center" }}>
                    {loading ? (
                      <SkeletonLine width="80%" height={56} />
                    ) : (
                      <>
                        <Box sx={{ color: C.green, fontSize: 36, lineHeight: 1, fontWeight: 800 }}>
                          {pct(complete, rows.length)}
                        </Box>
                        <Box sx={{ mt: .35, color: C.text, fontSize: 12.5 }}>hoàn tất</Box>
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
                    <Box sx={{ width: 52, height: 52, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: "#ffe3e5", color: C.red, fontSize: 28 }}>
                      <WarningOutlined />
                    </Box>
                    {loading ? (
                      <Box sx={{ display: "grid", gap: .65 }}>
                        <SkeletonLine width="80%" height={16} />
                        <SkeletonLine width="72%" height={12} />
                      </Box>
                    ) : (
                      <Box>
                        <Box sx={{ color: C.red, fontSize: 19, fontWeight: 800 }}>{overdue} phiếu quá hạn</Box>
                        <Box sx={{ mt: .2, color: C.muted, fontSize: 11.5 }}>Thuộc {unfinished} phiếu chưa hoàn tất</Box>
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
              sx={{ px: { xs: 1.2, md: 1.45 }, pt: 1, pb: .65, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: .85 }}
            >
              <Stack direction="row" sx={{ alignItems: "center", gap: .75, flexWrap: "wrap" }}>
                <Box component="h2" sx={{ m: 0, color: C.navy, fontSize: { xs: 18, md: 19 }, fontWeight: 800 }}>
                  Danh sách phiếu bảo hành
                </Box>
                <Box sx={{ px: .9, py: .2, borderRadius: 999, bgcolor: C.cyanSoft, color: C.navy, fontSize: 12, fontWeight: 800 }}>
                  {forcedState === "no-result" ? "0 kết quả / " + fmt(rows.length) + " phiếu" : fmt(rows.length)}
                </Box>
                {loading ? (
                  <Stack direction="row" sx={{ alignItems: "center", gap: .5, color: "#0879ca", fontSize: 11.5 }}>
                    <UiSpinner size={15} label={null} /> Đang tải dữ liệu...
                  </Stack>
                ) : null}
              </Stack>
              <Box sx={{ width: { xs: "100%", sm: 290, lg: 330 } }}>
                <SearchInput
                  width="100%"
                  value={keyword}
                  aria-label="Tìm trong danh sách phiếu bảo hành"
                  placeholder="Tìm mã phiếu, serial, SKU, linh kiện..."
                  onChange={(value) => setKeyword(value)}
                />
              </Box>
            </Stack>

            {effectiveDetailError ? (
              <Box sx={{ px: 1.2, pb: .75 }}>
                <UiAlert tone="error">
                  <b>{effectiveDetailError}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Không thể mở chi tiết phiếu. Vui lòng thử lại.
                </UiAlert>
              </Box>
            ) : null}

            <Box sx={{ px: { xs: .9, md: 1.2 } }}>
              <Box sx={{ overflowX: "auto", border: "1px solid " + C.border, borderRadius: "6px" }}>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    minWidth: { xs: 760, md: 980 },
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                    color: C.text,
                    "& th": {
                      bgcolor: "#eef9fd",
                      color: "#0870be",
                      fontSize: 11.5,
                      fontWeight: 700,
                      textAlign: "left",
                      px: 1.15,
                      py: .72,
                      borderRight: "1px solid " + C.border,
                      borderBottom: "1px solid " + C.border,
                    },
                    "& td": {
                      px: 1.15,
                      py: .62,
                      fontSize: 11.5,
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
                      <th style={{ width: 46 }}><input type="checkbox" aria-label="Chọn tất cả" /></th>
                      <th style={{ width: 178 }}>Mã phiếu / Serial</th>
                      <th style={{ width: 195 }}>SKU / Sản phẩm</th>
                      <th style={{ width: 170 }}>Linh kiện bảo hành</th>
                      <th className="warranty-desktop-only" style={{ width: 145 }}>Ngày tiếp nhận</th>
                      <th className="warranty-desktop-only" style={{ width: 145 }}>Hạn xử lý</th>
                      <th className="warranty-tablet-only" style={{ width: 150 }}>Tiếp nhận / Hạn xử lý</th>
                      <th style={{ width: 155 }}>Trạng thái</th>
                      <th style={{ width: 92 }}>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? Array.from({ length: 5 }).map((_, index) => (
                      <tr key={"skeleton-" + index}>
                        <td><input type="checkbox" disabled aria-label={"Dòng tải " + (index + 1)} /></td>
                        <td><SkeletonLine width="80%" /><Box sx={{ mt: .5 }}><SkeletonLine width="66%" height={9} /></Box></td>
                        <td><SkeletonLine width="78%" /><Box sx={{ mt: .5 }}><SkeletonLine width="65%" height={9} /></Box></td>
                        <td><SkeletonLine width="68%" /></td>
                        <td className="warranty-desktop-only"><SkeletonLine width="64%" /></td>
                        <td className="warranty-desktop-only"><SkeletonLine width="64%" /></td>
                        <td className="warranty-tablet-only"><SkeletonLine width="68%" /><Box sx={{ mt: .5 }}><SkeletonLine width="62%" height={9} /></Box></td>
                        <td><SkeletonLine width="80%" height={22} /></td>
                        <td><Box sx={{ color: C.muted }}>Xem&nbsp;&nbsp;›</Box></td>
                      </tr>
                    )) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ borderRight: 0 }}>
                          <EmptyState noResult={rows.length > 0} />
                        </td>
                      </tr>
                    ) : pagination.pageRows.map((row) => (
                      <tr id={"warranty-row-" + row.id} key={row.id}>
                        <td><input type="checkbox" aria-label={"Chọn " + row.caseNo} /></td>
                        <td>
                          <Box sx={{ color: C.navy, fontWeight: 800 }}>{row.caseNo}</Box>
                          <Box sx={{ mt: .08, color: "#3b74bd", fontSize: 10.5 }}>{row.serial}</Box>
                        </td>
                        <td>
                          <Box sx={{ color: C.navy, fontWeight: 800 }}>{row.skuCode}</Box>
                          <Box sx={{ mt: .08, color: C.muted, fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.skuName}</Box>
                        </td>
                        <td>{row.component}</td>
                        <td className="warranty-desktop-only">{row.receivedAt ? fmtDate(row.receivedAt) : "—"}</td>
                        <td className="warranty-desktop-only">{row.dueDate ? fmtDate(row.dueDate) : "—"}</td>
                        <td className="warranty-tablet-only">
                          <Box>{row.receivedAt ? fmtDate(row.receivedAt) : "—"}</Box>
                          <Box sx={{ mt: .08, color: C.muted }}>{row.dueDate ? fmtDate(row.dueDate) : "—"}</Box>
                        </td>
                        <td><StatusPill row={row} /></td>
                        <td>
                          <UiButton
                            appearance="text"
                            disabled={effectiveBusyId === row.id}
                            onClick={() => openDetail(row)}
                          >
                            {effectiveBusyId === row.id ? <UiSpinner size={15} label={null} /> : <>Xem&nbsp;&nbsp;›</>}
                          </UiButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ px: { xs: 1.2, md: 1.45 }, py: 1.05, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1 }}
            >
              <Box sx={{ fontSize: 12.5, color: C.text }}>
                Hiển thị {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1}–
                {Math.min(pagination.page * pagination.perPage, pagination.total)} / {fmt(pagination.total)} phiếu
              </Box>
              <Stack direction="row" sx={{ gap: .45, alignItems: "center", justifyContent: { xs: "flex-end", sm: "center" }, flexWrap: "wrap" }}>
                <UiButton appearance="outlined" disabled={pagination.page <= 1 || pagination.total === 0} onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}>‹</UiButton>
                {pageNumbers.map((page) => (
                  <UiButton key={page} appearance={page === pagination.page ? "filled" : "outlined"} onClick={() => pagination.setPage(page)}>
                    {page}
                  </UiButton>
                ))}
                {lastPage > 4 && pagination.page < lastPage - 2 ? <Box sx={{ px: .35 }}>…</Box> : null}
                {lastPage > 3 && !pageNumbers.includes(lastPage) ? (
                  <UiButton appearance="outlined" onClick={() => pagination.setPage(lastPage)}>{lastPage}</UiButton>
                ) : null}
                <UiButton appearance="outlined" disabled={pagination.page >= lastPage || pagination.total === 0} onClick={() => pagination.setPage(Math.min(lastPage, pagination.page + 1))}>›</UiButton>
              </Stack>
              <Box sx={{ color: "#2e83c8", fontSize: 11.5, textAlign: { xs: "right", sm: "left" } }}>
                Dữ liệu minh họa · {range[0].format("DD/MM/YYYY")}–{range[1].format("DD/MM/YYYY")}
              </Box>
            </Stack>
          </Box>
        </>
      )}
    </Box>
  );
}
