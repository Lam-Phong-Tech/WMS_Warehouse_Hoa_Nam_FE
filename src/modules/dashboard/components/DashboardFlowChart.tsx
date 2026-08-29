import { useMemo } from "react";
import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { BarChart } from "@/shared/components/charts/BarChart";
import { LineChart } from "@/shared/components/charts/LineChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
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
    name: "Nhập sản phẩm",
    color: CHART_COLORS.success,
  },
  {
    key: "receipt_component",
    name: "Nhập linh kiện",
    color: CHART_COLORS.successDeep,
  },
  {
    key: "issue_product",
    name: "Xuất sản phẩm",
    color: CHART_COLORS.warning,
  },
  {
    key: "issue_component",
    name: "Xuất linh kiện bảo hành",
    color: CHART_COLORS.warningDeep,
  },
] as const;

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
  const buckets = useMemo(
    () =>
      bucketSeries(points, period, (accumulated, next) => ({
        date: accumulated.date,
        receipt_product: accumulated.receipt_product + next.receipt_product,
        receipt_component:
          accumulated.receipt_component + next.receipt_component,
        issue_product: accumulated.issue_product + next.issue_product,
        issue_component: accumulated.issue_component + next.issue_component,
      })),
    [points, period],
  );

  const categories = buckets.map((bucket) => bucket.label);
  const series = SERIES_META.map((meta) => ({
    name: meta.name,
    color: meta.color,
    data: buckets.map((bucket) => bucket.point[meta.key]),
  }));

  const hasData = buckets.some((bucket) =>
    SERIES_META.some((meta) => bucket.point[meta.key] > 0),
  );

  // Nhãn bằng lời cho screen-reader: tổng từng chuỗi, không đọc nổi từng cột.
  const ariaLabel = `Biểu đồ nhập xuất theo thời gian: ${series
    .map(
      (item) =>
        `${item.name} ${formatNumber(item.data.reduce((sum, value) => sum + value, 0))}`,
    )
    .join("; ")}`;

  return (
    <ChartCard
      fullWidth
      title="Nhập – Xuất theo thời gian"
      description="So sánh lượng nhập sản phẩm, nhập linh kiện, xuất sản phẩm và xuất linh kiện bảo hành."
      toggle={
        <SegmentedToggle
          options={FLOW_PERIOD_OPTIONS}
          value={period}
          onChange={onPeriodChange}
          label="Chọn kỳ xem biểu đồ nhập xuất"
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
          Đang tải số liệu…
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
          Kỳ này chưa phát sinh nhập hoặc xuất.
        </Box>
      )}
    </ChartCard>
  );
}
