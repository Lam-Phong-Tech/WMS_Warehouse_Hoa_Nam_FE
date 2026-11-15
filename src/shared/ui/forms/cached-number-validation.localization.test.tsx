import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { checkNumber } from "@/shared/validation/number-rules";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { localizeMessage } from "@/shared/i18n/localize-message";
import { tStatic } from "@/shared/i18n/useT";
import { UiFormNumber } from "./UiFormNumber";

beforeAll(async () => {
  await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
});
afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});

function CachedValidationForm() {
  const { control, setError } = useForm({ defaultValues: { quantity: 0 } });
  useEffect(() => {
    const result = checkNumber(0, { min: 1_000, required: true });
    if (!result.ok)
      setError("quantity", { type: "validate", message: result.message });
  }, [setError]);
  return <UiFormNumber control={control} name="quantity" label="Quantity" />;
}

it("updates a cached checkNumber validation from English to Chinese and back without revalidating", async () => {
  useLanguageStore.getState().setLanguage("en");
  render(<CachedValidationForm />);
  const english = tStatic("shared.validation.numberMin", { min: "1.000" });
  expect(await screen.findByText(english)).toBeVisible();
  act(() => useLanguageStore.getState().setLanguage("zh"));
  expect(
    screen.getByText(tStatic("shared.validation.numberMin", { min: "1.000" })),
  ).toBeVisible();
  expect(screen.queryByText(english)).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("0");
  act(() => useLanguageStore.getState().setLanguage("en"));
  expect(screen.getByText(english)).toBeVisible();
});

it("leaves generic and unknown English prose with customer names intact", () => {
  useLanguageStore.getState().setLanguage("zh");
  for (const message of [
    "Nguyễn Văn An is required.",
    "The value must not be less than Nguyễn Văn An / SKU-HÒA-42",
    "Nguyễn Văn An / SKU-HÒA-42",
  ])
    expect(localizeMessage(message)).toBe(message);
});
