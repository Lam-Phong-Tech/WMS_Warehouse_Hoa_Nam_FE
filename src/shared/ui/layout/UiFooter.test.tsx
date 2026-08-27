/**
 * Contract test UiFooter (jsdom): render children trong <footer>, caption 12
 * màu textDisabled + padding SPACING.lg, căn giữa.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SPACING } from "@/shared/ui/tokens";
import { UiFooter } from "./UiFooter";

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiFooter", () => {
  it("render children trong <footer> + caption 12, padding 16, căn giữa", () => {
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiFooter>© 2026 WMS Hoà Nam</UiFooter>
      </MuiThemeProvider>,
    );
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("© 2026 WMS Hoà Nam");

    const css = emotionCss();
    expect(css).toContain(`padding:${SPACING.lg}px`);
    expect(css).toContain("text-align:center");
    expect(css).toContain("font-size:12px");
  });

  it("không children → footer rỗng vẫn render được", () => {
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiFooter />
      </MuiThemeProvider>,
    );
    expect(screen.getByRole("contentinfo")).toBeEmptyDOMElement();
  });
});
