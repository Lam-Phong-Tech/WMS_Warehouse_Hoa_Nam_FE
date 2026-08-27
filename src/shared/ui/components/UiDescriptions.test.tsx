/**
 * UiDescriptions — cặp nhãn/giá trị dạng grid responsive (1 cột <sm, 2 <lg,
 * `columns` cột từ lg) + span nhiều cột.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiDescriptions } from "./UiDescriptions";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

describe("UiDescriptions", () => {
  it("render đủ cặp nhãn/giá trị", () => {
    renderUi(
      <UiDescriptions
        items={[
          { label: "Mã phiếu", value: "PX-0012" },
          { label: "Người tạo", value: "Nguyễn Văn An" },
        ]}
      />,
    );
    expect(screen.getByText("Mã phiếu")).toBeInTheDocument();
    expect(screen.getByText("PX-0012")).toBeInTheDocument();
    expect(screen.getByText("Người tạo")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
  });

  it("mặc định 3 cột ở màn ≥lg (CSS grid responsive)", () => {
    renderUi(
      <UiDescriptions items={[{ label: "Ghi chú", value: "Không có" }]} />,
    );
    const css = emotionCss();
    expect(css).toContain("repeat(1, minmax(0, 1fr))");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("repeat(3, minmax(0, 1fr))");
  });

  it("columns=2 + span=2 → item chiếm trọn hàng", () => {
    renderUi(
      <UiDescriptions
        columns={2}
        items={[{ label: "Địa chỉ", value: "Kho Hoà Nam", span: 2 }]}
      />,
    );
    const css = emotionCss();
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("span 2");
  });
});
