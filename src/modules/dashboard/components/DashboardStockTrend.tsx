import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { LineChart } from "@/shared/components/charts/LineChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { useT } from "@/shared/i18n/useT";
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
  const t = useT();
  const buckets = bucketSeries(
    points,
    period,
    (accumulated, next) => (next.date >= accumulated.date ? next : accumulated),
    t,
  );
  const categories = buckets.map((bucket) => bucket.label);
  const values = buckets.map((bucket) => bucket.point.closing_qty);

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = last - first;
  const direction =
    delta > 0
      ? t("dashboard.trend.directionUp")
      : delta < 0
        ? t("dashboard.trend.directionDown")
        : t("dashboard.trend.directionFlat");

  return (
    <ChartCard
      title={t("dashboard.trend.title")}
      description={t("dashboard.trend.description")}
      toggle={
        <SegmentedToggle
          options={TREND_PERIOD_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          value={period}
          onChange={onPeriodChange}
          label={t("dashboard.trend.toggleLabel")}
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
            {t("dashboard.trend.footer", {
              last: formatNumber(last),
              direction,
              delta: formatNumber(Math.abs(delta)),
            })}
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
          {t("common.loadingData")}
        </Box>
      ) : points.length > 0 ? (
        <Box
          role="img"
          aria-label={t("dashboard.trend.ariaLabel", {
            first: formatNumber(first),
            last: formatNumber(last),
            direction,
            delta: formatNumber(Math.abs(delta)),
          })}
        >
          <LineChart
            categories={categories}
            series={[
              {
                name: t("dashboard.trend.seriesName"),
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
          {t("dashboard.trend.empty")}
        </Box>
      )}
    </ChartCard>
  );
}
