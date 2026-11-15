import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { PvErrorState } from "./PvErrorState";

beforeAll(async () => {
  await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
});

afterEach(() => {
  cleanup();
  act(() => useLanguageStore.getState().setLanguage("vi"));
});

describe("public PV server errors", () => {
  it("translates a retained server error when the language changes", () => {
    const error = Object.assign(
      new Error("Mật khẩu hiện tại không chính xác"),
      {
        requestId: "trace-HÒA-42",
      },
    );
    useLanguageStore.getState().setLanguage("en");
    render(<PvErrorState error={error} />);
    expect(screen.getByTestId("pv-error-generic")).toHaveTextContent(
      "The current password is incorrect.",
    );
    act(() => useLanguageStore.getState().setLanguage("zh"));
    expect(screen.getByTestId("pv-error-generic")).toHaveTextContent(
      "当前密码不正确。",
    );
    expect(screen.getByTestId("pv-error-generic")).toHaveTextContent(
      "trace-HÒA-42",
    );
    expect(error.message).toBe("Mật khẩu hiện tại không chính xác");
  });

  it.each(["en", "zh"] as const)(
    "preserves unknown user data in %s",
    (language) => {
      useLanguageStore.getState().setLanguage(language);
      const message = "Lô Hòa Nam 42 / Nguyễn Văn An: SKU-HÒA-12";
      render(<PvErrorState error={new Error(message)} />);
      expect(screen.getByTestId("pv-error-generic")).toHaveTextContent(message);
    },
  );
});
