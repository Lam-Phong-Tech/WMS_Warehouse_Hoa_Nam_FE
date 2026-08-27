/**
 * Test UiFormDate — LƯU Ý: antd bị MOCK trong src/test/setup.ts (DatePicker
 * stub render <input> trần, onChange trả e.target.value). Vì vậy test ở đây
 * chỉ assert WIRING: label/error render qua MUI FormControl, Controller
 * truyền value/onChange/placeholder/disabled vào stub — KHÔNG assert popup
 * lịch hay đối tượng dayjs (đó là hành vi antd thật, đã cover ở e2e).
 *
 * Value-contract thật (antd không mock): giá trị form là đối tượng dayjs —
 * component pass-through không convert, nên với stub chuỗi cũng đi nguyên vẹn.
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useForm } from "react-hook-form";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiFormDate, type UiFormDateProps } from "./UiFormDate";

interface HostValues {
  // string đứng thay dayjs vì DatePicker đã bị stub thành <input> text.
  ngay: string | null;
}

type HostProps = Partial<
  Omit<UiFormDateProps<HostValues>, "control" | "name">
> & {
  defaultValue?: string | null;
  errorMessage?: string;
};

function Host({ defaultValue = null, errorMessage, ...props }: HostProps) {
  const { control, watch, setError } = useForm<HostValues>({
    defaultValues: { ngay: defaultValue },
  });
  useEffect(() => {
    if (errorMessage) {
      setError("ngay", { type: "manual", message: errorMessage });
    }
  }, [errorMessage, setError]);
  const value = watch("ngay");
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiFormDate control={control} name="ngay" label="Ngày nhập" {...props} />
      <output data-testid="form-value">{JSON.stringify(value)}</output>
    </MuiThemeProvider>
  );
}

describe("UiFormDate (wiring qua antd DatePicker stub)", () => {
  it("render FormLabel nối input qua htmlFor/id + dấu * khi required", () => {
    const { container } = render(<Host required />);
    // htmlFor của FormLabel trỏ đúng id mà component gắn vào DatePicker.
    expect(screen.getByLabelText(/Ngày nhập/)).toBeInTheDocument();
    expect(container.querySelector(".MuiFormLabel-asterisk")).not.toBeNull();
  });

  it("Controller truyền value vào stub (pass-through, không convert)", () => {
    render(<Host defaultValue="15/01/2026" />);
    expect(screen.getByLabelText("Ngày nhập")).toHaveValue("15/01/2026");
  });

  it("onChange từ stub → cập nhật form value nguyên vẹn", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.type(screen.getByLabelText("Ngày nhập"), "01/02/2026");
    expect(screen.getByTestId("form-value")).toHaveTextContent('"01/02/2026"');
  });

  it("lỗi validation hiển thị qua FormHelperText", () => {
    render(<Host errorMessage="Ngày nhập không hợp lệ" />);
    expect(screen.getByText("Ngày nhập không hợp lệ")).toBeInTheDocument();
  });

  it("helperText mặc định hiển thị khi không có lỗi", () => {
    render(<Host helperText="Định dạng DD/MM/YYYY" />);
    expect(screen.getByText("Định dạng DD/MM/YYYY")).toBeInTheDocument();
  });

  it("placeholder/disabled/data-testid truyền xuống stub", () => {
    render(<Host placeholder="Chọn ngày" disabled data-testid="date-input" />);
    const input = screen.getByTestId("date-input");
    expect(input).toHaveAttribute("placeholder", "Chọn ngày");
    expect(input).toBeDisabled();
  });
});
