/**
 * Test UiOptionPicker — luật "danh sách dài thì gõ được để tìm, mở ra chỉ thấy
 * một nhịp, và không bao giờ đổ cả danh mục vào DOM".
 */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { OPTION_RENDER_CHUNK } from "./option-window";
import { UiOptionPicker, type UiOptionPickerOption } from "./UiOptionPicker";

const SHORT: UiOptionPickerOption[] = [
  { value: "a", label: "Đang xử lý" },
  { value: "b", label: "Đã đóng" },
];

/** Danh mục cỡ thật: vài trăm SKU. */
const LONG: UiOptionPickerOption[] = Array.from(
  { length: 300 },
  (_unused, index) => ({
    value: `sku-${index}`,
    label: index === 7 ? "Máy nổ Honda GX160" : `Mặt hàng số ${index}`,
    hint: index === 9 ? "SKU-HONDA-9" : `SKU-${index}`,
  }),
);

function Host({
  options,
  initial = [],
  ...props
}: {
  options: UiOptionPickerOption[];
  initial?: string[];
} & Partial<Parameters<typeof UiOptionPicker>[0]>) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiOptionPicker
        aria-label="Chọn mặt hàng"
        options={options}
        value={value}
        onChange={setValue}
        {...props}
      />
      <output data-testid="value">{value.join(",")}</output>
    </MuiThemeProvider>
  );
}

describe("UiOptionPicker — danh sách dài", () => {
  it("chỉ dựng một nhịp dòng, không đổ cả danh mục ra DOM", () => {
    render(<Host options={LONG} />);
    expect(screen.getAllByRole("option")).toHaveLength(OPTION_RENDER_CHUNK);
  });

  it("nói rõ đang cắt bao nhiêu để người dùng không tưởng là hết hàng", () => {
    render(<Host options={LONG} />);
    expect(
      screen.getByText(`Đang hiển thị ${OPTION_RENDER_CHUNK}/300`, {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it("cuộn tới đáy thì dựng thêm", () => {
    render(<Host options={LONG} />);
    fireEvent.scroll(screen.getByRole("listbox"));
    expect(screen.getAllByRole("option")).toHaveLength(OPTION_RENDER_CHUNK * 2);
  });

  it("gõ tìm được theo nhãn", async () => {
    const user = userEvent.setup();
    render(<Host options={LONG} />);
    await user.type(screen.getByRole("textbox"), "honda gx");
    const matches = screen.getAllByRole("option");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveTextContent("Máy nổ Honda GX160");
  });

  it("gõ tìm được theo dòng phụ (mã SKU)", async () => {
    const user = userEvent.setup();
    render(<Host options={LONG} />);
    await user.type(screen.getByRole("textbox"), "SKU-HONDA");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("không khớp gì thì nói thẳng, không để danh sách trống trơn", async () => {
    const user = userEvent.setup();
    render(<Host options={LONG} emptyText="Không có lựa chọn nào khớp" />);
    await user.type(screen.getByRole("textbox"), "zzzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Không có lựa chọn nào khớp")).toBeInTheDocument();
  });
});

describe("UiOptionPicker — ngưỡng ô tìm kiếm", () => {
  it("danh sách ngắn: không có ô tìm", () => {
    render(<Host options={SHORT} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("prop searchable ép được cả hai chiều", () => {
    const { unmount } = render(<Host options={SHORT} searchable />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    unmount();

    render(<Host options={LONG} searchable={false} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("UiOptionPicker — chọn nhiều", () => {
  it("bấm để chọn rồi bấm lại để bỏ chọn", async () => {
    const user = userEvent.setup();
    render(<Host options={SHORT} />);

    await user.click(screen.getByRole("option", { name: /Đang xử lý/ }));
    expect(screen.getByTestId("value")).toHaveTextContent("a");

    await user.click(screen.getByRole("option", { name: /Đang xử lý/ }));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("đánh dấu aria-selected đúng dòng đang chọn", () => {
    render(<Host options={SHORT} initial={["b"]} />);
    expect(screen.getByRole("option", { name: /Đã đóng/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: /Đang xử lý/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("đủ trần thì khoá các dòng chưa chọn và nói vì sao", () => {
    render(<Host options={SHORT} initial={["a"]} maxSelectable={1} />);
    expect(screen.getByRole("option", { name: /Đã đóng/ })).toBeDisabled();
    // Dòng ĐANG chọn vẫn bấm được để bỏ ra, nếu không thì hết đường lùi.
    expect(screen.getByRole("option", { name: /Đang xử lý/ })).toBeEnabled();
    expect(screen.getByText(/Đã đủ trần 1 lựa chọn/)).toBeInTheDocument();
  });

  it("'Chọn tất cả' chỉ thêm những dòng ĐANG KHỚP từ khoá", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiOptionPicker
          aria-label="Chọn mặt hàng"
          options={LONG}
          value={[]}
          onChange={onChange}
          quickActions
        />
      </MuiThemeProvider>,
    );

    await user.type(screen.getByRole("textbox"), "honda gx");
    await user.click(screen.getByRole("button", { name: "Chọn tất cả" }));
    expect(onChange).toHaveBeenCalledWith(["sku-7"]);
  });

  it("'Chọn tất cả' không vượt trần", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiOptionPicker
          aria-label="Chọn mặt hàng"
          options={LONG}
          value={[]}
          onChange={onChange}
          maxSelectable={3}
          quickActions
        />
      </MuiThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Chọn tất cả" }));
    expect(onChange).toHaveBeenCalledWith(["sku-0", "sku-1", "sku-2"]);
  });
});
