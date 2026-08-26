import { useEffect, useMemo, useState } from "react";
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
  LinearProgress,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchDashboardKPI } from "../services/dashboardService";
import type { DashboardKPI, DashboardQuery } from "../types";
import { formatDate } from "@/shared/utils/format-date";
import "./DashboardPage.css";

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
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, minWidth: 0 }}>
      <CardContent sx={{ display: "grid", gap: 0.75, "&:last-child": { pb: 2 } }}>
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

  const [appliedQuery, setAppliedQuery] = useState<DashboardQuery>({});
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [datesInitialized, setDatesInitialized] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: [
      "dashboard",
      "quick",
      appliedQuery.from_date ?? "server-default",
      appliedQuery.to_date ?? "server-default",
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

  useEffect(() => {
    if (!dashboardQuery.data || datesInitialized) return;
    setDraftFrom(dashboardQuery.data.period.from_date);
    setDraftTo(dashboardQuery.data.period.to_date);
    setDatesInitialized(true);
  }, [dashboardQuery.data, datesInitialized]);

  const filterError = useMemo(() => {
    if (Boolean(draftFrom) !== Boolean(draftTo)) {
      return "Cần nhập đủ cả Từ ngày và Đến ngày.";
    }
    if (draftFrom && draftTo && draftTo < draftFrom) {
      return "Đến ngày phải lớn hơn hoặc bằng Từ ngày.";
    }
    return null;
  }, [draftFrom, draftTo]);

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

  const maxFlowValue = Math.max(
    1,
    ...flowMetrics.map((metric) => Math.abs(metric.value)),
  );

  const flowChartLabel = useMemo(() => {
    if (!dashboardQuery.data) return "";
    const series = flowMetrics
      .map((metric) => `${metric.label} ${formatNumber(metric.value)}`)
      .join("; ");
    return `Biểu đồ luồng kho từ ${formatDate(dashboardQuery.data.period.from_date)} đến ${formatDate(dashboardQuery.data.period.to_date)}: ${series}`;
  }, [dashboardQuery.data, flowMetrics]);

  const applyFilter = () => {
    if (filterError) return;
    setAppliedQuery(
      draftFrom && draftTo ? { from_date: draftFrom, to_date: draftTo } : {},
    );
  };

  const resetFilter = () => {
    setDraftFrom("");
    setDraftTo("");
    setDatesInitialized(false);
    setAppliedQuery({});
  };

  const status = getHttpStatus(dashboardQuery.error);
  const data = dashboardQuery.data;
  const empty = data ? isDashboardEmpty(data) : false;
  const warrantyEntries = data
    ? Object.entries(data.warranty_cases_by_status).sort(([a], [b]) =>
        a.localeCompare(b),
      )
    : [];

  return (
    <ThemeProvider theme={muiTheme}>
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
            spacing={2}
            sx={{ mt: 2.5, flexWrap: "wrap", alignItems: "flex-start" }}
          >
            <TextField
              label="Từ ngày"
              type="date"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              disabled={dashboardQuery.isFetching || !canViewReport}
              helperText="Định dạng: ngày/tháng/năm"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Đến ngày"
              type="date"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              disabled={dashboardQuery.isFetching || !canViewReport}
              helperText="Định dạng: ngày/tháng/năm"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: "8px" }}>
              <Button
                variant="contained"
                onClick={applyFilter}
                disabled={
                  Boolean(filterError) ||
                  dashboardQuery.isFetching ||
                  !canViewReport
                }
              >
                {dashboardQuery.isFetching ? "Đang tải…" : "Áp dụng"}
              </Button>
              <Button
                variant="outlined"
                onClick={resetFilter}
                disabled={dashboardQuery.isFetching || !canViewReport}
              >
                Đặt lại
              </Button>
            </Stack>
          </Stack>
          {filterError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {filterError}
            </Alert>
          ) : null}
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
            Dữ liệu được tổng hợp theo múi giờ Việt Nam. Khi không chọn khoảng
            ngày, hệ thống hiển thị 30 ngày gần nhất.
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
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => dashboardQuery.refetch()}
                disabled={dashboardQuery.isFetching}
              >
                Thử lại
              </Button>
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
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Kỳ thống kê: {formatDate(data.period.from_date)} →{" "}
                    {formatDate(data.period.to_date)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
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
                />
                <DashboardMetricCard
                  label="Nhập kho"
                  value={data.receipt_qty}
                  note="Tổng số lượng đã ghi nhận nhập trong kỳ"
                />
                <DashboardMetricCard
                  label="Xuất kho"
                  value={data.issue_qty}
                  note="Tổng số lượng đã ghi nhận xuất trong kỳ"
                />
                <DashboardMetricCard
                  label="Xuất linh kiện"
                  value={data.component_issue_qty}
                  note="Tổng linh kiện đã xuất trong kỳ"
                />
                <DashboardMetricCard
                  label="Điều chỉnh tồn (ròng)"
                  value={data.reversal_net}
                  note="Chênh lệch tăng/giảm tồn do điều chỉnh trong kỳ"
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
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    So sánh quy mô nhập, xuất, xuất linh kiện và điều chỉnh tồn.
                  </Typography>
                  <Box
                    role="img"
                    aria-label={flowChartLabel}
                    sx={{ display: "grid", gap: 1.5, mt: 2 }}
                  >
                    {flowMetrics.map((metric) => (
                      <Box
                        key={metric.key}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 130px) minmax(0, 1fr) auto",
                          gap: 1.25,
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {metric.label}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(Math.abs(metric.value) / maxFlowValue) * 100}
                          sx={{ height: 10, borderRadius: 999 }}
                        />
                        <Typography sx={{ fontWeight: 700 }}>
                          {formatNumber(metric.value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Card>

                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Bảo hành theo trạng thái
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
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
                        Số liệu bảo hành được tổng hợp toàn hệ thống và không
                        giới hạn theo kho.
                      </Typography>
                    </Box>
                  ) : null}
                  {warrantyEntries.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Chưa có ca bảo hành.
                    </Typography>
                  ) : (
                    <Stack spacing={1} sx={{ mt: 2 }}>
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
                              "&::first-letter": { textTransform: "uppercase" },
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
                  )}
                </Card>

                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Đối soát tồn kho
                  </Typography>
                  <Typography sx={{ display: "block", mt: 1.5, mb: 0.5, fontSize: 24, fontWeight: 700 }}>
                    {formatNumber(data.reconciliation_warning_count)} cảnh báo
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Số trường hợp chênh lệch cần kiểm tra tại thời điểm hiện tại.
                  </Typography>
                </Card>
              </Box>
            )}
          </>
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
                <Chip label={lane.label} size="small" color="primary" variant="outlined" />
                {lane.nodes.map((node, index) => (
                  <Stack
                    key={`${lane.label}-${node.label}`}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    {index > 0 ? (
                      <Typography component="span" aria-hidden="true" color="text.secondary">
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
    </ThemeProvider>
  );
}
