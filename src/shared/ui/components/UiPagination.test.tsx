/**
 * UiPagination — render/callback/ARIA: tổng bản ghi, đổi trang, đổi cỡ trang,
 * total=0 vẫn render, disabled khoá điều khiển.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiPagination } from "./UiPagination";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

describe("UiPagination", () => {
  it("render <nav aria-label='Phân trang'> + tổng bản ghi", () => {
    renderUi(
      <UiPagination
        page={1}
        pageSize={10}
        total={25}
        onPageChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Phân trang" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tổng 25 bản ghi")).toBeInTheDocument();
  });

  it("click trang 2 → gọi onPageChange(2)", () => {
    const onPageChange = vi.fn();
    renderUi(
      <UiPagination
        page={1}
        pageSize={10}
        total={25}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("chọn cỡ trang mới → gọi onPageSizeChange(20)", () => {
    const onPageSizeChange = vi.fn();
    renderUi(
      <UiPagination
        page={1}
        pageSize={10}
        total={25}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    // MUI Select mở menu bằng mouseDown trên combobox.
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Số bản ghi mỗi trang" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "20 / trang" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });

  it("không truyền onPageSizeChange → ẩn Select cỡ trang", () => {
    renderUi(
      <UiPagination
        page={1}
        pageSize={10}
        total={25}
        onPageChange={() => {}}
      />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("total=0 vẫn render 'Tổng 0 bản ghi' + 1 trang", () => {
    renderUi(
      <UiPagination page={1} pageSize={10} total={0} onPageChange={() => {}} />,
    );
    expect(screen.getByText("Tổng 0 bản ghi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /page 1/ })).toBeInTheDocument();
  });

  it("pageSize ngoài mốc chuẩn vẫn hiển thị đúng trong Select", () => {
    renderUi(
      <UiPagination
        page={1}
        pageSize={15}
        total={100}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Số bản ghi mỗi trang" }),
    ).toHaveTextContent("15 / trang");
  });

  it("disabled → khoá nút chuyển trang", () => {
    renderUi(
      <UiPagination
        page={1}
        pageSize={10}
        total={25}
        disabled
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /2/ })).toBeDisabled();
  });
});
