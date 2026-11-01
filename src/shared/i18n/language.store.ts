/** One persisted interface language for messages, component locales and dates. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import "dayjs/locale/zh-cn";
import { ensureEnglishMessages } from "./english-messages";
import { ensureChineseMessages } from "./chinese-messages";

export type Language = "vi" | "en" | "zh";
export type AppLanguage = Language;

export const LANGUAGES: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "zh", label: "简体中文" },
];

function applyDocumentLanguage(language: Language) {
  dayjs.locale(language === "zh" ? "zh-cn" : language);
  if (typeof document !== "undefined") {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  }
}

function ensureMessages(language: Language) {
  if (language === "en") void ensureEnglishMessages();
  if (language === "zh") void ensureChineseMessages();
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "vi",
      setLanguage: (language) => {
        applyDocumentLanguage(language);
        ensureMessages(language);
        set({ language });
      },
    }),
    {
      name: "erp-language",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyDocumentLanguage(state.language);
        ensureMessages(state.language);
      },
    },
  ),
);

/** Apply the persisted selection before the first screen is rendered. */
export function initializeLanguage() {
  const { language } = useLanguageStore.getState();
  applyDocumentLanguage(language);
  ensureMessages(language);
}
