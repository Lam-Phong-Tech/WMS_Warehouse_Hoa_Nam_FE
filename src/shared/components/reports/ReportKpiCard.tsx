import type { ReactNode } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

export type ReportKpiTone =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info";

export type ReportKpiCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: ReportKpiTone;
  icon?: ReactNode;
};

/** KPI mini-card dùng chung cho các trang báo cáo — cùng nhịp với
 * DashboardMetricCard (modules/dashboard) để hai màn hình đồng bộ. */
export function ReportKpiCard({
  label,
  value,
  hint,
  tone = "primary",
  icon,
}: ReportKpiCardProps) {
  const theme = useTheme();
  const toneMain = theme.palette[tone].main;

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "var(--ops-radius-card)", minWidth: 0, height: "100%" }}
    >
      <CardContent
        sx={{ display: "grid", gap: 0.75, "&:last-child": { pb: 2 } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            {label}
          </Typography>
          {icon ? (
            <Box
              sx={{
                width: 30,
                height: 30,
                flex: "none",
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                fontSize: 15,
                color: toneMain,
                bgcolor: alpha(toneMain, 0.12),
              }}
            >
              {icon}
            </Box>
          ) : null}
        </Box>
        <Typography
          sx={{
            fontSize: "clamp(20px, 2.2vw, 28px)",
            fontWeight: 700,
            lineHeight: 1.1,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Lưới KPI co giãn — tối thiểu mỗi thẻ 170px, tự xuống dòng khi hẹp. */
export function ReportKpiGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 1.5,
        marginBottom: 2,
      }}
    >
      {children}
    </Box>
  );
}
