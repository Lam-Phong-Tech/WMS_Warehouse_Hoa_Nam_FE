/**
 * UiTimeline — <ol role=list> tự dựng: đủ item, chấm màu theo tone, đường nối
 * màu border token, item cuối không có đường nối.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { UiTimeline } from "./UiTimeline";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

function emotionCss(): string {
  return Array.from(document.head.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
}

const ITEMS = [
  { title: "Tạo phiếu", time: "08:00 27/08", description: "Bởi Nguyễn Văn An" },
  { title: "Duyệt phiếu", tone: "success" as const },
  { title: "Ghi sổ", tone: "error" as const },
];

describe("UiTimeline", () => {
  it("render role=list với đủ listitem + nội dung", () => {
    renderUi(<UiTimeline items={ITEMS} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Tạo phiếu")).toBeInTheDocument();
    expect(screen.getByText("08:00 27/08")).toBeInTheDocument();
    expect(screen.getByText("Bởi Nguyễn Văn An")).toBeInTheDocument();
  });

  it("chấm màu theo tone (mặc định primary) + đường nối màu border token", () => {
    renderUi(<UiTimeline items={ITEMS} />);
    const css = emotionCss().toLowerCase();
    expect(css).toContain(S.primary.toLowerCase());
    expect(css).toContain(S.success.toLowerCase());
    expect(css).toContain(S.error.toLowerCase());
    expect(css).toContain(S.border.toLowerCase());
  });

  it("một item duy nhất → không render đường nối", () => {
    const { container } = renderUi(
      <UiTimeline items={[{ title: "Tạo phiếu" }]} />,
    );
    const li = container.querySelector("li");
    // Cột trang trí chỉ còn đúng 1 phần tử (chấm tròn), không có đường nối.
    expect(li?.firstElementChild?.childElementCount).toBe(1);
  });

  it("có thể kéo dài đường dọc dưới item cuối cho lịch sử NFC", () => {
    const { container } = renderUi(
      <UiTimeline
        items={[{ title: "Gán chip thành công" }]}
        extendLastLine
        lineColor="var(--ops-primary)"
      />,
    );
    const li = container.querySelector("li");
    expect(li?.firstElementChild?.childElementCount).toBe(2);
    expect(emotionCss()).toContain("var(--ops-primary)");
  });
});
