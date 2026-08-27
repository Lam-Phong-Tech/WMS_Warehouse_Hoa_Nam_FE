/**
 * Foundation Typography — thang chữ canonical (DEC-UI-BASELINE-01).
 * Mỏng trên MUI Typography; mọi số đo lấy từ tokens, không literal.
 */
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui/tokens";

export type UiTextVariant =
  | "pageTitle"
  | "cardTitle"
  | "body"
  | "secondary"
  | "caption";

const VARIANT_SX = {
  pageTitle: {
    fontSize: TYPOGRAPHY.heading.fontSize,
    fontWeight: TYPOGRAPHY.heading.fontWeight,
    lineHeight: TYPOGRAPHY.heading.lineHeight,
    color: S.textHigh,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
    lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
    color: S.textHigh,
  },
  body: {
    fontSize: TYPOGRAPHY.fontSizeBody,
    lineHeight: TYPOGRAPHY.lineHeightBody,
    color: S.textMedium,
  },
  secondary: {
    fontSize: TYPOGRAPHY.fontSizeSecondary,
    color: S.textMedium,
  },
  caption: {
    fontSize: 12,
    color: S.textDisabled,
  },
} as const;

// body dùng "div" thay vì "p": description của state surface nhận ReactNode
// tuỳ ý (có thể chứa block element) — <p> chứa <div> là invalid DOM nesting.
const VARIANT_ELEMENT: Record<UiTextVariant, "h1" | "h2" | "div" | "span"> = {
  pageTitle: "h1",
  cardTitle: "h2",
  body: "div",
  secondary: "span",
  caption: "span",
};

export interface UiTextProps {
  variant?: UiTextVariant;
  children: ReactNode;
  /** Ghi đè màu bằng token (vd SEMANTIC_LIGHT.errorText) — không truyền hex. */
  color?: string;
  className?: string;
}

export function UiText({
  variant = "body",
  children,
  color,
  className,
}: UiTextProps) {
  return (
    <Typography
      component={VARIANT_ELEMENT[variant]}
      className={className}
      sx={{ margin: 0, ...VARIANT_SX[variant], ...(color ? { color } : {}) }}
    >
      {children}
    </Typography>
  );
}
