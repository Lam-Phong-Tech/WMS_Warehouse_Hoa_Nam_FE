import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiStatusBadge,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import { ActionButton } from "@/shared/components/actions";
import { formatDate } from "@/shared/utils/format-date";
import {
  useDashboardOverview,
  getHttpStatus,
} from "../hooks/use-dashboard-overview";
import {
  getPeriodRange,
  type FlowPeriod,
  type TrendPeriod,
} from "../utils/period";
import { DashboardKpiSection } from "../components/DashboardKpiSection";
import { DashboardStockThreshold } from "../components/DashboardStockThreshold";
import { DashboardHighlights } from "../components/DashboardHighlights";
import { DashboardFlowChart } from "../components/DashboardFlowChart";
import { DashboardStockTrend } from "../components/DashboardStockTrend";
import { DashboardStockStructure } from "../components/DashboardStockStructure";
import { DashboardWarrantyStatus } from "../components/DashboardWarrantyStatus";
import { DashboardIssues } from "../components/DashboardIssues";
import { OverdueWarrantyDialog } from "../components/OverdueWarrantyDialog";
import {
  CARD_SX,
  CAPTION_SX,
  SECTION_TITLE_SX,
} from "../components/dashboard-styles";

type FlowNode = { label: string; route?: string };
type FlowLane = { label: string; nodes: FlowNode[] };

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

/** Khối trạng thái (không quyền / đang tải / lỗi) — title và description tách
 * riêng để test khớp chính xác từng câu, không gộp chung 1 node. */
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

  const [flowPeriod, setFlowPeriod] = useState<FlowPeriod>("week");
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("week");
  const [overdueOpen, setOverdueOpen] = useState(false);

  // Một query duy nhất cho cả trang. Kỳ của 2 chart có thể khác nhau nên lấy khoảng
  // rộng hơn trong hai kỳ rồi cắt ở client — tránh 2 request cho cùng một payload.
  const range = useMemo(() => {
    const flow = getPeriodRange(flowPeriod);
    const trend = getPeriodRange(trendPeriod);
    return {
      from_date:
        flow.from_date < trend.from_date ? flow.from_date : trend.from_date,
      to_date: flow.to_date > trend.to_date ? flow.to_date : trend.to_date,
    };
  }, [flowPeriod, trendPeriod]);

  const query = useDashboardOverview(range, canViewReport);
  const data = query.data;
  const status = getHttpStatus(query.error);

  const trendRange = useMemo(() => getPeriodRange(trendPeriod), [trendPeriod]);
  const flowRange = useMemo(() => getPeriodRange(flowPeriod), [flowPeriod]);

  const flowPoints = useMemo(
    () =>
      (data?.flow_daily ?? []).filter(
        (point) =>
          point.date >= flowRange.from_date && point.date <= flowRange.to_date,
      ),
    [data, flowRange],
  );
  const trendPoints = useMemo(
    () =>
      (data?.stock_trend ?? []).filter(
        (point) =>
          point.date >= trendRange.from_date &&
          point.date <= trendRange.to_date,
      ),
    [data, trendRange],
  );

  return (
    <Box
      data-mvp-screen="MAP-01"
      sx={{
        display: "grid",
        gap: 2,
        // Grid item mặc định là min-width:auto nên nó nở tới max-content thay vì
        // co theo track. Thiếu dòng này, hàng "tiêu đề + nhóm nút" của khối KPI
        // đẩy cả section rộng hơn cột và nút cuối bị cắt khỏi màn hình ở 375px.
        "& > *": { minWidth: 0 },
      }}
    >
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
          Theo dõi tồn kho, nhập xuất, bảo hành và các vấn đề cần xử lý trên
          cùng một màn hình.
        </Box>
        {data?.period?.from_date ? (
          <Box
            sx={{
              ...CAPTION_SX,
              mt: 2.5,
              pt: 1.5,
              borderTop: `1px solid ${S.border}`,
            }}
          >
            Kỳ đang xem: {formatDate(data.period.from_date)} →{" "}
            {formatDate(data.period.to_date)}. Dữ liệu tổng hợp theo múi giờ
            Việt Nam.
          </Box>
        ) : null}
      </Box>

      {isProfileLoaded && !canViewReport ? (
        <DashboardStateAlert
          tone="warning"
          title="Không có quyền xem báo cáo tổng quan."
          description="Vui lòng liên hệ quản trị viên nếu bạn cần quyền truy cập."
        />
      ) : null}

      {canViewReport && query.isLoading ? (
        <DashboardStateAlert
          tone="info"
          title="Đang tải số liệu tổng quan…"
          description="Hệ thống đang tổng hợp dữ liệu vận hành."
        />
      ) : null}

      {canViewReport && query.isError ? (
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
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              Thử lại
            </ActionButton>
          }
        />
      ) : null}

      {data ? (
        <>
          <DashboardKpiSection data={data} />
          <DashboardStockThreshold data={data} />
          <DashboardHighlights data={data} />

          <DashboardFlowChart
            points={flowPoints}
            period={flowPeriod}
            onPeriodChange={setFlowPeriod}
            loading={query.isFetching}
          />

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                lg: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            <DashboardStockTrend
              points={trendPoints}
              period={trendPeriod}
              onPeriodChange={setTrendPeriod}
              loading={query.isFetching}
            />
            <DashboardStockStructure data={data} loading={query.isFetching} />
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                lg: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            <DashboardWarrantyStatus
              data={data}
              loading={query.isFetching}
              onShowOverdue={() => setOverdueOpen(true)}
            />
            <DashboardIssues
              data={data}
              loading={query.isFetching}
              onShowOverdue={() => setOverdueOpen(true)}
            />
          </Box>

          <OverdueWarrantyDialog
            open={overdueOpen}
            onClose={() => setOverdueOpen(false)}
            cases={data.warranty.overdue_sample}
            total={data.warranty.overdue_count}
          />
        </>
      ) : null}

      <Box component="section" aria-labelledby="workflow-title">
        <Box
          component="h2"
          id="workflow-title"
          sx={{ ...SECTION_TITLE_SX, mb: 1.5 }}
        >
          Luồng nghiệp vụ
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
