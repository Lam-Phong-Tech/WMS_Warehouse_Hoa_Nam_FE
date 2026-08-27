/**
 * Computed-style contract cho foundation components (jsdom-level):
 *  - theme object phản chiếu đúng token,
 *  - CSS do emotion sinh ra chứa đúng số đo Vuexy (cao 38/radius 6/chữ 15),
 *  - UiStatusBadge/UiText render đúng màu token.
 * Số đo pixel THẬT trên trình duyệt được đo ở e2e/ui-foundation.spec.ts.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { COMPONENT_TOKENS as C, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import {
  UiButton,
  UiStatusBadge,
  UiText,
  UiTextField,
} from "@/shared/ui/components";

// Render qua MuiThemeProvider trực tiếp (test cô lập — không cần antd App).
function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiButton", () => {
  it("style Vuexy: cao 38, radius 6, chữ 15/500, primary #7367F0", () => {
    renderUi(<UiButton data-testid="b">Lưu</UiButton>);
    const css = emotionCss();
    expect(css).toContain(`height:${C.button.height}px`);
    expect(css).toContain(`border-radius:${C.button.radius}px`);
    expect(css).toContain(`font-size:${C.button.fontSize}px`);
    expect(css.toLowerCase()).toContain(S.primary.toLowerCase());
    const btn = screen.getByTestId("b");
    expect(btn.className).toContain("MuiButton-contained");
  });

  it("loading → disabled + spinner", () => {
    renderUi(<UiButton loading>Đang lưu</UiButton>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.querySelector(".MuiCircularProgress-root")).not.toBeNull();
  });
});

describe("UiTextField", () => {
  it("input radius 6 + chữ 15 qua theme override", () => {
    renderUi(<UiTextField label="Mã phiếu" />);
    const css = emotionCss();
    expect(css).toContain(`border-radius:${C.input.radius}px`);
    expect(css).toContain(`font-size:${C.input.fontSize}px`);
  });
});

describe("UiStatusBadge", () => {
  it("tone success → nền soft + chữ successText (inline qua emotion)", () => {
    renderUi(
      <UiStatusBadge tone="success" label="ĐÃ DUYỆT" data-testid="badge" />,
    );
    const css = emotionCss().toLowerCase();
    expect(css).toContain(S.successSoft.toLowerCase());
    expect(css).toContain(S.successText.toLowerCase());
  });
});

describe("UiText", () => {
  it("pageTitle 24/500, body 15", () => {
    renderUi(
      <>
        <UiText variant="pageTitle">Tiêu đề</UiText>
        <UiText variant="body">Nội dung</UiText>
      </>,
    );
    const css = emotionCss();
    expect(css).toContain("font-size:24px");
    expect(css).toContain("font-size:15px");
  });
});

describe("theme runtime = token contract", () => {
  it("muiTheme dùng đúng semantic (chống theme drift lúc runtime)", () => {
    expect(muiTheme.palette.primary.main).toBe(S.primary);
    expect(muiTheme.typography.fontFamily).toContain("Public Sans");
  });
});
