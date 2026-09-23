/**
 * Test UiSelect — quy tắc "danh sách dài thì gõ được để tìm":
 * ngắn giữ dropdown thường, dài tự thành ô tìm kiếm, nhãn ReactNode thì không
 * tự đổi (Autocomplete lọc theo chuỗi).
 */
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SEARCHABLE_OPTION_THRESHOLD } from "@/shared/ui/forms/searchable-options";
import { UiSelect, type UiSelectChoice } from "./UiSelect";

const SHORT: UiSelectChoice[] = [
  { value: "a", label: "Kho A" },
  { value: "b", label: "Kho B" },
];

/** Vượt ngưỡng để rơi vào nhánh tìm kiếm. */
const LONG: UiSelectChoice[] = Array.from(
  { length: SEARCHABLE_OPTION_THRESHOLD + 4 },
  (_unused, index) => ({
    value: `sku-${index}`,
    label:
      index === 3 ? "SKU-HONDA · Máy nổ Honda" : `SKU-${index} · Hàng ${index}`,
  }),
);

function Host({
  options,
  initial = "",
  ...props
}: {
  options: UiSelectChoice[];
  initial?: string;
} & Partial<Omit<UiSelectProps, "value" | "onChange" | "options">>) {
  const [value, setValue] = useState(initial);
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiSelect
        aria-label="Lọc hàng hoá"
        value={value}
        options={options}
        onChange={setValue}
        {...props}
      />
      <output data-testid="value">{value}</output>
    </MuiThemeProvider>
  );
}

type UiSelectProps = Parameters<typeof UiSelect>[0];

describe("UiSelect — ngưỡng tìm kiếm", () => {
  it("danh sách ngắn: giữ dropdown thường (không có ô nhập)", () => {
    render(<Host options={SHORT} />);
    expect(screen.getByRole("combobox")).not.toHaveProperty("tagName", "INPUT");
  });

  it("danh sách dài: thành ô gõ-để-tìm, lọc theo từ khoá rồi chọn được", async () => {
    const user = userEvent.setup();
    render(<Host options={LONG} />);

    const input = screen.getByRole("combobox", { name: "Lọc hàng hoá" });
    expect(input.tagName).toBe("INPUT");

    await user.click(input);
    await user.keyboard("honda");
    const matches = screen.getAllByRole("option");
    expect(matches).toHaveLength(1);

    await user.click(matches[0]);
    expect(screen.getByTestId("value")).toHaveTextContent("sku-3");
  });

  it("xoá lựa chọn trả về chuỗi rỗng (giữ nghĩa 'không lọc')", async () => {
    const user = userEvent.setup();
    render(<Host options={LONG} initial="sku-3" />);
    expect(screen.getByTestId("value")).toHaveTextContent("sku-3");

    // Nút xoá lựa chọn nay mang nhãn tiếng Việt — MUI mặc định là "Clear",
    // chữ Anh nằm ngay trên ô lọc của màn tiếng Việt.
    // getByTitle chứ không getByRole: MUI để nút này `visibility: hidden` tới
    // khi hover/focus nên nó không nằm trong cây accessibility.
    await user.click(screen.getByTitle("Bỏ chọn"));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("nhãn ReactNode: KHÔNG tự đổi sang tìm kiếm (lọc cần nhãn chuỗi)", () => {
    const richOptions: UiSelectChoice[] = LONG.map((option) => ({
      ...option,
      label: <span>{String(option.label)}</span>,
    }));
    render(<Host options={richOptions} />);
    expect(screen.getByRole("combobox").tagName).not.toBe("INPUT");
  });

  it("prop searchable ép được cả hai chiều", () => {
    const { unmount } = render(<Host options={SHORT} searchable />);
    expect(screen.getByRole("combobox").tagName).toBe("INPUT");
    unmount();

    render(<Host options={LONG} searchable={false} />);
    expect(screen.getByRole("combobox").tagName).not.toBe("INPUT");
  });
});

/**
 * Kênh báo lỗi thêm ngày 06/09/2026: trước đó UiSelect KHÔNG có
 * error/helperText/required, nên ô select bắt buộc đặt trong form không có chỗ
 * nào hiện câu lỗi — validate bắt được nhưng người dùng không thấy gì.
 */
describe("UiSelect — báo lỗi", () => {
  it("hiện helperText ở CẢ hai nhánh (dropdown thường và ô tìm kiếm)", () => {
    const { unmount } = render(
      <Host options={SHORT} error helperText="Chưa chọn kho" />,
    );
    expect(screen.getByText("Chưa chọn kho")).toBeInTheDocument();
    unmount();

    render(<Host options={LONG} error helperText="Chưa chọn SKU" />);
    expect(screen.getByText("Chưa chọn SKU")).toBeInTheDocument();
  });

  it("gắn aria-invalid và aria-describedby để trình đọc màn hình đọc được lỗi", () => {
    render(<Host options={SHORT} error helperText="Chưa chọn kho" />);
    const control = screen.getByRole("combobox");
    expect(control).toHaveAttribute("aria-invalid", "true");
    const describedBy = control.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Chưa chọn kho",
    );
  });

  it("không lỗi thì không gắn aria-invalid", () => {
    render(<Host options={SHORT} />);
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-invalid");
  });

  it("required hiện dấu sao trên nhãn", () => {
    render(<Host options={SHORT} label="Kho" required />);
    expect(screen.getByText("Kho").textContent).toContain("*");
  });
});

describe("UiSelect — scoped portal presentation", () => {
  it.each([{ options: SHORT }, { options: LONG }])(
    "keeps menu styling and selection when the dropdown changes mode",
    async ({ options }) => {
      const user = userEvent.setup();
      render(<Host options={options} menuClassName="hn-iam-menu" />);
      await user.click(screen.getByRole("combobox", { name: "Lọc hàng hoá" }));
      const option = screen
        .getAllByRole("option")
        .find((item) => item.textContent === String(options[0].label));
      expect(option?.closest(".hn-iam-menu")).not.toBeNull();
      await user.click(option!);
      expect(screen.getByTestId("value")).toHaveTextContent(
        String(options[0].value),
      );
    },
  );
});
