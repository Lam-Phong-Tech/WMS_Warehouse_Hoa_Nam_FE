/** One persisted interface language for messages, component locales and dates. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { ensureEnglishMessages } from "./english-messages";

export type Language = "vi" | "en";
export type AppLanguage = Language;

export const LANGUAGES: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

function applyDocumentLanguage(language: Language) {
  dayjs.locale(language);
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
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
        if (language === "en") void ensureEnglishMessages();
        set({ language });
      },
    }),
    {
      name: "erp-language",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyDocumentLanguage(state.language);
        if (state.language === "en") void ensureEnglishMessages();
      },
    },
  ),
);

/** Apply the persisted selection before the first screen is rendered. */
export function initializeLanguage() {
  const { language } = useLanguageStore.getState();
  applyDocumentLanguage(language);
  if (language === "en") void ensureEnglishMessages();
}
