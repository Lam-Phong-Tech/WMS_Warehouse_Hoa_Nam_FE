import { useEffect, type ReactNode } from "react";
import { useLanguageStore } from "./language.store";
import {
  ensureEnglishMessages,
  useEnglishMessages,
  useEnglishMessagesStatus,
} from "./english-messages";
import "./english-language-boundary.css";

/** Mount English screens only after their lazily loaded dictionary is ready. */
export function EnglishLanguageBoundary({ children }: { children: ReactNode }) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const messages = useEnglishMessages();
  const status = useEnglishMessagesStatus();

  useEffect(() => {
    if (language === "en" && !messages && status === "idle") {
      void ensureEnglishMessages();
    }
  }, [language, messages, status]);

  if (language !== "en" || messages) return children;

  // Bootstrap copy cannot depend on the dictionary that failed to download.
  return (
    <main className="hn-language-boundary" lang="en">
      <section aria-labelledby="hn-language-title">
        {status === "error" ? (
          <>
            <div role="alert">
              <h1 id="hn-language-title">Unable to load English</h1>
              <p>Check your connection and try again.</p>
            </div>
            <div className="hn-language-actions">
              <button type="button" onClick={() => void ensureEnglishMessages()}>
                Retry
              </button>
              <button
                type="button"
                className="hn-language-secondary"
                lang="vi"
                onClick={() => setLanguage("vi")}
              >
                Tiếng Việt
              </button>
            </div>
          </>
        ) : (
          <div role="status" aria-live="polite" aria-busy="true">
            <h1 id="hn-language-title">Loading English…</h1>
            <p>Please wait while the interface language is prepared.</p>
          </div>
        )}
      </section>
    </main>
  );
}
