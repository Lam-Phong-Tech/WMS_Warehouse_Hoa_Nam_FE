/**
 * Foundation Timeline — dòng thời gian dọc tự dựng bằng <ol> (không lib
 * ngoài): chấm 10px màu theo tone (mặc định primary), đường nối 2px màu
 * border token.
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S, SPACING, TYPOGRAPHY } from "@/shared/ui/tokens";
import type { UiStatusTone } from "./UiStatusBadge";

const TONE_DOT: Record<UiStatusTone, string> = {
  primary: S.primary,
  success: S.success,
  warning: S.warning,
  error: S.error,
  info: S.info,
  neutral: S.secondary,
};

const DOT_SIZE = 10;
const LINE_WIDTH = 2;

export interface UiTimelineItem {
  title: ReactNode;
  description?: ReactNode;
  time?: ReactNode;
  tone?: UiStatusTone;
}

export interface UiTimelineProps {
  items: UiTimelineItem[];
}

export function UiTimeline({ items }: UiTimelineProps) {
  return (
    <Box
      component="ol"
      role="list"
      sx={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Box
            component="li"
            key={index}
            sx={{ display: "flex", gap: `${SPACING.md}px` }}
          >
            {/* Cột trái trang trí: chấm tròn + đường nối xuống item kế. */}
            <Box
              aria-hidden
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <Box
                sx={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  flexShrink: 0,
                  borderRadius: "50%",
                  mt: "5px",
                  backgroundColor: TONE_DOT[item.tone ?? "primary"],
                }}
              />
              {!isLast ? (
                <Box
                  sx={{
                    width: LINE_WIDTH,
                    flexGrow: 1,
                    mt: `${SPACING.xs}px`,
                    backgroundColor: S.border,
                  }}
                />
              ) : null}
            </Box>
            <Box sx={{ minWidth: 0, pb: isLast ? 0 : `${SPACING.lg}px` }}>
              <Typography
                component="div"
                sx={{
                  fontSize: TYPOGRAPHY.fontSizeBody,
                  fontWeight: 500,
                  color: S.textHigh,
                }}
              >
                {item.title}
              </Typography>
              {item.time ? (
                <Typography
                  component="div"
                  sx={{ fontSize: 12, color: S.textDisabled }}
                >
                  {item.time}
                </Typography>
              ) : null}
              {item.description ? (
                <Typography
                  component="div"
                  sx={{
                    fontSize: TYPOGRAPHY.fontSizeSecondary,
                    color: S.textMedium,
                  }}
                >
                  {item.description}
                </Typography>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
