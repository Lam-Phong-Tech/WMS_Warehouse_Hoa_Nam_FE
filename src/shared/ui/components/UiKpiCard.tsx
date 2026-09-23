/**
 * Foundation KPI card — số liệu tổng quan dashboard: ô icon vuông 40px nền
 * soft + value 22/600 (TYPOGRAPHY.kpi), label secondary 13. Cùng ngôn ngữ
 * card của UiCard (radius card + shadowCard).
 */
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import {
  COMPONENT_TOKENS as C,
  RADIUS,
  SEMANTIC_LIGHT as S,
  SPACING,
  TYPOGRAPHY,
} from "@/shared/ui/tokens";
import { UiIcon } from "./UiIcon";
import type { UiStatusTone } from "./UiStatusBadge";

const TONE_STYLES: Record<UiStatusTone, { bg: string; color: string }> = {
  primary: { bg: S.primarySoft, color: S.infoText },
  success: { bg: S.successSoft, color: S.successText },
  warning: { bg: S.warningSoft, color: S.warningText },
  error: { bg: S.errorSoft, color: S.errorText },
  info: { bg: S.infoSoft, color: S.infoText },
  neutral: { bg: S.secondarySoft, color: S.secondaryDark },
};

/** Cạnh ô icon vuông của KPI card (spec X §KPI). */
const ICON_BOX_SIZE = 40;

export interface UiKpiCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Slug icon Flaticon rounded-regular (fi-rr-*), vd "box", "chart-histogram". */
  icon?: string;
  tone?: UiStatusTone;
  /** Chú thích phụ dưới value (vd so sánh kỳ trước). */
  hint?: ReactNode;
}

export function UiKpiCard({
  label,
  value,
  icon,
  tone = "primary",
  hint,
}: UiKpiCardProps) {
  const toneStyle = TONE_STYLES[tone];
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: `${C.card.radius}px`,
        boxShadow: C.card.shadow,
        p: `${C.card.paddingMobile}px`,
        display: "flex",
        alignItems: "center",
        gap: `${SPACING.md}px`,
      }}
    >
      {icon ? (
        <Box
          sx={{
            width: ICON_BOX_SIZE,
            height: ICON_BOX_SIZE,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: `${RADIUS.control}px`,
            backgroundColor: toneStyle.bg,
            color: toneStyle.color,
          }}
        >
          <UiIcon name={icon} size="lg" />
        </Box>
      ) : null}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="div"
          sx={{ fontSize: TYPOGRAPHY.fontSizeSecondary, color: S.textMedium }}
        >
          {label}
        </Typography>
        <Typography
          component="div"
          sx={{
            fontSize: TYPOGRAPHY.kpi.fontSize,
            fontWeight: TYPOGRAPHY.kpi.fontWeight,
            lineHeight: TYPOGRAPHY.kpi.lineHeight,
            color: S.textHigh,
          }}
        >
          {value}
        </Typography>
        {hint ? (
          <Typography
            component="div"
            sx={{ fontSize: 12, color: S.textDisabled }}
          >
            {hint}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}
