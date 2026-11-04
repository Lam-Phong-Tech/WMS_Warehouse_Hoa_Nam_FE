import { afterEach, describe, expect, it } from "vitest";
import {
  useInterfacePreferencesStore,
  type InterfacePreferences,
} from "@/shared/store/interface-preferences.store";
import { formatDate, formatDateTime } from "./format-date";
const settings: InterfacePreferences = {
  locale: "vi",
  timezone: "Asia/Ho_Chi_Minh",
  date_format: "DD/MM/YYYY",
  default_homepage: "dashboard",
  theme: "light",
  accent: "ocean",
  font_size: "medium",
  density: "comfortable",
  reduced_motion: false,
};
afterEach(() => useInterfacePreferencesStore.getState().clear());
describe("account date formatting", () => {
  it("uses saved timezone and date format across the UTC day boundary", () => {
    useInterfacePreferencesStore.getState().apply("u1", settings);
    expect(formatDateTime("2026-11-03T20:05:00Z")).toBe("04/11/2026 03:05");
  });
  it("keeps date-only business values independent of the chosen timezone", () => {
    useInterfacePreferencesStore
      .getState()
      .apply("u1", {
        ...settings,
        timezone: "America/New_York",
        date_format: "MM/DD/YYYY",
      });
    expect(formatDate("2026-11-04")).toBe("11/04/2026");
    expect(formatDateTime("2026-11-04T02:00:00Z")).toBe("11/03/2026 21:00");
  });
  it("clears the previous account preference instead of applying it to the next account", () => {
    useInterfacePreferencesStore
      .getState()
      .apply("u1", { ...settings, date_format: "YYYY-MM-DD" });
    expect(formatDate("2026-11-04")).toBe("2026-11-04");
    useInterfacePreferencesStore.getState().clear();
    expect(formatDate("2026-11-04")).toBe("04-11-2026");
  });
});
