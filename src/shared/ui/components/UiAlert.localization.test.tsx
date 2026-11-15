import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { localizeMessage } from "@/shared/i18n/localize-message";
import { UiAlert } from "./UiAlert";

const message = "Không tìm thấy MODEL ACTIVE với code 4344SFDFS.";
afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});
it("updates stored error prose and titles when switching English and Chinese", async () => {
  render(
    <UiAlert tone="error" title={message}>
      {message}
    </UiAlert>,
  );
  for (const language of ["en", "zh"] as const) {
    await act(async () => {
      await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
      useLanguageStore.getState().setLanguage(language);
    });
    expect(screen.getAllByText(localizeMessage(message))).toHaveLength(2);
    expect(screen.getByRole("alert")).not.toHaveTextContent(message);
  }
});
it("preserves structured user content and unknown error details", async () => {
  render(
    <>
      <UiAlert tone="error">
        <span>{message}</span>
      </UiAlert>
      <UiAlert tone="error">Customer note 4344SFDFS</UiAlert>
    </>,
  );
  await act(async () => {
    await ensureChineseMessages();
    useLanguageStore.getState().setLanguage("zh");
  });
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.getByText("Customer note 4344SFDFS")).toBeVisible();
});
