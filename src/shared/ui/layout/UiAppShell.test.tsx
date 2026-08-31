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

  it("mở rộng → sidebar rộng LAYOUT.sidebarWidth, nội dung né đúng bằng đó", () => {
    renderShell(false);
    const css = emotionCss();
    // aside width + lề trái nội dung đều = 260px (không xô lệch).
    expect(css).toContain(`width:${LAYOUT.sidebarWidth}px`);
    expect(css).toContain(`margin-left:${LAYOUT.sidebarWidth}px`);
  });

  it("collapsed → sidebar + lề nội dung đổi sang LAYOUT.sidebarCollapsedWidth", () => {
    renderShell(true);
    const css = emotionCss();
    expect(css).toContain(`width:${LAYOUT.sidebarCollapsedWidth}px`);
    expect(css).toContain(`margin-left:${LAYOUT.sidebarCollapsedWidth}px`);
  });

  /**
   * PEEK (he mở): rê chuột/focus vào rail thì sidebar bung TẠM ở dạng lớp phủ.
   * Điểm phải giữ: LỀ TRÁI nội dung vẫn là bề rộng thu gọn (nội dung KHÔNG xô
   * ngang) trong khi SIDEBAR nở ra 260px phủ lên trên.
   */
  it("peek → sidebar nở 260px phủ lên, lề nội dung vẫn 76px", () => {
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiAppShell
          sidebar={<div data-testid="slot-sidebar">nav</div>}
          topbar={<div data-testid="slot-topbar">topbar</div>}
          collapsed
          peek
          onPeekChange={() => {}}
        >
          <div data-testid="slot-main">nội dung</div>
        </UiAppShell>
      </MuiThemeProvider>,
    );

    const css = emotionCss();
    const aside = screen.getByTestId("app-sidebar");
    expect(aside).toHaveAttribute("data-peeking", "true");
    // Sidebar phủ 260px…
    expect(css).toContain(`width:${LAYOUT.sidebarWidth}px`);
    // …nhưng nội dung vẫn né đúng 76px (đứng yên, không bị đẩy).
    expect(css).toContain(`margin-left:${LAYOUT.sidebarCollapsedWidth}px`);
  });

  it("thu gọn nhưng KHÔNG peek → không đánh dấu data-peeking", () => {
    render(
      <MuiThemeProvider theme={muiTheme}>
        <UiAppShell
          sidebar={<div data-testid="slot-sidebar">nav</div>}
          topbar={<div data-testid="slot-topbar">topbar</div>}
          collapsed
          onPeekChange={() => {}}
        >
          <div data-testid="slot-main">nội dung</div>
        </UiAppShell>
      </MuiThemeProvider>,
    );
    expect(screen.getByTestId("app-sidebar")).not.toHaveAttribute(
      "data-peeking",
    );
  });
});
