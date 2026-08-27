/**
 * Contract test UiPageContainer (jsdom): render title/subtitle/actions/
 * breadcrumb/children + padding trang 24 (SPACING.xl).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SPACING } from "@/shared/ui/tokens";
import { UiPageContainer } from "./UiPageContainer";

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiPageContainer", () => {
  it("render đủ slot: breadcrumb, title (h1), subtitle, actions, children", () => {
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiPageContainer
          title="Quản lý kho"
          subtitle="Danh sách phiếu nhập"
          breadcrumb={<div data-testid="slot-breadcrumb">bc</div>}
          actions={<button type="button">Tạo phiếu</button>}
        >
          <div data-testid="slot-children">bảng</div>
        </UiPageContainer>
      </MuiThemeProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Quản lý kho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(screen.getByTestId("slot-breadcrumb")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tạo phiếu" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("slot-children")).toBeInTheDocument();
    expect(emotionCss()).toContain(`padding:${SPACING.xl}px`);
  });

  it("không title/subtitle/actions/breadcrumb → chỉ render children", () => {
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiPageContainer>
          <div data-testid="only-children">nội dung</div>
        </UiPageContainer>
      </MuiThemeProvider>,
    );
    expect(screen.getByTestId("only-children")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
