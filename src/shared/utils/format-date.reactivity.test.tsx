import { useMemo } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  useInterfacePreferencesStore,
  type InterfacePreferences,
} from "@/shared/store/interface-preferences.store";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "./format-date";

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

function UpdatedAt() {
  const t = useT();
  const text = useMemo(
    () =>
      t("dashboard.lastUpdated.at", {
        time: formatDateTime("2026-11-05T09:51:00Z"),
      }),
    [t],
  );
  return <output>{text}</output>;
}

it("refreshes memoized date labels when account preferences arrive or change", () => {
  render(<UpdatedAt />);
  expect(screen.getByRole("status")).toHaveTextContent("05-11-2026 16:51");
  act(() =>
    useInterfacePreferencesStore
      .getState()
      .apply("u1", { ...settings, timezone: "America/New_York" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("05/11/2026 04:51");
});
