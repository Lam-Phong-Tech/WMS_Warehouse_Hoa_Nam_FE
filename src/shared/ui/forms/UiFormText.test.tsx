/**
 * Test UiFormText — label/required, nhập giá trị, lỗi validation, password
 * toggle, search icon, aria-describedby (helperText).
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiFormText, type UiFormTextProps } from "./UiFormText";

interface HostValues {
  ten: string;
}

type HostProps = Partial<
  Omit<UiFormTextProps<HostValues>, "control" | "name">
> & {
  defaultValue?: string;
  errorMessage?: string;
};

/** Host nhỏ dùng useForm thật — expose form value qua <output> để assert. */
function Host({ defaultValue = "", errorMessage, ...props }: HostProps) {
  const { control, watch, setError } = useForm<HostValues>({
    defaultValues: { ten: defaultValue },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("ten", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("ten");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormText control={control} name="ten" label="Tên" {...props} />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormText", () => {
  it("render label + dấu * khi required", () => {
    const { container } = render(<Host required />);
    expect(screen.getByLabelText(/Tên/)).toBeInTheDocument();
    const asterisk = container.querySelector(".MuiFormLabel-asterisk");
    expect(asterisk).not.toBeNull();
    expect(asterisk?.textContent).toContain("*");
  });

  it("nhập giá trị → cập nhật form value", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.type(screen.getByLabelText("Tên"), "Hoa Nam");
    expect(screen.getByTestId("form-value")).toHaveTextContent('"Hoa Nam"');
  });

  it("lỗi validation hiển thị đúng message + aria-invalid", () => {
    render(<Host errorMessage="Bắt buộc nhập tên" />);
    expect(screen.getByText("Bắt buộc nhập tên")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("disabled đúng", () => {
    render(<Host disabled />);
    expect(screen.getByLabelText("Tên")).toBeDisabled();
  });

  it("password: toggle đổi aria-label và input type", async () => {
    const user = userEvent.setup();
    render(<Host type="password" />);
    const input = screen.getByLabelText("Tên");
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" });
    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Ẩn mật khẩu" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("search: có icon kính lúp ở startAdornment", () => {
    const { container } = render(<Host type="search" />);
    expect(container.querySelector("i.fi.fi-rr-search")).not.toBeNull();
  });

  it("helperText nối aria-describedby (MUI mặc định)", () => {
    render(<Host helperText="Gợi ý nhập tên" />);
    const input = screen.getByLabelText("Tên");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const helper = document.getElementById(describedBy as string);
    expect(helper).toHaveTextContent("Gợi ý nhập tên");
  });
});
