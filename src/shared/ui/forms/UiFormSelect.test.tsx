/**
 * Test UiFormSelect — mở/chọn option, aria combobox/listbox, keyboard
 * ArrowDown, placeholder màu textDisabled, multiple, lỗi validation.
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SEMANTIC_LIGHT } from "@/shared/ui/tokens";
import {
  UiFormSelect,
  type UiFormSelectProps,
  type UiSelectOption,
} from "./UiFormSelect";

const OPTIONS: UiSelectOption[] = [
  { value: "a", label: "Kho A" },
  { value: "b", label: "Kho B" },
  { value: "c", label: "Kho C", disabled: true },
];

interface SingleValues {
  kho: string;
}

type SingleProps = Partial<
  Omit<UiFormSelectProps<SingleValues>, "control" | "name" | "options">
> & { errorMessage?: string };

function SingleHost({ errorMessage, ...props }: SingleProps) {
  const { control, watch, setError } = useForm<SingleValues>({
    defaultValues: { kho: "" },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("kho", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("kho");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormSelect
        control={control}
        name="kho"
        label="Kho"
        options={OPTIONS}
        {...props}
      />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

interface MultiValues {
  khos: string[];
}

function MultiHost() {
  const { control, watch } = useForm<MultiValues>({
    defaultValues: { khos: [] },
  });
  const value = watch("khos");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormSelect
        control={control}
        name="khos"
        label="Kho"
        options={OPTIONS}
        multiple
      />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormSelect", () => {
  it("mở bằng click, chọn option → form value đổi + hiển thị label", async () => {
    const user = userEvent.setup();
    render(<SingleHost />);
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Kho B" }));
    expect(screen.getByTestId("form-value")).toHaveTextContent('"b"');
    expect(trigger).toHaveTextContent("Kho B");
  });

  it("aria: combobox + listbox + option (option disabled đúng)", async () => {
    const user = userEvent.setup();
    render(<SingleHost />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    await user.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);
    expect(screen.getByRole("option", { name: "Kho C" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keyboard: focus → ArrowDown mở listbox", async () => {
    const user = userEvent.setup();
    render(<SingleHost />);
    await user.tab();
    expect(screen.getByRole("combobox")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("placeholder khi rỗng: render qua renderValue với màu textDisabled", () => {
    render(<SingleHost placeholder="Chọn kho" />);
    const placeholder = screen.getByText("Chọn kho");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveStyle({ color: SEMANTIC_LIGHT.textDisabled });
  });

  it("label + dấu * khi required; lỗi hiển thị FormHelperText", () => {
    const { container } = render(
      <SingleHost required errorMessage="Chưa chọn kho" />,
    );
    expect(container.querySelector(".MuiFormLabel-asterisk")).not.toBeNull();
    expect(screen.getByText("Chưa chọn kho")).toBeInTheDocument();
  });

  it("disabled đúng", () => {
    render(<SingleHost disabled />);
    expect(screen.getByRole("combobox")).toHaveClass("Mui-disabled");
  });

  it("multiple: chọn 2 option → mảng giá trị + labels nối bằng ', '", async () => {
    const user = userEvent.setup();
    render(<MultiHost />);
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Kho A" }));
    await user.click(screen.getByRole("option", { name: "Kho B" }));
    expect(screen.getByTestId("form-value")).toHaveTextContent('["a","b"]');
    await user.keyboard("{Escape}");
    expect(trigger).toHaveTextContent("Kho A, Kho B");
  });
});
