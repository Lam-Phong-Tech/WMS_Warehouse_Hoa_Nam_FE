import { useEffect, type ReactNode } from "react";
import { useLanguageStore } from "./language.store";
import {
  ensureEnglishMessages,
  useEnglishMessages,
  useEnglishMessagesStatus,
} from "./english-messages";
import {
  ensureChineseMessages,
  useChineseMessages,
  useChineseMessagesStatus,
} from "./chinese-messages";
import "./english-language-boundary.css";

/** Mount translated screens only after their lazily loaded dictionary is ready. */
export function LanguageBoundary({ children }: { children: ReactNode }) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const messages = useEnglishMessages();
  const status = useEnglishMessagesStatus();
  const chineseMessages = useChineseMessages();
  const chineseStatus = useChineseMessagesStatus();

  useEffect(() => {
    if (language === "en" && !messages && status === "idle") {
      void ensureEnglishMessages();
    }
    if (language === "zh" && !chineseMessages && chineseStatus === "idle") {
      void ensureChineseMessages();
    }
  }, [language, messages, status, chineseMessages, chineseStatus]);

  if (
    language === "vi" ||
    (language === "en" && messages) ||
    (language === "zh" && chineseMessages)
  )
    return children;

  const chinese = language === "zh";
  const activeStatus = chinese ? chineseStatus : status;
  const retry = chinese ? ensureChineseMessages : ensureEnglishMessages;

  // Bootstrap copy cannot depend on the dictionary that failed to download.
  return (
    <main className="hn-language-boundary" lang={chinese ? "zh-CN" : "en"}>
      <section aria-labelledby="hn-language-title">
        {activeStatus === "error" ? (
          <>
            <div role="alert">
              <h1 id="hn-language-title">
                {chinese ? "无法加载简体中文" : "Unable to load English"}
              </h1>
              <p>
                {chinese
                  ? "请检查网络连接后重试。"
                  : "Check your connection and try again."}
              </p>
            </div>
            <div className="hn-language-actions">
              <button type="button" onClick={() => void retry()}>
                {chinese ? "重试" : "Retry"}
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
            <h1 id="hn-language-title">
              {chinese ? "正在加载简体中文…" : "Loading English…"}
            </h1>
            <p>
              {chinese
                ? "请稍候，正在准备界面语言。"
                : "Please wait while the interface language is prepared."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

/** Kept for existing imports and tests. */
export const EnglishLanguageBoundary = LanguageBoundary;
