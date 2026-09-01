import { useMemo } from "react";
import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { BarChart } from "@/shared/components/charts/BarChart";
import { LineChart } from "@/shared/components/charts/LineChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import type { DashboardFlowPoint } from "../types";
import {
  bucketSeries,
  isColumnPeriod,
  FLOW_PERIOD_OPTIONS,
  type FlowPeriod,
} from "../utils/period";
import { ChartCard, SegmentedToggle } from "./dashboard-ui";
import { formatNumber } from "./dashboard-styles";

/** Nhập = xanh lá, Xuất = cam; linh kiện dùng tông đậm hơn của CÙNG sắc. */
const SERIES_META = [
  {
    key: "receipt_product",
    nameKey: "dashboard.flowChart.receiptProduct",
    color: CHART_COLORS.success,
  },
  {
    key: "receipt_component",
    nameKey: "dashboard.flowChart.receiptComponent",
    color: CHART_COLORS.successDeep,
  },
  {
    key: "issue_product",
    nameKey: "dashboard.flowChart.issueProduct",
    color: CHART_COLORS.warning,
  },
  {
    key: "issue_component",
    nameKey: "dashboard.flowChart.issueComponent",
    color: CHART_COLORS.warningDeep,
  },
] as const satisfies ReadonlyArray<{
  key: string;
  nameKey: MessageKey;
  color: string;
}>;

export function DashboardFlowChart({
  points,
  period,
  onPeriodChange,
  loading,
}: {
  points: DashboardFlowPoint[];
  period: FlowPeriod;
  onPeriodChange: (next: FlowPeriod) => void;
  loading: boolean;
}) {
  const t = useT();
  const buckets = useMemo(
    () =>
      bucketSeries(
        points,
        period,
        (accumulated, next) => ({
          date: accumulated.date,
          receipt_product: accumulated.receipt_product + next.receipt_product,
          receipt_component:
            accumulated.receipt_component + next.receipt_component,
          issue_product: accumulated.issue_product + next.issue_product,
          issue_component: accumulated.issue_component + next.issue_component,
        }),
        t,
      ),
    [points, period, t],
  );

  const categories = buckets.map((bucket) => bucket.label);
  const series = SERIES_META.map((meta) => ({
    name: t(meta.nameKey),
    color: meta.color,
    data: buckets.map((bucket) => bucket.point[meta.key]),
  }));

  const hasData = buckets.some((bucket) =>
    SERIES_META.some((meta) => bucket.point[meta.key] > 0),
  );

  // Nhãn bằng lời cho screen-reader: tổng từng chuỗi, không đọc nổi từng cột.
  const ariaLabel = t("dashboard.flowChart.ariaLabel", {
    summary: series
      .map(
        (item) =>
          `${item.name} ${formatNumber(item.data.reduce((sum, value) => sum + value, 0))}`,
      )
      .join("; "),
  });

  return (
    <ChartCard
      fullWidth
      title={t("dashboard.flowChart.title")}
      description={t("dashboard.flowChart.description")}
      toggle={
        <SegmentedToggle
          options={FLOW_PERIOD_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          value={period}
          onChange={onPeriodChange}
          label={t("dashboard.flowChart.toggleLabel")}
        />
      }
    >
      {loading ? (
        <Box
          sx={{
            py: 5,
            textAlign: "center",
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          {t("common.loadingData")}
        </Box>
      ) : hasData ? (
        <Box role="img" aria-label={ariaLabel}>
          {isColumnPeriod(period) ? (
            <BarChart
              categories={categories}
              series={series}
              height={320}
              valueFormatter={formatNumber}
            />
          ) : (
            <LineChart
              categories={categories}
              series={series}
              height={320}
              valueFormatter={formatNumber}
            />
          )}
        </Box>
      ) : (
        <Box
          sx={{
            py: 5,
            textAlign: "center",
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          {t("dashboard.flowChart.empty")}
        </Box>
      )}
    </ChartCard>
  );
}
