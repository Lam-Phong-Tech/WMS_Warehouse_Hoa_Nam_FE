import type { TranslateFn } from "@/shared/i18n/useT";

/** Compute labels at render time; importing this module never captures a locale. */
export const reportTopOptions = <const Counts extends readonly number[]>(
  counts: Counts,
  t: TranslateFn,
) =>
  counts.map((count) => ({
    value: String(count) as `${Counts[number]}`,
    label: t("shared.table.topCount", { count }),
  }));
