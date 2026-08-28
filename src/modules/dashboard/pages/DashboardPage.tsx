import { useMemo, useState, type ReactElement } from "react";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiStatusBadge,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchDashboardKPI } from "../services/dashboardService";
import type { DashboardKPI, DashboardQuery } from "../types";
import { formatDate } from "@/shared/utils/format-date";
import {
  DASHBOARD_PERIOD_PRESETS,
  getPresetRange,
  type DashboardPeriodPreset,
} from "@/shared/utils/date-presets";
import { BarChart } from "@/shared/components/charts/BarChart";
import { DonutChart } from "@/shared/components/charts/DonutChart";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { AreaChart } from "@/shared/components/charts/AreaChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import {
  StockOutlined,
  ImportOutlined,
  ExportOutlined,
  ToolOutlined,
  SwapOutlined,
} from "@/shared/components/icons";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { DashboardActionItems } from "../components/DashboardActionItems";
import { DashboardRecentActivity } from "../components/DashboardRecentActivity";
import { ActionButton } from "@/shared/components/actions";

type FlowNode = {
  label: string;
  route?: string;
};

type FlowLane = {
  label: string;
  nodes: FlowNode[];
};

type FlowMetric = {
  key: keyof Pick<
    DashboardKPI,
    "receipt_qty" | "issue_qty" | "component_issue_qty" | "reversal_net"
  >;
  label: string;
  value: number;
};

const FLOW_LANES: FlowLane[] = [
  {
    label: "Nhập kho",
    nodes: [
      { label: "Danh sách phiếu nhập", route: ROUTES.INBOUND },
      { label: "Tạo phiếu nháp", route: ROUTES.INBOUND },
      { label: "Quét hàng", route: ROUTES.INBOUND },
      { label: "Ghi nhận nhập kho", route: ROUTES.INBOUND },
      { label: "Linh kiện chờ xếp khay", route: ROUTES.PUTAWAY },
      { label: "Xếp vị trí", route: ROUTES.PUTAWAY },
    ],
  },
  {
    label: "Xuất kho",
    nodes: [
      { label: "Phiếu yêu cầu xuất", route: ROUTES.OUTBOUND },
      { label: "Nhập từ Excel / nhập tay", route: ROUTES.OUTBOUND },
      { label: "Danh sách phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Chi tiết phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Quét đối chiếu", route: ROUTES.OUTBOUND },
      { label: "In nhãn", route: ROUTES.OUTBOUND },
      { label: "Gắn RFID / ghi nhận xuất", route: ROUTES.OUTBOUND },
    ],
  },
  {
    label: "Bảo hành",
    nodes: [
      { label: "Danh sách bảo hành", route: ROUTES.WARRANTY },
      { label: "Tiếp nhận bảo hành", route: ROUTES.WARRANTY },
      { label: "Chi tiết bảo hành", route: ROUTES.WARRANTY },
      { label: "Xuất linh kiện", route: ROUTES.WARRANTY },
    ],
  },
  {
    label: "Kiểm soát",
    nodes: [
      { label: "Tra cứu tồn", route: ROUTES.INVENTORY },
      { label: "Truy vết", route: ROUTES.SCAN },
      { label: "Danh sách điều chỉnh tồn", route: ROUTES.REVERSE },
      { label: "Tạo điều chỉnh tồn", route: ROUTES.REVERSE },
    ],
  },
];

const WARRANTY_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Đã tiếp nhận",
  CHECKING: "Đang kiểm tra",
  REPAIRING: "Đang sửa chữa",
  COMPLETED: "Đã hoàn tất sửa chữa",
  RETURNED: "Đã trả khách",
  CANCELLED: "Đã hủy",
};

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

/** Khung card viền mỏng theo token — thay MUI Card variant="outlined" (Part 4). */
const CARD_SX = {
  p: 2,
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
} as const;

/** Tiêu đề card nhỏ (thay Typography subtitle2 fontWeight 700). */
const CARD_TITLE_SX = {
  m: 0,
  fontSize: TYPOGRAPHY.fontSizeBody,
  fontWeight: 700,
  color: S.textHigh,
} as const;

/** Chú thích phụ (thay Typography caption color text.secondary). */
const CAPTION_SX = {
  fontSize: 12,
  color: S.textMedium,
} as const;

/** Tiêu đề khu vực (thay Typography h6) — cỡ cardTitle của design system. */
const SECTION_TITLE_SX = {
  m: 0,
  fontSize: TYPOGRAPHY.cardTitle.fontSize,
  fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
  lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
  color: S.textHigh,
} as const;

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function getHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

function isDashboardEmpty(data: DashboardKPI): boolean {
  return (
    data.available_qty === 0 &&
    data.receipt_qty === 0 &&
    data.issue_qty === 0 &&
    data.component_issue_qty === 0 &&
    data.reversal_net === 0 &&
    Object.values(data.warranty_cases_by_status).every(
      (count) => count === 0,
    ) &&
    data.reconciliation_warning_count === 0
  );
}

function DashboardMetricCard({
  label,
  value,
  note,
  icon,
  color,
  softColor,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactElement;
  color: string;
  /** Nền nhạt cùng dải với `color` — dùng token *Soft (thay `${color}1a`). */
  softColor: string;
}) {
  return (
    <Box sx={{ ...CARD_SX, minWidth: 0, display: "grid", gap: 0.75 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: `${RADIUS.card}px`,
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          color,
          bgcolor: softColor,
        }}
        aria-hidden="true"
      >
        {icon}
      </Box>
      <Box
        sx={{
          fontSize: TYPOGRAPHY.fontSizeSecondary,
          fontWeight: 700,
          color: S.textHigh,
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          fontSize: "clamp(22px, 2.5vw, 30px)",
          fontWeight: 700,
          color: S.textHigh,
          overflowWrap: "anywhere",
        }}
      >
        {formatNumber(value)}
      </Box>
      <Box sx={CAPTION_SX}>{note}</Box>
    </Box>
  );
}

/** Khối trạng thái (không quyền / đang tải / lỗi / rỗng) — title (AlertTitle)
 * và description là 2 node tách riêng để test getByText khớp chính xác từng
 * câu, không gộp chung 1 node. */
function DashboardStateAlert({
  tone,
  title,
  description,
  action,
}: {
  tone: "warning" | "info" | "error";
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <UiAlert tone={tone} title={title}>
      <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
        <Box component="span">{description}</Box>
        {action}
      </Stack>
    </UiAlert>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);

  const canViewReport =
    !isProfileLoaded || isSuperAdmin || permissionCodes.includes("report.view");

  // BA (2026-08-27): Dashboard chỉ nắm nhanh tình hình theo kỳ preset — xem chi
  // tiết theo ngày/tháng/khoảng ngày tuỳ ý thuộc về Báo cáo, không phải Dashboard.
  const [preset, setPreset] = useState<DashboardPeriodPreset>("today");
  const appliedQuery: DashboardQuery = useMemo(
    () => getPresetRange(preset),
    [preset],
  );

  const dashboardQuery = useQuery({
    queryKey: [
      "dashboard",
      "quick",
      appliedQuery.from_date,
      appliedQuery.to_date,
    ],
    queryFn: () => fetchDashboardKPI(appliedQuery),
    enabled: canViewReport,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = getHttpStatus(error);
      if (status === 401 || status === 403 || status === 422) return false;
      return failureCount < 1;
    },
  });

  const topDefectsQuery = useQuery({
    queryKey: [
      "dashboard",
      "top-defects",
      dashboardQuery.data?.period?.from_date,
      dashboardQuery.data?.period?.to_date,
    ],
    queryFn: () =>
      http.get<{ by_defect?: Array<{ defect: unknown; total: unknown }> }>(
        API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
        {
          params: {
            from_date: dashboardQuery.data?.period?.from_date,
            to_date: dashboardQuery.data?.period?.to_date,
          },
        },
      ),
    enabled: canViewReport && Boolean(dashboardQuery.data?.period),
    staleTime: 60_000,
  });
  const topDefects = (topDefectsQuery.data?.by_defect ?? [])
    .map((row) => ({
      label: String(row.defect ?? ""),
      value: Number(row.total ?? 0),
    }))
    .filter((row) => row.label && row.value > 0);

  const flowMetrics = useMemo<FlowMetric[]>(() => {
    if (!dashboardQuery.data) return [];
    return [
      {
        key: "receipt_qty",
        label: "Nhập kho",
        value: dashboardQuery.data.receipt_qty,
      },
      {
        key: "issue_qty",
        label: "Xuất kho",
        value: dashboardQuery.data.issue_qty,
      },
      {
        key: "component_issue_qty",
        label: "Xuất linh kiện",
        value: dashboardQuery.data.component_issue_qty,
      },
      {
        key: "reversal_net",
        label: "Điều chỉnh tồn (ròng)",
        value: dashboardQuery.data.reversal_net,
      },
    ];
  }, [dashboardQuery.data]);

  const flowChartLabel = useMemo(() => {
    if (!dashboardQuery.data) return "";
    const series = flowMetrics
      .map((metric) => `${metric.label} ${formatNumber(metric.value)}`)
      .join("; ");
    if (!dashboardQuery.data.period) return series;
    return `Biểu đồ luồng kho từ ${formatDate(dashboardQuery.data.period.from_date)} đến ${formatDate(dashboardQuery.data.period.to_date)}: ${series}`;
  }, [dashboardQuery.data, flowMetrics]);

  const status = getHttpStatus(dashboardQuery.error);
  const data = dashboardQuery.data;
  const empty = data ? isDashboardEmpty(data) : false;
  // ?? [] phòng thủ cho response cache cũ (client) từ trước khi field này tồn
  // tại — kiểu DashboardKPI khai daily là bắt buộc, nhưng dữ liệu cache cũ có
  // thể chưa có field này.
  const dailyPoints = data?.daily ?? [];
  const warrantyEntries = data
    ? Object.entries(data.warranty_cases_by_status).sort(([a], [b]) =>
        a.localeCompare(b),
      )
    : [];

  return (
    <Box data-mvp-screen="MAP-01" sx={{ display: "grid", gap: 2 }}>
      <Box
        component="section"
        aria-labelledby="dashboard-title"
        sx={{ ...CARD_SX, p: 3 }}
      >
        <UiStatusBadge
          tone="primary"
          label="Tổng quan vận hành"
          sx={{ mb: 1.5 }}
        />
        <Box
          component="h1"
          id="dashboard-title"
          sx={{
            m: 0,
            mb: 0.5,
            fontSize: TYPOGRAPHY.heading.fontSize,
            fontWeight: TYPOGRAPHY.heading.fontWeight,
            lineHeight: TYPOGRAPHY.heading.lineHeight,
            color: S.textHigh,
          }}
        >
          Tổng quan kho
        </Box>
        <Box
          sx={{ fontSize: TYPOGRAPHY.fontSizeSecondary, color: S.textMedium }}
        >
          Theo dõi tồn khả dụng, nhập kho, xuất kho, bảo hành và các cảnh báo
          đối soát trên cùng một màn hình.
        </Box>

        <Stack
          direction="row"
          spacing={1}
          role="group"
          aria-label="Chọn kỳ xem nhanh"
          sx={{ mt: 2.5, flexWrap: "wrap" }}
        >
          {DASHBOARD_PERIOD_PRESETS.map((option) => (
            <UiButton
              key={option.value}
              appearance={preset === option.value ? "filled" : "outlined"}
              onClick={() => setPreset(option.value)}
              disabled={!canViewReport}
            >
              {option.label}
            </UiButton>
          ))}
          {dashboardQuery.isFetching ? (
            <Box sx={{ ...CAPTION_SX, alignSelf: "center", ml: 1 }}>
              Đang tải…
            </Box>
          ) : null}
        </Stack>
        <Box
          sx={{
            ...CAPTION_SX,
            mt: 2.5,
            pt: 1.5,
            borderTop: `1px solid ${S.border}`,
          }}
        >
          Dữ liệu được tổng hợp theo múi giờ Việt Nam. Cần xem chi tiết theo
          ngày/tháng/khoảng ngày tuỳ ý — vào mục Báo cáo.
        </Box>
      </Box>

      {isProfileLoaded && !canViewReport ? (
        <DashboardStateAlert
          tone="warning"
          title="Không có quyền xem báo cáo tổng quan."
          description="Vui lòng liên hệ quản trị viên nếu bạn cần quyền truy cập."
        />
      ) : null}

      {canViewReport && dashboardQuery.isLoading ? (
        <DashboardStateAlert
          tone="info"
          title="Đang tải số liệu tổng quan…"
          description="Hệ thống đang tổng hợp dữ liệu vận hành."
        />
      ) : null}

      {canViewReport && dashboardQuery.isError ? (
        <DashboardStateAlert
          tone="error"
          title={
            status === 403
              ? "Bạn không có quyền xem báo cáo tổng quan."
              : status === 422
                ? "Khoảng ngày đã chọn không hợp lệ."
                : "Không tải được số liệu tổng quan."
          }
          description={
            status === 401
              ? "Phiên đăng nhập không còn hợp lệ."
              : "Hệ thống không hiển thị dữ liệu cũ khi việc tải dữ liệu thất bại."
          }
          action={
            <ActionButton
              kind="refresh"
              onClick={() => dashboardQuery.refetch()}
              disabled={dashboardQuery.isFetching}
            >
              Thử lại
            </ActionButton>
          }
        />
      ) : null}

      {data ? (
        <>
          <Box component="section" aria-labelledby="dashboard-kpi-title">
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1.5,
                flexWrap: "wrap",
                mb: 1.5,
              }}
            >
              <Box>
                <Box
                  component="h2"
                  id="dashboard-kpi-title"
                  sx={SECTION_TITLE_SX}
                >
                  Chỉ số vận hành
                </Box>
                {data.period ? (
                  <Box sx={CAPTION_SX}>
                    Kỳ thống kê: {formatDate(data.period.from_date)} →{" "}
                    {formatDate(data.period.to_date)}
                  </Box>
                ) : null}
                <Box sx={CAPTION_SX}>
                  Phạm vi dữ liệu:{" "}
                  {data.data_scope === "GLOBAL"
                    ? "Toàn hệ thống"
                    : `Theo ${data.scope_warehouse_ids?.length ?? 0} kho bạn được phân quyền`}
                </Box>
              </Box>
              <UiStatusBadge tone="neutral" label="Dữ liệu hệ thống" />
            </Box>

            {/* Breakpoint theo theme (sm/md/lg) thay cho 560/800/1100 của CSS cũ. */}
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))",
                  lg: "repeat(5, minmax(0, 1fr))",
                },
              }}
            >
              <DashboardMetricCard
                label="Tồn khả dụng"
                value={data.available_qty}
                note="Số lượng hiện có thể sử dụng"
                icon={<StockOutlined />}
                color={CHART_COLORS.primary}
                softColor={S.primarySoft}
              />
              <DashboardMetricCard
                label="Nhập kho"
                value={data.receipt_qty}
                note="Tổng số lượng đã ghi nhận nhập trong kỳ"
                icon={<ImportOutlined />}
                color={CHART_COLORS.success}
                softColor={S.successSoft}
              />
              <DashboardMetricCard
                label="Xuất kho"
                value={data.issue_qty}
                note="Tổng số lượng đã ghi nhận xuất trong kỳ"
                icon={<ExportOutlined />}
                color={CHART_COLORS.warning}
                softColor={S.warningSoft}
              />
              <DashboardMetricCard
                label="Xuất linh kiện"
                value={data.component_issue_qty}
                note="Tổng linh kiện đã xuất trong kỳ"
                icon={<ToolOutlined />}
                color={CHART_COLORS.info}
                softColor={S.infoSoft}
              />
              <DashboardMetricCard
                label="Điều chỉnh tồn (ròng)"
                value={data.reversal_net}
                note="Chênh lệch tăng/giảm tồn do điều chỉnh trong kỳ"
                icon={<SwapOutlined />}
                color={CHART_COLORS.violet}
                softColor={S.primarySoft}
              />
            </Box>
          </Box>

          {empty ? (
            <DashboardStateAlert
              tone="info"
              title="Không có số liệu trong kỳ."
              description="Chưa phát sinh dữ liệu vận hành trong khoảng ngày đã chọn."
            />
          ) : (
            <Box
              component="section"
              aria-label="Biểu đồ tổng quan"
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "minmax(0, 2fr) minmax(240px, 1fr)",
                },
              }}
            >
              <Box sx={CARD_SX}>
                <Box component="h3" sx={CARD_TITLE_SX}>
                  Biểu đồ luồng kho trong kỳ
                </Box>
                <Box sx={CAPTION_SX}>
                  So sánh quy mô nhập, xuất, xuất linh kiện và điều chỉnh tồn.
                </Box>
                <Box role="img" aria-label={flowChartLabel} sx={{ mt: 2 }}>
                  <BarChart
                    categories={flowMetrics.map((metric) => metric.label)}
                    series={[
                      {
                        name: "Giá trị",
                        data: flowMetrics.map((metric) => metric.value),
                      },
                    ]}
                    distributed
                    valueFormatter={formatNumber}
                  />
                </Box>
              </Box>

              <Box sx={CARD_SX}>
                <Box component="h3" sx={CARD_TITLE_SX}>
                  Bảo hành theo trạng thái
                </Box>
                <Box sx={CAPTION_SX}>
                  Tổng hợp các ca bảo hành hiện có trong hệ thống.
                </Box>
                {data.data_scope === "WAREHOUSE_SCOPED" ? (
                  <Box
                    role="note"
                    sx={{
                      mt: 1.25,
                      pl: 1.25,
                      py: 0.75,
                      borderLeft: `3px solid ${S.border}`,
                    }}
                  >
                    <Box sx={CAPTION_SX}>
                      Số liệu bảo hành được tổng hợp toàn hệ thống và không giới
                      hạn theo kho.
                    </Box>
                  </Box>
                ) : null}
                {warrantyEntries.length === 0 ? (
                  <Box
                    sx={{
                      mt: 2,
                      fontSize: TYPOGRAPHY.fontSizeSecondary,
                      color: S.textMedium,
                    }}
                  >
                    Chưa có ca bảo hành.
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
                      gap: 2,
                      alignItems: "center",
                      mt: 2,
                    }}
                  >
                    <Stack spacing={1}>
                      {warrantyEntries.map(([warrantyStatus, count]) => (
                        <Stack
                          key={warrantyStatus}
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            borderBottom: `1px solid ${S.border}`,
                            pb: 1,
                          }}
                        >
                          <Box
                            sx={{
                              fontSize: TYPOGRAPHY.fontSizeSecondary,
                              color: S.textHigh,
                              textTransform: "lowercase",
                              "&::first-letter": {
                                textTransform: "uppercase",
                              },
                            }}
                          >
                            {WARRANTY_STATUS_LABELS[warrantyStatus] ??
                              warrantyStatus.replaceAll("_", " ")}
                          </Box>
                          <Box sx={{ fontWeight: 700, color: S.textHigh }}>
                            {formatNumber(count)}
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                    <Box sx={{ width: { xs: "100%", sm: 220 } }}>
                      <DonutChart
                        items={warrantyEntries.map(
                          ([warrantyStatus, count]) => ({
                            label:
                              WARRANTY_STATUS_LABELS[warrantyStatus] ??
                              warrantyStatus.replaceAll("_", " "),
                            value: count,
                          }),
                        )}
                        centerLabel="Tổng ca"
                        valueFormatter={formatNumber}
                      />
                    </Box>
                  </Box>
                )}
              </Box>

              <Box sx={CARD_SX}>
                <Box component="h3" sx={CARD_TITLE_SX}>
                  Đối soát tồn kho
                </Box>
                <Box
                  sx={{
                    mt: 1.5,
                    mb: 0.5,
                    fontSize: 24,
                    fontWeight: 700,
                    color: S.textHigh,
                  }}
                >
                  {formatNumber(data.reconciliation_warning_count)} cảnh báo
                </Box>
                <Box sx={CAPTION_SX}>
                  Số trường hợp chênh lệch cần kiểm tra tại thời điểm hiện tại.
                </Box>
              </Box>

              <Box
                onClick={() => navigate(ROUTES.MASTER_DATA)}
                sx={{ ...CARD_SX, cursor: "pointer" }}
              >
                <Box component="h3" sx={CARD_TITLE_SX}>
                  Tồn dưới định mức
                </Box>
                <Box
                  sx={{
                    mt: 1.5,
                    mb: 0.5,
                    fontSize: 24,
                    fontWeight: 700,
                    color: S.textHigh,
                  }}
                >
                  {formatNumber(data.below_min_stock_count)} SKU
                </Box>
                <Box sx={CAPTION_SX}>
                  SKU có định mức tối thiểu và tổng tồn khả dụng (mọi kho) thấp
                  hơn định mức.
                </Box>
              </Box>

              <Box
                onClick={() => navigate(ROUTES.MASTER_DATA)}
                sx={{ ...CARD_SX, cursor: "pointer" }}
              >
                <Box component="h3" sx={CARD_TITLE_SX}>
                  Tồn vượt định mức
                </Box>
                <Box
                  sx={{
                    mt: 1.5,
                    mb: 0.5,
                    fontSize: 24,
                    fontWeight: 700,
                    color: S.textHigh,
                  }}
                >
                  {formatNumber(data.above_max_stock_count)} SKU
                </Box>
                <Box sx={CAPTION_SX}>
                  SKU có định mức tối đa và tổng tồn khả dụng (mọi kho) cao hơn
                  định mức.
                </Box>
              </Box>

              {dailyPoints.length > 0 ? (
                <Box sx={{ ...CARD_SX, gridColumn: "1 / -1" }}>
                  <Box component="h3" sx={CARD_TITLE_SX}>
                    Nhập / Xuất theo ngày
                  </Box>
                  <Box sx={CAPTION_SX}>
                    So sánh lượng hàng nhập và xuất theo từng ngày trong kỳ đang
                    xem.
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <BarChart
                      categories={dailyPoints.map((point) =>
                        formatDate(point.date),
                      )}
                      series={[
                        {
                          name: "Nhập",
                          data: dailyPoints.map((point) => point.receipt_qty),
                          color: CHART_COLORS.primary,
                        },
                        {
                          name: "Xuất",
                          data: dailyPoints.map((point) => point.issue_qty),
                          color: CHART_COLORS.warning,
                        },
                      ]}
                      valueFormatter={formatNumber}
                    />
                  </Box>
                </Box>
              ) : null}

              {dailyPoints.length > 0 ? (
                <Box sx={{ ...CARD_SX, gridColumn: "1 / -1" }}>
                  <Box component="h3" sx={CARD_TITLE_SX}>
                    Xu hướng bảo hành
                  </Box>
                  <Box sx={CAPTION_SX}>
                    Số ca bảo hành mới tiếp nhận theo từng ngày trong kỳ đang
                    xem.
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <AreaChart
                      categories={dailyPoints.map((point) =>
                        formatDate(point.date),
                      )}
                      data={dailyPoints.map(
                        (point) => point.warranty_received_count,
                      )}
                      name="Ca tiếp nhận"
                      color={CHART_COLORS.danger}
                      valueFormatter={formatNumber}
                    />
                  </Box>
                </Box>
              ) : null}

              {topDefects.length > 0 ? (
                <Box sx={{ ...CARD_SX, gridColumn: "1 / -1" }}>
                  <Box component="h3" sx={CARD_TITLE_SX}>
                    Top bệnh/lỗi thường gặp
                  </Box>
                  <Box sx={CAPTION_SX}>
                    Số ca bảo hành theo từng bệnh/lỗi trong kỳ đang xem.
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <HorizontalBarChart
                      items={topDefects}
                      limit={8}
                      valueFormatter={formatNumber}
                    />
                  </Box>
                </Box>
              ) : null}
            </Box>
          )}
        </>
      ) : null}

      {data ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          <DashboardActionItems />
          <DashboardRecentActivity />
        </Box>
      ) : null}

      <Box component="section" aria-labelledby="workflow-title">
        <Box
          component="h2"
          id="workflow-title"
          sx={{ ...SECTION_TITLE_SX, mb: 1.5 }}
        >
          Điều hướng luồng nghiệp vụ
        </Box>
        <Stack spacing={1.5}>
          {FLOW_LANES.map((lane) => (
            <Stack
              key={lane.label}
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", alignItems: "center" }}
            >
              <UiStatusBadge tone="primary" label={lane.label} />
              {lane.nodes.map((node, index) => (
                <Stack
                  key={`${lane.label}-${node.label}`}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  {index > 0 ? (
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{ color: S.textMedium }}
                    >
                      →
                    </Box>
                  ) : null}
                  <UiButton
                    size="small"
                    appearance="outlined"
                    onClick={() => node.route && navigate(node.route)}
                    sx={{ cursor: node.route ? "pointer" : "default" }}
                  >
                    {node.label}
                  </UiButton>
                </Stack>
              ))}
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
