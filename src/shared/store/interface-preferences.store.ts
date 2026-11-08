import { create } from "zustand";

/** Subscribe timestamp-only views as account settings arrive after the data. */
export function useDateTimePreferences() {
  useInterfacePreferencesStore((state) => state.preferences?.timezone);
  useInterfacePreferencesStore((state) => state.preferences?.date_format);
}

export type InterfaceAccent = "ocean" | "teal" | "indigo" | "graphite";
export type InterfaceFontSize = "small" | "medium" | "large";
export interface InterfacePreferences {
  version?: number;
  locale: "vi" | "en" | "zh";
  timezone: string;
  date_format: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  default_homepage: string;
  theme: "light" | "dark" | "system";
  accent: InterfaceAccent;
  font_size: InterfaceFontSize;
  density: "comfortable" | "compact";
  reduced_motion: boolean;
}
interface InterfacePreferenceState {
  ownerUserId: string | null;
  preferences: InterfacePreferences | null;
  apply: (ownerUserId: string, preferences: InterfacePreferences) => void;
  clear: () => void;
}
/** Server-owned preferences remain account-scoped in memory; no private profile data is persisted. */
export const useInterfacePreferencesStore = create<InterfacePreferenceState>(
  (set) => ({
    ownerUserId: null,
    preferences: null,
    apply: (ownerUserId, preferences) => set({ ownerUserId, preferences }),
    clear: () => set({ ownerUserId: null, preferences: null }),
  }),
);
