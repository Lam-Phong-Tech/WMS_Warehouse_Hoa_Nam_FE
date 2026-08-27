/**
 * Test UiFormRadioGroup — role radiogroup + FormLabel gắn nhóm, chọn bằng
 * click, arrow key di chuyển (hành vi radio group chuẩn), lỗi validation.
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import {
  UiFormRadioGroup,
  type UiFormRadioGroupProps,
  type UiRadioOption,
} from "./UiFormRadioGroup";

const OPTIONS: UiRadioOption[] = [
  { value: "nam", label: "Nam" },
  { value: "nu", label: "Nữ" },
  { value: "khac", label: "Khác" },
];

interface HostValues {
  gioiTinh: string;
}

type HostProps = Partial<
  Omit<UiFormRadioGroupProps<HostValues>, "control" | "name" | "options">
> & { errorMessage?: string };

function Host({ errorMessage, ...props }: HostProps) {
  const { control, watch, setError } = useForm<HostValues>({
    defaultValues: { gioiTinh: "" },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("gioiTinh", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("gioiTinh");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormRadioGroup
        control={control}
        name="gioiTinh"
        label="Giới tính"
        options={OPTIONS}
        {...props}
      />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormRadioGroup", () => {
  it("role radiogroup + FormLabel gắn nhóm qua aria-labelledby", () => {
    render(<Host />);
    const group = screen.getByRole("radiogroup", { name: "Giới tính" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("chọn bằng click → form value đổi", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole("radio", { name: "Nữ" }));
    expect(screen.getByTestId("form-value")).toHaveTextContent('"nu"');
  });

  it("arrow key di chuyển lựa chọn (hành vi radio group mặc định)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole("radio", { name: "Nam" }));
    expect(screen.getByTestId("form-value")).toHaveTextContent('"nam"');
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("form-value")).toHaveTextContent('"nu"');
    expect(screen.getByRole("radio", { name: "Nữ" })).toHaveFocus();
  });

  it("row + dấu * khi required; lỗi hiển thị FormHelperText", () => {
    const { container } = render(
      <Host row required errorMessage="Chưa chọn giới tính" />,
    );
    expect(container.querySelector(".MuiFormLabel-asterisk")).not.toBeNull();
    expect(screen.getByText("Chưa chọn giới tính")).toBeInTheDocument();
  });

  it("disabled đúng (toàn nhóm)", () => {
    render(<Host disabled />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
