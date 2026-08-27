/**
 * Contract test UiBreadcrumb (jsdom): phần tử cuối aria-current="page",
 * phần tử trước là button gọi onClick, aria-label="Breadcrumb".
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiBreadcrumb } from "./UiBreadcrumb";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

describe("UiBreadcrumb", () => {
  it("nav có aria-label='Breadcrumb', phần tử cuối aria-current='page'", () => {
    renderUi(
      <UiBreadcrumb
        items={[
          { label: "Trang chủ", onClick: () => {} },
          { label: "Kho hàng", onClick: () => {} },
          { label: "Chi tiết phiếu" },
        ]}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
    const current = screen.getByText("Chi tiết phiếu");
    expect(current).toHaveAttribute("aria-current", "page");
    // Phần tử trước là button, không mang aria-current
    const home = screen.getByRole("button", { name: "Trang chủ" });
    expect(home).not.toHaveAttribute("aria-current");
  });

  it("click phần tử trung gian gọi onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderUi(
      <UiBreadcrumb
        items={[{ label: "Trang chủ", onClick }, { label: "Hiện tại" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Trang chủ" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
