/**
 * Contract test UiTopbar (jsdom): render slot left/right + số đo baseline
 * (cao 80, sticky, z-index header) qua CSS emotion.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { Z_INDEX } from "@/shared/ui/tokens";
import { UiTopbar } from "./UiTopbar";
import { LAYOUT } from "./layout-tokens";

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiTopbar", () => {
  it("render slot left/right trong <header> + số đo baseline", () => {
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiTopbar
          left={<div data-testid="slot-left">menu</div>}
          right={<div data-testid="slot-right">user</div>}
        />
      </MuiThemeProvider>,
    );
    const header = screen.getByRole("banner");
    expect(header).toContainElement(screen.getByTestId("slot-left"));
    expect(header).toContainElement(screen.getByTestId("slot-right"));

    const css = emotionCss();
    expect(css).toContain(`height:${LAYOUT.topbarHeight}px`);
    expect(css).toContain("position:sticky");
    expect(css).toContain(`z-index:${Z_INDEX.header}`);
  });
});
