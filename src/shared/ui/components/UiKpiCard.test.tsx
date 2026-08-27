/**
 * UiKpiCard — label/value/hint, ô icon nền soft theo tone, value dùng
 * TYPOGRAPHY.kpi (22/600).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui/tokens";
import { UiKpiCard } from "./UiKpiCard";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiKpiCard", () => {
  it("render label + value + hint", () => {
    renderUi(
      <UiKpiCard label="Tồn kho" value="1.280" hint="+12% so với tuần trước" />,
    );
    expect(screen.getByText("Tồn kho")).toBeInTheDocument();
    expect(screen.getByText("1.280")).toBeInTheDocument();
    expect(screen.getByText("+12% so với tuần trước")).toBeInTheDocument();
  });

  it("value dùng cỡ chữ KPI 22/600 (token)", () => {
    renderUi(<UiKpiCard label="Phiếu chờ" value={42} />);
    const css = emotionCss();
    expect(css).toContain(`font-size:${TYPOGRAPHY.kpi.fontSize}px`);
    expect(css).toContain(`font-weight:${TYPOGRAPHY.kpi.fontWeight}`);
  });

  it("icon → ô vuông nền soft theo tone mặc định primary", () => {
    const { container } = renderUi(
      <UiKpiCard label="SKU" value={99} icon="box" />,
    );
    expect(container.querySelector(".fi-rr-box")).not.toBeNull();
    expect(emotionCss()).toContain(S.primarySoft);
  });

  it("tone success → nền successSoft + chữ successText", () => {
    renderUi(
      <UiKpiCard label="Đã ghi sổ" value={7} icon="check" tone="success" />,
    );
    const css = emotionCss();
    expect(css).toContain(S.successSoft);
    expect(css.toLowerCase()).toContain(S.successText.toLowerCase());
  });
});
