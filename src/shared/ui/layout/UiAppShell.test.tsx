/**
 * Contract test UiAppShell (jsdom): render đủ 4 slot sidebar/topbar/main/footer
 * và đổi bề rộng cột sidebar theo LAYOUT khi collapsed.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiAppShell } from "./UiAppShell";
import { LAYOUT } from "./layout-tokens";

function renderShell(collapsed?: boolean) {
  return render(
    <MuiThemeProvider theme={muiTheme}>
      <UiAppShell
        sidebar={<div data-testid="slot-sidebar">nav</div>}
        topbar={<div data-testid="slot-topbar">topbar</div>}
        footer={<div data-testid="slot-footer">footer</div>}
        collapsed={collapsed}
      >
        <div data-testid="slot-main">nội dung</div>
      </UiAppShell>
    </MuiThemeProvider>,
  );
}

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiAppShell", () => {
  it("render đủ các slot: sidebar, topbar, children (trong <main>), footer", () => {
    renderShell();
    expect(screen.getByTestId("slot-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("slot-topbar")).toBeInTheDocument();
    expect(screen.getByTestId("slot-footer")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByTestId("slot-main"));
  });

  it("cột sidebar rộng LAYOUT.sidebarWidth (260px) khi mở rộng", () => {
    renderShell(false);
    expect(emotionCss()).toContain(
      `grid-template-columns:${LAYOUT.sidebarWidth}px 1fr`,
    );
  });

  it("collapsed → cột sidebar đổi sang LAYOUT.sidebarCollapsedWidth (72px)", () => {
    renderShell(true);
    expect(emotionCss()).toContain(
      `grid-template-columns:${LAYOUT.sidebarCollapsedWidth}px 1fr`,
    );
  });
});
