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
import {
  COMPONENT_TOKENS as C,
  OPERATIONS_PALETTE,
  cssVarNameOf,
} from "@/shared/ui/tokens";
import {
  UiButton,
  UiStatusBadge,
  UiText,
  UiTextField,
} from "@/shared/ui/components";

/**
 * So với `PALETTE.light` (giá trị THÔ) chứ không phải `SEMANTIC_LIGHT`: từ đợt
 * dark mode, SEMANTIC_LIGHT là mặt tiền `var(--wms-…)` — dùng nó ở đây thì test
 * chỉ so hai chuỗi biến với nhau và không còn bắt được theme drift nữa.
 */
const S = OPERATIONS_PALETTE.light;
import { ICON_FAMILY } from "@/shared/ui/icons/icon-family";

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
  it("style Vuexy: cao 40, radius 6, chữ 14/600, màu Tổng quan vận hành", () => {
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
    expect(
      btn.querySelector(`.hn-spinner i.${ICON_FAMILY.prefix}-spinner`),
    ).not.toBeNull();
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
  /**
   * Khẳng định là BIẾN CSS chứ không phải màu thô: badge phải bám
   * `--wms-success-*` để tự đổi khi `<html data-theme>` sang tối. Nếu emotion
   * lại sinh ra hex/rgba cứng thì tone này sẽ đứng nguyên màu sáng trên nền tối —
   * đúng thứ test này tồn tại để chặn.
   */
  it("tone success → nền soft + chữ successText, bám biến CSS để theo được chế độ tối", () => {
    renderUi(
      <UiStatusBadge tone="success" label="ĐÃ DUYỆT" data-testid="badge" />,
    );
    const css = emotionCss().toLowerCase();
    expect(css).toContain(cssVarNameOf("successSoft"));
    expect(css).toContain(cssVarNameOf("successText"));
    expect(css).not.toContain(S.successSoft.toLowerCase());
  });
});

describe("UiText", () => {
  it("pageTitle 24/500, body 14", () => {
    renderUi(
      <>
        <UiText variant="pageTitle">Tiêu đề</UiText>
        <UiText variant="body">Nội dung</UiText>
      </>,
    );
    const css = emotionCss();
    expect(css).toContain("font-size:24px");
    expect(css).toContain("font-size:14px");
  });
});

describe("theme runtime = token contract", () => {
  it("muiTheme dùng đúng semantic (chống theme drift lúc runtime)", () => {
    expect(muiTheme.palette.primary.main).toBe(S.primary);
    expect(muiTheme.typography.fontFamily).toContain("Inter");
  });
});
