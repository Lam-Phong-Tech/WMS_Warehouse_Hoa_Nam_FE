import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { LineChart } from "@/shared/components/charts/LineChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import type { DashboardStockTrendPoint } from "../types";
import {
  TREND_PERIOD_OPTIONS,
  bucketSeries,
  type TrendPeriod,
} from "../utils/period";
import { ChartCard, SegmentedToggle } from "./dashboard-ui";
import { formatNumber } from "./dashboard-styles";

export function DashboardStockTrend({
  points,
  period,
  onPeriodChange,
  loading,
}: {
  points: DashboardStockTrendPoint[];
  period: TrendPeriod;
  onPeriodChange: (next: TrendPeriod) => void;
  loading: boolean;
}) {
  // Tuần/tháng đủ thưa nên vẫn vẽ theo ngày; quý/năm gộp bucket (isoWeek/tháng)
  // để đường tồn đọc được xu hướng. Khi gộp, tồn của bucket lấy giá trị NGÀY
  // CUỐI trong bucket (tồn cuối kỳ), không cộng dồn — cộng tồn cuối là vô nghĩa.
  const buckets = bucketSeries(points, period, (accumulated, next) =>
    next.date >= accumulated.date ? next : accumulated,
  );
  const categories = buckets.map((bucket) => bucket.label);
  const values = buckets.map((bucket) => bucket.point.closing_qty);

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = last - first;
  const direction = delta > 0 ? "tăng" : delta < 0 ? "giảm" : "không đổi";

  return (
    <ChartCard
      title="Xu hướng tồn kho"
      description="Tồn khả dụng cuối mỗi ngày, cho thấy tồn đang tăng hay giảm."
      toggle={
        <SegmentedToggle
          options={TREND_PERIOD_OPTIONS}
          value={period}
          onChange={onPeriodChange}
          label="Chọn kỳ xem xu hướng tồn kho"
        />
      }
      footer={
        points.length > 0 && !loading ? (
          <Box
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: `1px solid ${S.border}`,
              fontSize: 12,
              color: S.textMedium,
            }}
          >
            Tồn cuối kỳ {formatNumber(last)} — {direction}{" "}
            {formatNumber(Math.abs(delta))} so với đầu kỳ.
          </Box>
        ) : null
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
      ) : points.length > 0 ? (
        <Box
          role="img"
          aria-label={`Biểu đồ xu hướng tồn kho: đầu kỳ ${formatNumber(first)}, cuối kỳ ${formatNumber(last)}, ${direction} ${formatNumber(Math.abs(delta))}.`}
        >
          <LineChart
            categories={categories}
            series={[
              {
                name: "Tồn khả dụng",
                data: values,
                color: CHART_COLORS.primary,
              },
            ]}
            height={280}
            valueFormatter={formatNumber}
          />
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
          Chưa có dữ liệu tồn trong kỳ.
        </Box>
      )}
    </ChartCard>
  );
}
