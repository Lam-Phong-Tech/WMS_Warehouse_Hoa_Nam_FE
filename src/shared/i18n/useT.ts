/**
 * `t()` — đọc chuỗi giao diện theo ngôn ngữ đang chọn.
 *
 *   const t = useT();
 *   t("dashboard.title");
 *   t("dashboard.periodCaption", { from: "01/09", to: "30/09" });
 *
 * Nguyên tắc fail-safe: khoá nào chưa có bản EN thì rơi về tiếng Việt. Không
 * bao giờ trả về chính tên khoá — người dùng không được nhìn thấy `a.b.c`.
 */
import { useCallback } from "react";
import {
  MESSAGES_EN,
  MESSAGES_VI,
  type MessageKey,
  type MessageTree,
} from "./messages";
import { useLanguageStore, type Language } from "./language.store";

export type MessageVars = Record<string, string | number>;

const TRANSLATIONS: Record<Language, MessageTree | undefined> = {
  vi: undefined, // VI đọc thẳng từ MESSAGES_VI
  en: MESSAGES_EN,
};

function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function translate(
  language: Language,
  key: MessageKey,
  vars?: MessageVars,
): string {
  const translated =
    language === "vi" ? undefined : lookup(TRANSLATIONS[language], key);
  // Thiếu bản dịch → tiếng Việt. `MESSAGES_VI` luôn đủ khoá nên nhánh `?? key`
  // chỉ chạy khi ai đó ép kiểu sai; giữ lại để không bao giờ trả về undefined.
  return interpolate(translated ?? lookup(MESSAGES_VI, key) ?? key, vars);
}

export type TranslateFn = (key: MessageKey, vars?: MessageVars) => string;

/**
 * Bản dịch cho nơi KHÔNG gọi được hook (service, hàm cấp module). Đọc thẳng
 * ngôn ngữ hiện tại từ store thay vì subscribe — chấp nhận được vì các chỗ này
 * chỉ chạy một lần lúc dựng câu lỗi, không cần render lại khi đổi ngôn ngữ.
 */
export function tStatic(key: MessageKey, vars?: MessageVars): string {
  return translate(useLanguageStore.getState().language, key, vars);
}

export function useT(): TranslateFn {
  const language = useLanguageStore((state) => state.language);
  return useCallback(
    (key: MessageKey, vars?: MessageVars) => translate(language, key, vars),
    [language],
  );
}
