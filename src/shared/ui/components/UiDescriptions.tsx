/**
 * Foundation Descriptions — lưới nhãn/giá trị cho màn chi tiết (thay antd
 * Descriptions và pattern DetailField của ReversalDetailModal): label caption
 * 12 textMedium, value body 15 textHigh. Grid responsive: 1 cột <sm, 2 cột
 * <lg, `columns` cột từ lg trở lên.
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S, SPACING, TYPOGRAPHY } from "@/shared/ui/tokens";

export interface UiDescriptionsItem {
  label: ReactNode;
  value: ReactNode;
  /** Số cột item chiếm ở màn rộng (bị kẹp theo số cột thực tế). */
  span?: 1 | 2 | 3;
}

export interface UiDescriptionsProps {
  items: UiDescriptionsItem[];
  /** Số cột ở màn ≥lg. Mặc định 3. */
  columns?: number;
}

export function UiDescriptions({ items, columns = 3 }: UiDescriptionsProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: `${SPACING.lg}px`,
        gridTemplateColumns: {
          xs: "repeat(1, minmax(0, 1fr))",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: `repeat(${columns}, minmax(0, 1fr))`,
        },
      }}
    >
      {items.map((item, index) => {
        const span = item.span ?? 1;
        return (
          <Box
            key={index}
            sx={{
              minWidth: 0,
              gridColumn: {
                xs: "span 1",
                sm: `span ${Math.min(span, 2)}`,
                lg: `span ${Math.min(span, columns)}`,
              },
            }}
          >
            <Typography
              component="div"
              sx={{ fontSize: 12, color: S.textMedium }}
            >
              {item.label}
            </Typography>
            <Typography
              component="div"
              sx={{
                fontSize: TYPOGRAPHY.fontSizeBody,
                lineHeight: TYPOGRAPHY.lineHeightBody,
                color: S.textHigh,
                overflowWrap: "anywhere",
              }}
            >
              {item.value}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
