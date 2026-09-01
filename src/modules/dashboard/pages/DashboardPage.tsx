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
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
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

type FlowNode = { labelKey: MessageKey; route?: string };
type FlowLane = { labelKey: MessageKey; nodes: FlowNode[] };

const FLOW_LANES: FlowLane[] = [
  {
    labelKey: "dashboard.workflow.laneInbound",
    nodes: [
      { labelKey: "dashboard.workflow.receiptList", route: ROUTES.INBOUND },
      { labelKey: "dashboard.workflow.createDraft", route: ROUTES.INBOUND },
      { labelKey: "dashboard.workflow.scanGoods", route: ROUTES.INBOUND },
      { labelKey: "dashboard.workflow.postReceipt", route: ROUTES.INBOUND },
      {
        labelKey: "dashboard.workflow.componentsAwaitingTray",
        route: ROUTES.PUTAWAY,
      },
      { labelKey: "dashboard.workflow.putaway", route: ROUTES.PUTAWAY },
    ],
  },
  {
    labelKey: "dashboard.workflow.laneOutbound",
    nodes: [
      { labelKey: "dashboard.workflow.issueRequest", route: ROUTES.OUTBOUND },
      { labelKey: "dashboard.workflow.importExcel", route: ROUTES.OUTBOUND },
      { labelKey: "dashboard.workflow.issueList", route: ROUTES.OUTBOUND },
      { labelKey: "dashboard.workflow.issueDetail", route: ROUTES.OUTBOUND },
      { labelKey: "dashboard.workflow.scanReconcile", route: ROUTES.OUTBOUND },
      { labelKey: "dashboard.workflow.printLabel", route: ROUTES.OUTBOUND },
      { labelKey: "dashboard.workflow.rfidIssue", route: ROUTES.OUTBOUND },
    ],
  },
  {
    labelKey: "dashboard.workflow.laneWarranty",
    nodes: [
      { labelKey: "dashboard.workflow.warrantyList", route: ROUTES.WARRANTY },
      { labelKey: "dashboard.workflow.warrantyIntake", route: ROUTES.WARRANTY },
      { labelKey: "dashboard.workflow.warrantyDetail", route: ROUTES.WARRANTY },
      { labelKey: "dashboard.workflow.componentIssue", route: ROUTES.WARRANTY },
    ],
  },
  {
    labelKey: "dashboard.workflow.laneControl",
    nodes: [
      { labelKey: "dashboard.workflow.stockLookup", route: ROUTES.INVENTORY },
      { labelKey: "dashboard.workflow.trace", route: ROUTES.SCAN },
      { labelKey: "dashboard.workflow.adjustmentList", route: ROUTES.REVERSE },
      {
        labelKey: "dashboard.workflow.createAdjustment",
        route: ROUTES.REVERSE,
      },
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
  const t = useT();
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
          label={t("dashboard.badge")}
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
          {t("dashboard.title")}
        </Box>
        <Box
          sx={{ fontSize: TYPOGRAPHY.fontSizeSecondary, color: S.textMedium }}
        >
          {t("dashboard.subtitle")}
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
            {t("dashboard.periodCaption", {
              from: formatDate(data.period.from_date),
              to: formatDate(data.period.to_date),
            })}
          </Box>
        ) : null}
      </Box>

      {isProfileLoaded && !canViewReport ? (
        <DashboardStateAlert
          tone="warning"
          title={t("dashboard.state.noPermissionTitle")}
          description={t("dashboard.state.noPermissionDesc")}
        />
      ) : null}

      {canViewReport && query.isLoading ? (
        <DashboardStateAlert
          tone="info"
          title={t("dashboard.state.loadingTitle")}
          description={t("dashboard.state.loadingDesc")}
        />
      ) : null}

      {canViewReport && query.isError ? (
        <DashboardStateAlert
          tone="error"
          title={
            status === 403
              ? t("dashboard.state.errorForbidden")
              : status === 422
                ? t("dashboard.state.errorInvalidRange")
                : t("dashboard.state.errorGeneric")
          }
          description={
            status === 401
              ? t("dashboard.state.errorSessionExpired")
              : t("dashboard.state.errorNoStale")
          }
          action={
            <ActionButton
              kind="refresh"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              {t("common.retry")}
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
          {t("dashboard.workflow.title")}
        </Box>
        <Stack spacing={1.5}>
          {FLOW_LANES.map((lane) => (
            <Stack
              key={lane.labelKey}
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", alignItems: "center" }}
            >
              <UiStatusBadge tone="primary" label={t(lane.labelKey)} />
              {lane.nodes.map((node, index) => (
                <Stack
                  key={`${lane.labelKey}-${node.labelKey}`}
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
                    {t(node.labelKey)}
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
