import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { IoHistoryFeedback } from "./IoHistoryFeedback";

describe("Report feedback localization", () => {
  beforeEach(async () => {
    await ensureEnglishMessages();
    useLanguageStore.getState().setLanguage("en");
  });
  afterEach(() => {
    cleanup();
    useLanguageStore.getState().setLanguage("vi");
  });

  it("reads feedback copy at render time rather than retaining the import-time language", () => {
    const view = render(<IoHistoryFeedback state="offline" />);
    expect(screen.getByText("No network connection")).toBeInTheDocument();
    expect(screen.getByText("Check your Internet connection and try again.")).toBeInTheDocument();
    view.rerender(<IoHistoryFeedback state="maintenance" />);
    expect(screen.getByText("System maintenance")).toBeInTheDocument();
    useLanguageStore.getState().setLanguage("vi");
    view.rerender(<IoHistoryFeedback state="maintenance" />);
    expect(screen.getByText("Hệ thống đang bảo trì")).toBeInTheDocument();
  });
});
