/**
 * Test UiFormAutocomplete — gõ lọc option, chọn (single + multiple),
 * noOptionsText, lỗi validation.
 */
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import {
  UiFormAutocomplete,
  type UiFormAutocompleteProps,
  type UiAutocompleteOption,
} from "./UiFormAutocomplete";

const OPTIONS: UiAutocompleteOption[] = [
  { value: "a", label: "Kho A" },
  { value: "b", label: "Kho B" },
];

interface SingleValues {
  kho: string | null;
}

type SingleProps = Partial<
  Omit<UiFormAutocompleteProps<SingleValues>, "control" | "name" | "options">
> & { errorMessage?: string };

function SingleHost({ errorMessage, ...props }: SingleProps) {
  const { control, watch, setError } = useForm<SingleValues>({
    defaultValues: { kho: null },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("kho", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("kho");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormAutocomplete
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

type MultiProps = Partial<
  Omit<
    UiFormAutocompleteProps<MultiValues>,
    "control" | "name" | "options" | "multiple"
  >
>;

function MultiHost(props: MultiProps) {
  const { control, watch } = useForm<MultiValues>({
    defaultValues: { khos: [] },
  });
  const value = watch("khos");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormAutocomplete
        control={control}
        name="khos"
        label="Kho"
        options={OPTIONS}
        multiple
        {...props}
      />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormAutocomplete", () => {
  it("gõ lọc option rồi chọn → form value là option.value", async () => {
    const user = userEvent.setup();
    render(<SingleHost />);
    const input = screen.getByLabelText("Kho");
    await user.type(input, "B");
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toBeInTheDocument();
    // Lọc theo label: chỉ còn "Kho B"
    expect(screen.queryByRole("option", { name: "Kho A" })).toBeNull();
    await user.click(screen.getByRole("option", { name: "Kho B" }));
    expect(screen.getByTestId("form-value")).toHaveTextContent('"b"');
    expect(input).toHaveValue("Kho B");
  });

  it("không khớp option nào → noOptionsText 'Không có lựa chọn'", async () => {
    const user = userEvent.setup();
    render(<SingleHost />);
    await user.type(screen.getByLabelText("Kho"), "xyz");
    expect(await screen.findByText("Không có lựa chọn")).toBeInTheDocument();
  });

  it("multiple: chọn 2 option → mảng value", async () => {
    const user = userEvent.setup();
    render(<MultiHost />);
    const input = screen.getByLabelText("Kho");
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Kho A" }));
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Kho B" }));
    expect(screen.getByTestId("form-value")).toHaveTextContent('["a","b"]');
  });

  it("onAddNew (single): hiện dòng '+ Thêm mới', chọn dòng đó gọi callback và KHÔNG set form value", async () => {
    const user = userEvent.setup();
    const onAddNew = vi.fn();
    render(<SingleHost addNewLabel="+ Thêm bệnh lỗi" onAddNew={onAddNew} />);
    const input = screen.getByLabelText("Kho");
    await user.click(input);
    expect(
      await screen.findByRole("option", { name: "+ Thêm bệnh lỗi" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "+ Thêm bệnh lỗi" }));
    expect(onAddNew).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("form-value")).toHaveTextContent("null");
  });

  it("onAddNew (multiple): chọn option thật vẫn thêm vào mảng; chọn dòng '+ Thêm mới' chỉ gọi callback", async () => {
    const user = userEvent.setup();
    const onAddNew = vi.fn();
    render(<MultiHost onAddNew={onAddNew} />);
    const input = screen.getByLabelText("Kho");
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Kho A" }));
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "+ Thêm mới" }));
    expect(onAddNew).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("form-value")).toHaveTextContent('["a"]');
  });

  it("không truyền onAddNew: không có dòng '+ Thêm mới' trong danh sách", async () => {
    const user = userEvent.setup();
    render(<SingleHost />);
    await user.click(screen.getByLabelText("Kho"));
    expect(
      screen.queryByRole("option", { name: /Thêm mới/ }),
    ).not.toBeInTheDocument();
  });

  it("label + dấu * khi required; lỗi hiển thị; disabled đúng", () => {
    const { container, rerender } = render(
      <SingleHost required errorMessage="Chưa chọn kho" />,
    );
    expect(container.querySelector(".MuiFormLabel-asterisk")).not.toBeNull();
    expect(screen.getByText("Chưa chọn kho")).toBeInTheDocument();
    rerender(<SingleHost disabled />);
    expect(screen.getByLabelText("Kho")).toBeDisabled();
  });
});
