import type { ReactNode } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

export type ReportChartPanelProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

/** Khối chart/nội dung có tiêu đề + mô tả ngắn, dùng lặp lại ở nhiều tab báo cáo. */
export function ReportChartPanel({
  title,
  description,
  action,
  children,
}: ReportChartPanelProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: "var(--ops-radius-card)", height: "100%" }}>
      <CardContent sx={{ display: "grid", gap: 1.25 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 1,
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, lineHeight: 1.3 }}
            >
              {title}
            </Typography>
            {description ? (
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
              >
                {description}
              </Typography>
            ) : null}
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

/** Lưới 2 cột (chart chính rộng hơn) — co về 1 cột khi màn hẹp, khớp bố cục
 * report-grid-2 trong wireframe.
 *
 * Khi chỉ có 1 panel (vd donut đơn lẻ ở tab chỉ-có-bảng), việc GIỚI HẠN BỀ
 * RỘNG của panel đó thôi là không đủ — cột thứ 2 (0.85fr) của lưới vẫn được
 * CHIA CHỖ dù không có gì nằm trong đó, nên phần thân container vẫn kéo dài
 * hết hàng và để lại một khoảng trắng rỗng bên phải panel. Phải đổi chính
 * gridTemplateColumns của container về 1 cột hẹp khi chỉ có 1 con, dùng
 * :has() để không phải sửa từng nơi gọi.
 */
export function ReportChartGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
        gap: 2,
        marginBottom: 2,
        "&:has(> :only-child)": {
          gridTemplateColumns: "minmax(0, 480px)",
          // Cột 480px vẫn nằm trong container rộng hết hàng — không canh giữa
          // thì card dồn hẳn về mép trái, khoảng trống dồn hết sang phải trông
          // như bị lỗi/thiếu nội dung. justifyContent canh cả track vào giữa.
          justifyContent: "center",
        },
      }}
    >
      {children}
    </Box>
  );
}
