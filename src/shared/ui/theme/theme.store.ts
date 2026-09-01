/**
 * CHẾ ĐỘ HIỂN THỊ (sáng / tối / theo hệ thống) — nguồn duy nhất cho toàn app.
 *
 * `preference` là thứ người dùng CHỌN, `mode` là thứ thực sự đang vẽ (đã giải
 * quyết `system` bằng prefers-color-scheme). Adapter MUI/antd và CSS đều đọc
 * `mode`; DOM mang cả hai để CSS/QA phân biệt được "đang tối vì hệ thống" với
 * "người dùng chọn tối".
 *
 * Khoá localStorage `hoa-nam-theme` giữ đúng tên demo UI/UX đã dùng.
 */
import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "hoa-nam-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "dark" || raw === "system" ? raw : "light";
  } catch {
    return "light";
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DARK_QUERY).matches
  );
}

export function resolveMode(preference: ThemePreference): ThemeMode {
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return preference;
}

function applyDocumentTheme(preference: ThemePreference, mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.themePreference = preference;
  // Cho form control/scrollbar gốc của trình duyệt đổi theo.
  root.style.colorScheme = mode;
}

interface ThemeState {
  preference: ThemePreference;
  mode: ThemeMode;
  setPreference: (preference: ThemePreference) => void;
  /** Dùng bởi listener hệ thống — đổi mode mà KHÔNG ghi đè lựa chọn đã lưu. */
  syncSystemMode: () => void;
}

const initialPreference = readStoredPreference();

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  mode: resolveMode(initialPreference),
  setPreference: (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Không ghi được thì vẫn đổi trong phiên.
    }
    const mode = resolveMode(preference);
    applyDocumentTheme(preference, mode);
    set({ preference, mode });
  },
  syncSystemMode: () => {
    const { preference } = get();
    if (preference !== "system") return;
    const mode = resolveMode(preference);
    applyDocumentTheme(preference, mode);
    set({ mode });
  },
}));

/**
 * Gọi một lần lúc bootstrap: đặt data-theme theo lựa chọn đã lưu và theo dõi
 * thay đổi của hệ điều hành khi người dùng chọn "Theo hệ thống".
 */
export function initializeTheme(): () => void {
  const { preference, mode } = useThemeStore.getState();
  applyDocumentTheme(preference, mode);
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const onChange = () => useThemeStore.getState().syncSystemMode();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
