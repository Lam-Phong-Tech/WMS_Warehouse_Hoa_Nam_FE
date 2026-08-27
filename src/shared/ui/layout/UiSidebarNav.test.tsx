/**
 * Contract test UiSidebarNav (jsdom): render nhóm/item, active có
 * aria-current="page", click gọi onClick, collapsed ẩn label (chỉ icon+tooltip).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiSidebarNav, type UiSidebarNavGroup } from "./UiSidebarNav";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

const GROUPS: UiSidebarNavGroup[] = [
  {
    label: "Kho vận",
    items: [
      { key: "dashboard", label: "Tổng quan", icon: "apps", active: true },
      { key: "inbound", label: "Nhập kho", icon: "box" },
    ],
  },
  {
    label: "Hệ thống",
    items: [{ key: "users", label: "Người dùng", icon: "user" }],
  },
];

describe("UiSidebarNav", () => {
  it("render nav aria-label + đủ nhóm và item", () => {
    renderUi(<UiSidebarNav groups={GROUPS} />);
    expect(
      screen.getByRole("navigation", { name: "Điều hướng chính" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kho vận")).toBeInTheDocument();
    expect(screen.getByText("Hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Tổng quan")).toBeInTheDocument();
    expect(screen.getByText("Nhập kho")).toBeInTheDocument();
    expect(screen.getByText("Người dùng")).toBeInTheDocument();
  });

  it("item active có aria-current='page', item thường không có", () => {
    renderUi(<UiSidebarNav groups={GROUPS} />);
    const active = screen.getByRole("button", { name: /Tổng quan/ });
    const normal = screen.getByRole("button", { name: /Nhập kho/ });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(normal).not.toHaveAttribute("aria-current");
  });

  it("click item gọi onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderUi(
      <UiSidebarNav
        groups={[{ items: [{ key: "inbound", label: "Nhập kho", onClick }] }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Nhập kho/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("collapsed: ẩn label + nhãn nhóm, item vẫn truy cập được qua aria-label", () => {
    renderUi(<UiSidebarNav groups={GROUPS} collapsed />);
    // Label text không render trong DOM (chỉ còn tooltip title + aria-label)
    expect(screen.queryByText("Tổng quan")).not.toBeInTheDocument();
    expect(screen.queryByText("Kho vận")).not.toBeInTheDocument();
    // Nhưng button vẫn có accessible name
    expect(
      screen.getByRole("button", { name: "Tổng quan" }),
    ).toBeInTheDocument();
  });

  it("render header/footer slot", () => {
    renderUi(
      <UiSidebarNav
        groups={GROUPS}
        header={<div data-testid="brand">WMS</div>}
        footer={<div data-testid="version">v1.0</div>}
      />,
    );
    expect(screen.getByTestId("brand")).toBeInTheDocument();
    expect(screen.getByTestId("version")).toBeInTheDocument();
  });
});
