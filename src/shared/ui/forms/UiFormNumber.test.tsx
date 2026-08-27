/**
 * Test UiFormNumber — parse number|null, giữ chuỗi gõ dở, clamp min/max khi
 * blur, suffix, lỗi validation.
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiFormNumber, type UiFormNumberProps } from "./UiFormNumber";

interface HostValues {
  soLuong: number | null;
}

type HostProps = Partial<
  Omit<UiFormNumberProps<HostValues>, "control" | "name">
> & {
  defaultValue?: number | null;
  errorMessage?: string;
};

function Host({ defaultValue = null, errorMessage, ...props }: HostProps) {
  const { control, watch, setError } = useForm<HostValues>({
    defaultValues: { soLuong: defaultValue },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("soLuong", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("soLuong");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormNumber
        control={control}
        name="soLuong"
        label="Số lượng"
        {...props}
      />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormNumber", () => {
  it("render label + dấu * khi required; input inputmode=decimal", () => {
    const { container } = render(<Host required />);
    const input = screen.getByLabelText(/Số lượng/);
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(container.querySelector(".MuiFormLabel-asterisk")).not.toBeNull();
  });

  it("nhập '12.5' → form value là number 12.5", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.type(screen.getByLabelText("Số lượng"), "12.5");
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^12\.5$/);
  });

  it("xoá rỗng → form value null", async () => {
    const user = userEvent.setup();
    render(<Host defaultValue={7} />);
    const input = screen.getByLabelText("Số lượng");
    expect(input).toHaveValue("7");
    await user.clear(input);
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^null$/);
    expect(input).toHaveValue("");
  });

  it("đang gõ dở '1.' → text giữ nguyên, form value = 1", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByLabelText("Số lượng");
    await user.type(input, "1.");
    expect(input).toHaveValue("1.");
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^1$/);
  });

  it("blur chốt giá trị: clamp theo max và chuẩn hoá text", async () => {
    const user = userEvent.setup();
    render(<Host max={10} />);
    const input = screen.getByLabelText("Số lượng");
    await user.type(input, "50");
    await user.tab();
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^10$/);
    expect(input).toHaveValue("10");
  });

  it("blur clamp theo min", async () => {
    const user = userEvent.setup();
    render(<Host min={5} />);
    const input = screen.getByLabelText("Số lượng");
    await user.type(input, "2");
    await user.tab();
    expect(screen.getByTestId("form-value")).toHaveTextContent(/^5$/);
  });

  it("suffix hiển thị ở endAdornment", () => {
    render(<Host suffix="₫" />);
    expect(screen.getByText("₫")).toBeInTheDocument();
  });

  it("lỗi validation hiển thị đúng message; disabled đúng", () => {
    render(<Host errorMessage="Số lượng không hợp lệ" disabled />);
    expect(screen.getByText("Số lượng không hợp lệ")).toBeInTheDocument();
    expect(screen.getByLabelText("Số lượng")).toBeDisabled();
  });
});
