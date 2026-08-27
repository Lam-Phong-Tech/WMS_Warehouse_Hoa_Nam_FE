/**
 * Test UiFormSwitch — click/Space toggle boolean, lỗi validation, disabled.
 * (MUI Switch gắn role="switch" lên input → query bằng role switch.)
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiFormSwitch, type UiFormSwitchProps } from "./UiFormSwitch";

interface HostValues {
  kichHoat: boolean;
}

type HostProps = Partial<
  Omit<UiFormSwitchProps<HostValues>, "control" | "name">
> & {
  defaultValue?: boolean;
  errorMessage?: string;
};

function Host({ defaultValue = false, errorMessage, ...props }: HostProps) {
  const { control, watch, setError } = useForm<HostValues>({
    defaultValues: { kichHoat: defaultValue },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("kichHoat", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("kichHoat");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormSwitch
        control={control}
        name="kichHoat"
        label="Kích hoạt"
        {...props}
      />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormSwitch", () => {
  it("render label; click toggle true/false", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const toggle = screen.getByRole("switch", { name: /Kích hoạt/ });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^true$/);
    await user.click(toggle);
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^false$/);
  });

  it("phím Space toggle", async () => {
    const user = userEvent.setup();
    render(<Host defaultValue />);
    await user.tab();
    expect(screen.getByRole("switch", { name: /Kích hoạt/ })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^false$/);
  });

  it("lỗi validation hiển thị FormHelperText", () => {
    render(<Host errorMessage="Không thể kích hoạt" />);
    expect(screen.getByText("Không thể kích hoạt")).toBeInTheDocument();
  });

  it("disabled đúng", () => {
    render(<Host disabled />);
    expect(screen.getByRole("switch", { name: /Kích hoạt/ })).toBeDisabled();
  });
});
