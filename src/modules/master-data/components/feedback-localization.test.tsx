import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { localizeMessage } from "@/shared/i18n/localize-message";
import { DefectMutationNotice } from "./DefectMutationNotice";
import { SkuListMutationNotice } from "./SkuListMutationNotice";

afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});
it.each(["sku", "defect"] as const)(
  "updates %s mutation prose on EN to ZH switches without remounting",
  async (kind) => {
    const message = "Không tìm thấy MODEL ACTIVE với code 4344SFDFS.";
    await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
    useLanguageStore.getState().setLanguage("en");
    render(
      kind === "sku" ? (
        <SkuListMutationNotice
          notice={{ kind: "failed", code: "4344SFDFS", message }}
          onDismiss={vi.fn()}
          onCheck={vi.fn()}
          onRetry={vi.fn()}
        />
      ) : (
        <DefectMutationNotice
          notice={{ kind: "failed", code: "4344SFDFS", message }}
          onRetry={vi.fn()}
        />
      ),
    );
    const englishText = screen.getByRole("alert").textContent;
    expect(screen.getByRole("alert")).toHaveTextContent(
      localizeMessage(message),
    );
    await act(async () => useLanguageStore.getState().setLanguage("zh"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      localizeMessage(message),
    );
    expect(screen.getByRole("alert").textContent).not.toBe(englishText);
  },
);
