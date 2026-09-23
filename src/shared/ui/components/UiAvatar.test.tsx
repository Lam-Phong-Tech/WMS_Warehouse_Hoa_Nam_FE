/**
 * UiAvatar — initials 2 từ cuối của tên, ảnh khi có src, kích thước theo
 * token size (28/36/44) + màu primarySoft/infoText.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { UiAvatar } from "./UiAvatar";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiAvatar", () => {
  it("không src → initials từ 2 từ cuối ('Nguyễn Văn An' → 'VA')", () => {
    renderUi(<UiAvatar name="Nguyễn Văn An" />);
    expect(screen.getByText("VA")).toBeInTheDocument();
  });

  it("tên một từ → 1 chữ cái", () => {
    renderUi(<UiAvatar name="Admin" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("có src → render ảnh với alt = name", () => {
    renderUi(<UiAvatar name="Trần Tùng Lâm" src="/avatar.png" />);
    expect(screen.getByRole("img", { name: "Trần Tùng Lâm" })).toHaveAttribute(
      "src",
      "/avatar.png",
    );
  });

  it("size sm → 28px; nền primarySoft + chữ infoText", () => {
    renderUi(<UiAvatar name="Nguyễn Văn An" size="sm" />);
    const css = emotionCss();
    expect(css).toContain("width:28px");
    expect(css).toContain("height:28px");
    expect(css).toContain(S.primarySoft);
    expect(css.toLowerCase()).toContain(S.infoText.toLowerCase());
  });
});
