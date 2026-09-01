import { useState } from "react";
import { Box, Stack, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { StackedBarChart } from "@/shared/components/charts/StackedBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { INVENTORY_STOCK_STATUS_LABELS } from "@/shared/constants/business-labels";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import type { DashboardOverview, InventoryStockStatus } from "../types";
import { ChartCard, SegmentedToggle } from "./dashboard-ui";
import { formatNumber } from "./dashboard-styles";

type StructureType = "PRODUCT" | "COMPONENT";

const TYPE_OPTIONS: ReadonlyArray<{
  value: StructureType;
  labelKey: MessageKey;
}> = [
  { value: "PRODUCT", labelKey: "dashboard.skuType.product" },
  { value: "COMPONENT", labelKey: "dashboard.skuType.component" },
];

/** Thứ tự "tốt → xấu" để đọc trái sang phải; màu theo mức độ nghiêm trọng. */
const STATUS_ORDER: ReadonlyArray<{
  key: InventoryStockStatus;
  color: string;
}> = [
  { key: "AVAILABLE", color: CHART_COLORS.success },
  { key: "NON_SELLABLE", color: CHART_COLORS.secondary },
  { key: "DEFECTIVE", color: CHART_COLORS.danger },
  { key: "QUARANTINE", color: CHART_COLORS.warning },
];

export function DashboardStockStructure({
  data,
  loading,
}: {
  data: DashboardOverview;
  loading: boolean;
}) {
  const [type, setType] = useState<StructureType>("PRODUCT");
  const t = useT();
  const split = data.stock_structure[type];

  const segments = STATUS_ORDER.map((status) => ({
    label: INVENTORY_STOCK_STATUS_LABELS[status.key],
    value: split[status.key],
    color: status.color,
  }));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <ChartCard
      title={t("dashboard.structure.title")}
      description={t("dashboard.structure.description")}
      toggle={
        <SegmentedToggle
          options={TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          value={type}
          onChange={setType}
          label={t("dashboard.structure.toggleLabel")}
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
      ) : total > 0 ? (
        <>
          <Box
            role="img"
            aria-label={t("dashboard.structure.ariaLabel", {
              type:
                type === "PRODUCT"
                  ? t("dashboard.structure.typeProduct")
                  : t("dashboard.structure.typeComponent"),
              summary: segments
                .map(
                  (segment) =>
                    `${segment.label} ${formatNumber(segment.value)} (${Math.round((segment.value / total) * 100)}%)`,
                )
                .join("; "),
            })}
          >
            <StackedBarChart
              segments={segments}
              valueFormatter={formatNumber}
            />
          </Box>
          {/* Thanh cho tỉ trọng, bảng cho con số tuyệt đối — trục đã là % nên
              nếu không có bảng thì không chỗ nào đọc được lượng tồn thật. */}
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {segments.map((segment) => (
              <Stack
                key={segment.label}
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: `1px solid ${S.border}`,
                  pb: 0.75,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", minWidth: 0 }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: segment.color,
                      flexShrink: 0,
                    }}
                  />
                  <Box
                    sx={{
                      fontSize: TYPOGRAPHY.fontSizeSecondary,
                      color: S.textHigh,
                    }}
                  >
                    {segment.label}
                  </Box>
                </Stack>
                <Box sx={{ fontWeight: 700, color: S.textHigh }}>
                  {formatNumber(segment.value)}
                </Box>
              </Stack>
            ))}
          </Stack>
        </>
      ) : (
        <Box
          sx={{
            py: 5,
            textAlign: "center",
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          {t("dashboard.structure.empty")}
        </Box>
      )}
    </ChartCard>
  );
}
