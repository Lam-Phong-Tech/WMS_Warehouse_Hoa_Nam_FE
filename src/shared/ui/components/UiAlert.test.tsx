/**
 * UiAlert — role alert, màu soft/text theo tone (đồng bộ UiStatusBadge),
 * AlertTitle khi có title, nút đóng khi có onClose, action tuỳ biến.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { UiAlert } from "./UiAlert";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiAlert", () => {
  it("render role=alert với nội dung + title", () => {
    renderUi(
      <UiAlert tone="info" title="Lưu ý">
        Phiếu sẽ được ghi sổ ngay.
      </UiAlert>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Lưu ý");
    expect(alert).toHaveTextContent("Phiếu sẽ được ghi sổ ngay.");
  });

  it("tone error → nền errorSoft + chữ errorText (token)", () => {
    renderUi(<UiAlert tone="error">Ghi sổ thất bại.</UiAlert>);
    const css = emotionCss();
    expect(css).toContain(S.errorSoft);
    expect(css.toLowerCase()).toContain(S.errorText.toLowerCase());
  });

  it("onClose → có nút đóng và gọi callback khi click", () => {
    const onClose = vi.fn();
    renderUi(
      <UiAlert tone="success" onClose={onClose}>
        Đã lưu.
      </UiAlert>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("action tuỳ biến render ở góc phải", () => {
    renderUi(
      <UiAlert tone="warning" action={<button type="button">Thử lại</button>}>
        Kết nối chập chờn.
      </UiAlert>,
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });
});
