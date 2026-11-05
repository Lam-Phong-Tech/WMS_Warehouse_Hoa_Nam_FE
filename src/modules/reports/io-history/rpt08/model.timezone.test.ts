import { afterEach, expect, it } from "vitest";
import { useInterfacePreferencesStore } from "@/shared/store/interface-preferences.store";
import { displayStamp, displayAsOf } from "./model";

afterEach(() => useInterfacePreferencesStore.getState().clear());

it("formats history and export snapshot timestamps in the account timezone", () => {
  useInterfacePreferencesStore.getState().apply("user", {
    locale: "vi",
    timezone: "America/New_York",
    date_format: "DD/MM/YYYY",
    default_homepage: "dashboard",
    theme: "light",
    accent: "ocean",
    font_size: "medium",
    density: "comfortable",
    reduced_motion: false,
  });
  expect(displayStamp("2026-11-05T09:51:00Z")).toBe("05/11/2026 · 04:51");
  expect(displayAsOf("2026-11-05T09:51:00Z")).toBe("05/11/2026 · 04:51");
});
