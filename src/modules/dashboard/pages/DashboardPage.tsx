import { useMemo, useState, type ReactElement } from "react";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
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
import "./DashboardPage.css";
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
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactElement;
  color: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, minWidth: 0 }}>
      <CardContent
        sx={{ display: "grid", gap: 0.75, "&:last-child": { pb: 2 } }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            color,
            bgcolor: `${color}1a`,
          }}
          aria-hidden="true"
        >
          {icon}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: "clamp(22px, 2.5vw, 30px)",
            fontWeight: 700,
            overflowWrap: "anywhere",
          }}
        >
          {formatNumber(value)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** Khối trạng thái (không quyền / đang tải / lỗi / rỗng) — 2 Typography tách
 * riêng để test getByText khớp chính xác từng câu, không gộp chung 1 node. */
function DashboardStateAlert({
  severity,
  title,
  description,
  role,
  action,
}: {
  severity: "warning" | "info" | "error";
  title: string;
  description: string;
  role?: string;
  action?: React.ReactNode;
}) {
  return (
    <Alert severity={severity} role={role}>
      <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
        <Typography component="strong" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2">{description}</Typography>
        {action}
      </Stack>
    </Alert>
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
      dashboardQuery.data?.period.from_date,
      dashboardQuery.data?.period.to_date,
    ],
    queryFn: () =>
      http.get<{ by_defect?: Array<{ defect: unknown; total: unknown }> }>(
        API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
        {
          params: {
            from_date: dashboardQuery.data?.period.from_date,
            to_date: dashboardQuery.data?.period.to_date,
          },
        },
      ),
    enabled: canViewReport && Boolean(dashboardQuery.data),
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
    <div className="hn-dashboard-page">
      <Paper
        component="section"
        aria-labelledby="dashboard-title"
        variant="outlined"
        sx={{ p: 3, borderRadius: 2 }}
      >
        <Chip label="Tổng quan vận hành" size="small" sx={{ mb: 1.5 }} />
        <Typography variant="h4" id="dashboard-title" sx={{ mb: 0.5 }}>
          Tổng quan kho
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Theo dõi tồn khả dụng, nhập kho, xuất kho, bảo hành và các cảnh báo
          đối soát trên cùng một màn hình.
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          role="group"
          aria-label="Chọn kỳ xem nhanh"
          sx={{ mt: 2.5, flexWrap: "wrap" }}
        >
          {DASHBOARD_PERIOD_PRESETS.map((option) => (
            <Button
              key={option.value}
              variant={preset === option.value ? "contained" : "outlined"}
              onClick={() => setPreset(option.value)}
              disabled={!canViewReport}
            >
              {option.label}
            </Button>
          ))}
          {dashboardQuery.isFetching ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ alignSelf: "center", ml: 1 }}
            >
              Đang tải…
            </Typography>
          ) : null}
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            mt: 2.5,
            pt: 1.5,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          Dữ liệu được tổng hợp theo múi giờ Việt Nam. Cần xem chi tiết theo
          ngày/tháng/khoảng ngày tuỳ ý — vào mục Báo cáo.
        </Typography>
      </Paper>

      {isProfileLoaded && !canViewReport ? (
        <DashboardStateAlert
          severity="warning"
          title="Không có quyền xem báo cáo tổng quan."
          description="Vui lòng liên hệ quản trị viên nếu bạn cần quyền truy cập."
        />
      ) : null}

      {canViewReport && dashboardQuery.isLoading ? (
        <DashboardStateAlert
          severity="info"
          title="Đang tải số liệu tổng quan…"
          description="Hệ thống đang tổng hợp dữ liệu vận hành."
        />
      ) : null}

      {canViewReport && dashboardQuery.isError ? (
        <DashboardStateAlert
          severity="error"
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
                <Typography variant="h6" id="dashboard-kpi-title">
                  Chỉ số vận hành
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  Kỳ thống kê: {formatDate(data.period.from_date)} →{" "}
                  {formatDate(data.period.to_date)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  Phạm vi dữ liệu:{" "}
                  {data.data_scope === "GLOBAL"
                    ? "Toàn hệ thống"
                    : `Theo ${data.scope_warehouse_ids?.length ?? 0} kho bạn được phân quyền`}
                </Typography>
              </Box>
              <Chip label="Dữ liệu hệ thống" size="small" variant="outlined" />
            </Box>

            <Box className="hn-dashboard-kpi-grid">
              <DashboardMetricCard
                label="Tồn khả dụng"
                value={data.available_qty}
                note="Số lượng hiện có thể sử dụng"
                icon={<StockOutlined />}
                color={CHART_COLORS.primary}
              />
              <DashboardMetricCard
                label="Nhập kho"
                value={data.receipt_qty}
                note="Tổng số lượng đã ghi nhận nhập trong kỳ"
                icon={<ImportOutlined />}
                color={CHART_COLORS.success}
              />
              <DashboardMetricCard
                label="Xuất kho"
                value={data.issue_qty}
                note="Tổng số lượng đã ghi nhận xuất trong kỳ"
                icon={<ExportOutlined />}
                color={CHART_COLORS.warning}
              />
              <DashboardMetricCard
                label="Xuất linh kiện"
                value={data.component_issue_qty}
                note="Tổng linh kiện đã xuất trong kỳ"
                icon={<ToolOutlined />}
                color={CHART_COLORS.info}
              />
              <DashboardMetricCard
                label="Điều chỉnh tồn (ròng)"
                value={data.reversal_net}
                note="Chênh lệch tăng/giảm tồn do điều chỉnh trong kỳ"
                icon={<SwapOutlined />}
                color={CHART_COLORS.violet}
              />
            </Box>
          </Box>

          {empty ? (
            <DashboardStateAlert
              severity="info"
              title="Không có số liệu trong kỳ."
              description="Chưa phát sinh dữ liệu vận hành trong khoảng ngày đã chọn."
            />
          ) : (
            <Box
              component="section"
              aria-label="Biểu đồ tổng quan"
              className="hn-dashboard-grid"
            >
              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Biểu đồ luồng kho trong kỳ
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  So sánh quy mô nhập, xuất, xuất linh kiện và điều chỉnh tồn.
                </Typography>
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
              </Card>

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Bảo hành theo trạng thái
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  Tổng hợp các ca bảo hành hiện có trong hệ thống.
                </Typography>
                {data.data_scope === "WAREHOUSE_SCOPED" ? (
                  <Box
                    role="note"
                    sx={{
                      mt: 1.25,
                      pl: 1.25,
                      py: 0.75,
                      borderLeft: "3px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Số liệu bảo hành được tổng hợp toàn hệ thống và không giới
                      hạn theo kho.
                    </Typography>
                  </Box>
                ) : null}
                {warrantyEntries.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 2 }}
                  >
                    Chưa có ca bảo hành.
                  </Typography>
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
                            borderBottom: "1px solid",
                            borderColor: "divider",
                            pb: 1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              textTransform: "lowercase",
                              "&::first-letter": {
                                textTransform: "uppercase",
                              },
                            }}
                          >
                            {WARRANTY_STATUS_LABELS[warrantyStatus] ??
                              warrantyStatus.replaceAll("_", " ")}
                          </Typography>
                          <Typography sx={{ fontWeight: 700 }}>
                            {formatNumber(count)}
                          </Typography>
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
              </Card>

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Đối soát tồn kho
                </Typography>
                <Typography
                  sx={{
                    display: "block",
                    mt: 1.5,
                    mb: 0.5,
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {formatNumber(data.reconciliation_warning_count)} cảnh báo
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Số trường hợp chênh lệch cần kiểm tra tại thời điểm hiện tại.
                </Typography>
              </Card>

              <Card
                variant="outlined"
                onClick={() => navigate(ROUTES.MASTER_DATA)}
                sx={{ p: 2, borderRadius: 2, cursor: "pointer" }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Tồn dưới định mức
                </Typography>
                <Typography
                  sx={{
                    display: "block",
                    mt: 1.5,
                    mb: 0.5,
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {formatNumber(data.below_min_stock_count)} SKU
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  SKU có định mức tối thiểu và tổng tồn khả dụng (mọi kho) thấp
                  hơn định mức.
                </Typography>
              </Card>

              <Card
                variant="outlined"
                onClick={() => navigate(ROUTES.MASTER_DATA)}
                sx={{ p: 2, borderRadius: 2, cursor: "pointer" }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Tồn vượt định mức
                </Typography>
                <Typography
                  sx={{
                    display: "block",
                    mt: 1.5,
                    mb: 0.5,
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {formatNumber(data.above_max_stock_count)} SKU
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  SKU có định mức tối đa và tổng tồn khả dụng (mọi kho) cao hơn
                  định mức.
                </Typography>
              </Card>

              {dailyPoints.length > 0 ? (
                <Card
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2, gridColumn: "1 / -1" }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Nhập / Xuất theo ngày
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block" }}
                  >
                    So sánh lượng hàng nhập và xuất theo từng ngày trong kỳ đang
                    xem.
                  </Typography>
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
                </Card>
              ) : null}

              {dailyPoints.length > 0 ? (
                <Card
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2, gridColumn: "1 / -1" }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Xu hướng bảo hành
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block" }}
                  >
                    Số ca bảo hành mới tiếp nhận theo từng ngày trong kỳ đang
                    xem.
                  </Typography>
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
                </Card>
              ) : null}

              {topDefects.length > 0 ? (
                <Card
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2, gridColumn: "1 / -1" }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Top bệnh/lỗi thường gặp
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block" }}
                  >
                    Số ca bảo hành theo từng bệnh/lỗi trong kỳ đang xem.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <HorizontalBarChart
                      items={topDefects}
                      limit={8}
                      valueFormatter={formatNumber}
                    />
                  </Box>
                </Card>
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
        <Typography variant="h6" id="workflow-title" sx={{ mb: 1.5 }}>
          Điều hướng luồng nghiệp vụ
        </Typography>
        <Stack spacing={1.5}>
          {FLOW_LANES.map((lane) => (
            <Stack
              key={lane.label}
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", alignItems: "center" }}
            >
              <Chip
                label={lane.label}
                size="small"
                color="primary"
                variant="outlined"
              />
              {lane.nodes.map((node, index) => (
                <Stack
                  key={`${lane.label}-${node.label}`}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  {index > 0 ? (
                    <Typography
                      component="span"
                      aria-hidden="true"
                      color="text.secondary"
                    >
                      →
                    </Typography>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => node.route && navigate(node.route)}
                    sx={{ cursor: node.route ? "pointer" : "default" }}
                  >
                    {node.label}
                  </Button>
                </Stack>
              ))}
            </Stack>
          ))}
        </Stack>
      </Box>
    </div>
  );
}
