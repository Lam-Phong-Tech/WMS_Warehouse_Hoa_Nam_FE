/**
 * Ngôn ngữ hiển thị của toàn bộ giao diện (VI mặc định, EN tùy chọn).
 *
 * Lưu bằng `persist` để người dùng chọn một lần là giữ nguyên qua các phiên,
 * cùng lối với `auth.store.ts`. Đây là NGUỒN DUY NHẤT quyết định ngôn ngữ —
 * không component nào được tự giữ state ngôn ngữ riêng.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Language = "vi" | "en";

export const LANGUAGES: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "vi",
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "erp-language",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
