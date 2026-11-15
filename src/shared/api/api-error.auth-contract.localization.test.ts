import { afterEach, expect, it } from "vitest";
import { getApiErrorMessage, normalizeError } from "./api-error";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { tStatic } from "@/shared/i18n/useT";

afterEach(() => useLanguageStore.getState().setLanguage("vi"));
it.each(["en", "zh"] as const)(
  "keeps internal authentication diagnostics out of %s user messages while preserving the original error",
  async (language) => {
    await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
    useLanguageStore.getState().setLanguage(language);
    const diagnostic =
      "AUTH_CONTRACT_INVALID(enrollment.secret): expected non-empty string";
    const error = Object.assign(new Error(diagnostic), {
      name: "AuthContractError",
      field: "enrollment.secret",
    });
    const normalized = normalizeError(error);
    expect(getApiErrorMessage(error)).toBe(
      tStatic("shared.apiError.invalidAuthResponse"),
    );
    expect(normalized.message).toBe(
      tStatic("shared.apiError.invalidAuthResponse"),
    );
    expect(normalized.message).not.toContain("AUTH_CONTRACT_INVALID");
    expect(normalized.message).not.toContain("enrollment.secret");
    expect(normalized.raw).toBe(error);
    expect(error.message).toBe(diagnostic);
    expect(error.field).toBe("enrollment.secret");
  },
);

it("preserves unrelated business detail", () => {
  const error = new Error("Customer note 4344SFDFS");
  expect(getApiErrorMessage(error)).toBe(error.message);
});
