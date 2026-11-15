import { afterEach, expect, it } from "vitest";
import { FRONTEND_SERVICE_MESSAGES } from "./frontend-service-catalog";
import { localizeMessage } from "./localize-message";
import { useLanguageStore } from "./language.store";
import { ensureEnglishMessages } from "./english-messages";
import { ensureChineseMessages } from "./chinese-messages";

const concrete = (value: string) =>
  value.replace(
    /\{value(\d+)\}/g,
    (_, index: string) => `DATA-${index}-4344SFDFS`,
  );
afterEach(() => useLanguageStore.getState().setLanguage("vi"));
it.each(["en", "zh"] as const)(
  "localizes all source-backed frontend service errors in %s without changing captured data",
  async (language) => {
    await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
    useLanguageStore.getState().setLanguage(language);
    for (const [source, en, zh] of FRONTEND_SERVICE_MESSAGES) {
      expect(localizeMessage(concrete(source)), source).toBe(
        concrete(language === "zh" ? zh : en),
      );
    }
  },
);
