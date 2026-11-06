import type { TranslateFn } from "@/shared/i18n/useT";

/** Translate the standard piece unit for display; preserve custom catalog units. */
export function localizedUnitLabel(unit: string, t: TranslateFn): string {
  return unit.normalize("NFC").trim().toLowerCase() === "cái"
    ? t("common.pieces")
    : unit;
}
