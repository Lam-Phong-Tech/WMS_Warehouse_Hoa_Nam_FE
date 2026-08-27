/**
 * Test UiFormCheckbox — click/Space toggle boolean, lỗi validation, disabled.
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiFormCheckbox, type UiFormCheckboxProps } from "./UiFormCheckbox";

interface HostValues {
  dongY: boolean;
}

type HostProps = Partial<
  Omit<UiFormCheckboxProps<HostValues>, "control" | "name">
> & {
  defaultValue?: boolean;
  errorMessage?: string;
};

function Host({ defaultValue = false, errorMessage, ...props }: HostProps) {
  const { control, watch, setError } = useForm<HostValues>({
    defaultValues: { dongY: defaultValue },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("dongY", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("dongY");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormCheckbox
        control={control}
        name="dongY"
        label="Đồng ý điều khoản"
        {...props}
      />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormCheckbox", () => {
  it("render label; click toggle true/false", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const checkbox = screen.getByRole("checkbox", {
      name: /Đồng ý điều khoản/,
    });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^true$/);
    await user.click(checkbox);
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^false$/);
  });

  it("phím Space toggle", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.tab();
    expect(
      screen.getByRole("checkbox", { name: /Đồng ý điều khoản/ }),
    ).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^true$/);
  });

  it("lỗi validation hiển thị FormHelperText", () => {
    render(<Host errorMessage="Phải đồng ý điều khoản" />);
    expect(screen.getByText("Phải đồng ý điều khoản")).toBeInTheDocument();
  });

  it("disabled đúng", () => {
    render(<Host disabled />);
    expect(
      screen.getByRole("checkbox", { name: /Đồng ý điều khoản/ }),
    ).toBeDisabled();
  });
});
