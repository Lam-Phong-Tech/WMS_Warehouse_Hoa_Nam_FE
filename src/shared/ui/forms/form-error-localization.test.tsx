import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { localizeMessage } from "@/shared/i18n/localize-message";
import { UiFormText } from "./UiFormText";
import { UiFormNumber } from "./UiFormNumber";
import { UiFormAutocomplete } from "./UiFormAutocomplete";
import { UiTextField, UiFormField } from "../components/UiTextField";

const message = "Không tìm thấy MODEL ACTIVE với code 4344SFDFS.";
function Host({
  kind,
}: {
  kind: "text" | "number" | "autocomplete" | "field" | "shell";
}) {
  const { control, setError } = useForm({
    defaultValues: { value: "4344SFDFS", quantity: 1 },
  });
  useEffect(() => {
    setError(kind === "number" ? "quantity" : "value", {
      type: "server",
      message,
    });
  }, [kind, setError]);
  if (kind === "field")
    return (
      <UiTextField
        label="Model"
        error
        helperText={message}
        defaultValue="4344SFDFS"
      />
    );
  if (kind === "shell")
    return (
      <UiFormField label="Model" error helperText={message}>
        <input
          aria-label="Model"
          aria-invalid="true"
          defaultValue="4344SFDFS"
        />
      </UiFormField>
    );
  if (kind === "number")
    return <UiFormNumber control={control} name="quantity" label="Quantity" />;
  if (kind === "autocomplete")
    return (
      <UiFormAutocomplete
        control={control}
        name="value"
        label="Model"
        options={[]}
      />
    );
  return <UiFormText control={control} name="value" label="Model" />;
}
afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});
it.each(["text", "number", "autocomplete", "field", "shell"] as const)(
  "localizes cached %s server validation errors when switching EN and ZH",
  async (kind) => {
    render(<Host kind={kind} />);
    for (const language of ["en", "zh"] as const) {
      await act(async () => {
        await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
        useLanguageStore.getState().setLanguage(language);
      });
      expect(screen.getByText(localizeMessage(message))).toBeVisible();
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(
        screen.getByRole(kind === "autocomplete" ? "combobox" : "textbox"),
      ).toHaveAttribute("aria-invalid", "true");
    }
  },
);
it("preserves helper text supplied as user data when the field is not in error", async () => {
  render(
    <UiTextField label="Model" helperText={message} defaultValue={message} />,
  );
  await act(async () => {
    await ensureChineseMessages();
    useLanguageStore.getState().setLanguage("zh");
  });
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.getByRole("textbox")).toHaveValue(message);
});
