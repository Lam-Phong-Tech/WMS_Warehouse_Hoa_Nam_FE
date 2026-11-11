import { useLanguageStore } from "./language.store";
import { chineseBusinessLabel } from "./chinese-messages";
import { UI_TEXT_ZH } from "./messages.ui-zh";

/** Localize legacy inline English labels while those screens move to useT(). */
export function localizedEnglish(english: string): string {
  return useLanguageStore.getState().language === "zh"
    ? (UI_TEXT_ZH[english] ?? chineseBusinessLabel(english))
    : english;
}
