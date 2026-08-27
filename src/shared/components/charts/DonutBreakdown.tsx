import { Box, Stack, Typography } from "@mui/material";
import { DonutChart, type DonutChartItem } from "./DonutChart";
import { CATEGORICAL_PALETTE } from "./chart-theme";

export type DonutBreakdownProps = {
  items: DonutChartItem[];
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
};

/**
 * Donut + bảng chi tiết từng mục bên cạnh — dùng cho panel chỉ có một chart,
 * để nội dung LẤP ĐẦY bề rộng card một cách có ý nghĩa thay vì để trống hoặc
 * ép card co hẹp lại. Khớp đúng bố cục "donut + mini-metrics" đã có sẵn ở
 * dashboard (radial-wrap trong wireframe).
 */
export function DonutBreakdown({
  items,
  centerLabel,
  valueFormatter,
}: DonutBreakdownProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const format = (value: number) => valueFormatter?.(value) ?? String(value);
  const resolved = items.map((item, index) => ({
    ...item,
    color:
      item.color ?? CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
  }));

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <Box sx={{ flex: "0 0 auto" }}>
        <DonutChart
          items={resolved}
          centerLabel={centerLabel}
          valueFormatter={valueFormatter}
          legend={false}
        />
      </Box>
      <Stack spacing={1.5} sx={{ flex: "0 1 320px", minWidth: 220 }}>
        {resolved.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <Box
              key={item.label}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    bgcolor: item.color,
                    flex: "none",
                  }}
                />
                <Typography variant="body2" noWrap>
                  {item.label}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, flex: "none", whiteSpace: "nowrap" }}
              >
                {format(item.value)}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 0.75 }}
                >
                  ({pct}%)
                </Typography>
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
