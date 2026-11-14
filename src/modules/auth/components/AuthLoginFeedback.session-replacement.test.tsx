import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useLanguageStore, type Language } from "@/shared/i18n/language.store";
import { AuthSessionReplacementNotice } from "./AuthLoginFeedback";

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: "vi" });
});

it.each<[Language, string, string]>([
  ["vi", "Chrome trên Windows", "Chrome trên Windows"],
  ["en", "Chrome trên Windows", "Chrome on Windows"],
  ["zh", "Chrome trên Windows", "Windows 上的 Chrome"],
  ["en", "Firefox trên Android", "Firefox on Android"],
  ["en", "Edge trên macOS", "Edge on macOS"],
  ["en", "Safari trên iPhone", "Safari on iPhone"],
  ["en", "Safari trên iPad", "Safari on iPad"],
  ["en", "Chrome trên Linux", "Chrome on Linux"],
  ["en", "Chrome trên Thiết bị khác", "Chrome on Other device"],
  ["en", "Thiết bị khác", "Other device"],
  ["zh", "Thiết bị khác", "其他设备"],
  ["en", "Windows", "Windows"],
  ["en", "Máy của Lan trên tầng 2", "Máy của Lan trên tầng 2"],
])(
  "renders the %s replacement device label %s as %s",
  (language, label, expected) => {
    useLanguageStore.setState({ language });
    render(
      <AuthSessionReplacementNotice
        notice={{ device_label: label, ip_hint: "113.185.44.xxx" }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      `${expected} (IP 113.185.44.xxx)`,
    );
  },
);

it("updates a replacement notice on language changes without changing the server label", () => {
  useLanguageStore.setState({ language: "vi" });
  const notice = Object.freeze({ device_label: "Chrome trên Windows" });
  render(<AuthSessionReplacementNotice notice={notice} onDismiss={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Chrome trên Windows");

  act(() => useLanguageStore.setState({ language: "en" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "New sign-in device: Chrome on Windows",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("trên");
  act(() => useLanguageStore.setState({ language: "zh" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Windows 上的 Chrome");
  act(() => useLanguageStore.setState({ language: "vi" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Chrome trên Windows");
  expect(notice.device_label).toBe("Chrome trên Windows");
});
