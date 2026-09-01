/**
 * NGÔN NGỮ GIAO DIỆN — nguồn duy nhất cho toàn app.
 *
 * Tiếng Việt là mặc định và luôn là bản ĐẦY ĐỦ: mọi khoá đều có bản vi, còn en
 * là bản phủ dần. Thiếu khoá en thì `t()` rơi về vi chứ KHÔNG hiện khoá thô —
 * người dùng không bao giờ thấy chuỗi kiểu `topbar.searchTitle` trên màn hình.
 *
 * Lưu bằng `persist` (cùng lối `auth.store.ts`) để chọn một lần là giữ qua các
 * phiên. Không component nào được tự giữ state ngôn ngữ riêng.
 *
 * `<html lang>` đồng bộ theo lựa chọn: đặt lúc bootstrap qua `initializeLanguage()`
 * và mỗi lần `setLanguage`, để screen-reader cùng các quy tắc CSS `:lang()` đọc
 * đúng ngay từ lần render đầu.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Language = "vi" | "en";

/** Tên dùng ở thanh topbar — alias để không phải sửa call site. */
export type AppLanguage = Language;

export const LANGUAGES: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

function applyDocumentLanguage(language: Language) {
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
        set({ language });
      },
    }),
    {
      name: "erp-language",
      storage: createJSONStorage(() => localStorage),
      // persist khôi phục state SAU khi store dựng xong, nên `<html lang>` phải
      // đặt lại ở đây — `initializeLanguage()` ở main.tsx chỉ lo trường hợp
      // rehydrate hoàn tất trước lần render đầu.
      onRehydrateStorage: () => (state) => {
        if (state) applyDocumentLanguage(state.language);
      },
    },
  ),
);

/** Gọi một lần lúc bootstrap để `<html lang>` khớp lựa chọn đã lưu. */
export function initializeLanguage() {
  applyDocumentLanguage(useLanguageStore.getState().language);
}
