import { englishMessages } from "./english-messages";
import { useLanguageStore } from "./language.store";

/** Defer UI constants until render while preserving reference stability. */
export function localizedValue<T>(read: () => T): () => T {
  let cached:
    | {
        language: string;
        dictionary: ReturnType<typeof englishMessages>;
        value: T;
      }
    | undefined;
  return () => {
    const language = useLanguageStore.getState().language;
    const dictionary = language === "en" ? englishMessages() : null;
    if (!cached || cached.language !== language || cached.dictionary !== dictionary) {
      cached = { language, dictionary, value: read() };
    }
    return cached.value;
  };
}
