/**
 * Foundation Status badge — chip soft-tint Vuexy: nền soft 16% + chữ đậm cùng
 * dải (bộ `*Soft`/`*Text` của tokens, đã kiểm AA).
 */
import Chip from "@mui/material/Chip";
import type { ChipProps } from "@mui/material/Chip";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";

export type UiStatusTone =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

const TONE_STYLES: Record<UiStatusTone, { bg: string; color: string }> = {
  primary: { bg: S.primarySoft, color: S.infoText },
  success: { bg: S.successSoft, color: S.successText },
  warning: { bg: S.warningSoft, color: S.warningText },
  error: { bg: S.errorSoft, color: S.errorText },
  info: { bg: S.infoSoft, color: S.infoText },
  neutral: { bg: S.secondarySoft, color: S.secondaryDark },
};

export interface UiStatusBadgeProps extends Omit<
  ChipProps,
  "color" | "variant"
> {
  tone?: UiStatusTone;
}

export function UiStatusBadge({
  tone = "neutral",
  sx,
  ...rest
}: UiStatusBadgeProps) {
  const style = TONE_STYLES[tone];
  return (
    <Chip
      size="small"
      sx={[
        {
          backgroundColor: style.bg,
          color: style.color,
          fontWeight: 600,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    />
  );
}
