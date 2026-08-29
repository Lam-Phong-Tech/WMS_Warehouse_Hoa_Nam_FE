import { RADIUS, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";

/**
 * Ngôn ngữ hình khối của trang Báo cáo vận hành — CỐ Ý trùng với Dashboard
 * (`modules/dashboard/components/dashboard-styles`): card viền mỏng theo token,
 * tiêu đề card 18/600, caption 12 secondary. Hai màn hình này luôn được đọc
 * cạnh nhau nên chỉ được có MỘT nhịp thị giác.
 */
export const RPT_CARD_SX = {
  p: 2,
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  minWidth: 0,
} as const;

export const RPT_CAPTION_SX = {
  fontSize: 12,
  color: S.textMedium,
} as const;

export const RPT_TITLE_SX = {
  m: 0,
  fontSize: TYPOGRAPHY.cardTitle.fontSize,
  fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
  lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
  color: S.textHigh,
} as const;
