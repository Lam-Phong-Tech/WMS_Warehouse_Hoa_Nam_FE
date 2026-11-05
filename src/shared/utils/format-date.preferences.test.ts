import { afterEach, describe, expect, it } from "vitest";
import {
  useInterfacePreferencesStore,
  type InterfacePreferences,
} from "@/shared/store/interface-preferences.store";
import { formatDate, formatDateTime, dateFilterBoundary } from "./format-date";
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
  it("sends account-local date filters with an explicit offset, including DST boundaries", () => {
    useInterfacePreferencesStore.getState().apply("u1", settings);
    expect(dateFilterBoundary("2026-11-05", false)).toBe(
      "2026-11-05T00:00:00+07:00",
    );
    expect(dateFilterBoundary("2026-11-05", true)).toBe(
      "2026-11-05T23:59:59.999999+07:00",
    );
    useInterfacePreferencesStore
      .getState()
      .apply("u1", { ...settings, timezone: "America/New_York" });
    expect(dateFilterBoundary("2026-11-01", false)).toBe(
      "2026-11-01T00:00:00-04:00",
    );
    expect(dateFilterBoundary("2026-11-01", true)).toBe(
      "2026-11-01T23:59:59.999999-05:00",
    );
  });
  it("interprets legacy offset-free timestamps as Vietnam time, independent of the device zone", () => {
    useInterfacePreferencesStore.getState().apply("u1", {
      ...settings,
      timezone: "America/New_York",
    });
    expect(formatDateTime("2026-11-05 16:51:00")).toBe("05/11/2026 04:51");
  });
  it("uses Vietnam as the default and invalid-zone fallback while preferences load", () => {
    expect(formatDateTime("2026-11-05T09:51:00Z")).toBe("05-11-2026 16:51");
    useInterfacePreferencesStore
      .getState()
      .apply("u1", { ...settings, timezone: "invalid/zone" });
    expect(formatDateTime("2026-11-05T09:51:00Z")).toBe("05/11/2026 16:51");
  });
  it("converts timestamp dates across midnight but leaves business dates unchanged", () => {
    useInterfacePreferencesStore.getState().apply("u1", settings);
    expect(formatDate("2026-11-05T20:00:00Z")).toBe("06/11/2026");
    expect(formatDate("2026-11-05")).toBe("05/11/2026");
  });
  it("uses saved timezone and date format across the UTC day boundary", () => {
    useInterfacePreferencesStore.getState().apply("u1", settings);
    expect(formatDateTime("2026-11-03T20:05:00Z")).toBe("04/11/2026 03:05");
  });
  it("keeps date-only business values independent of the chosen timezone", () => {
    useInterfacePreferencesStore.getState().apply("u1", {
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
