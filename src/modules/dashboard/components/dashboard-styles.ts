import { SEMANTIC_LIGHT as S, RADIUS, TYPOGRAPHY } from "@/shared/ui";

/** Khung card viền mỏng theo token — dùng chung cho mọi khối của dashboard. */
export const CARD_SX = {
  p: 2,
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
} as const;

export const CAPTION_SX = {
  fontSize: 12,
  color: S.textMedium,
} as const;

export const SECTION_TITLE_SX = {
  m: 0,
  fontSize: TYPOGRAPHY.cardTitle.fontSize,
  fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
  lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
  color: S.textHigh,
} as const;

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}
