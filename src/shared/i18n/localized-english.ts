import { useLanguageStore } from "./language.store";
import { chineseBusinessLabel } from "./chinese-messages";

/** Localize legacy inline English labels while those screens move to useT(). */
export function localizedEnglish(english: string): string {
  return useLanguageStore.getState().language === "zh"
    ? chineseBusinessLabel(english)
    : english;
}
