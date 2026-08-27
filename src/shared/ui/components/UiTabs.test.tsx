/**
 * UiTabs — render/selected/callback/keyboard (mũi tên di chuyển focus giữa
 * các tab theo chuẩn WAI-ARIA của MUI Tabs).
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiTabs } from "./UiTabs";

const ITEMS = [
  { key: "all", label: "Tất cả" },
  { key: "draft", label: "Nháp" },
  { key: "posted", label: "Đã ghi sổ", disabled: true },
];

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

describe("UiTabs", () => {
  it("render đủ tab + đánh dấu tab đang chọn", () => {
    renderUi(
      <UiTabs
        items={ITEMS}
        value="draft"
        onChange={() => {}}
        aria-label="Bộ lọc trạng thái"
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Nháp" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tablist", { name: "Bộ lọc trạng thái" }),
    ).toBeInTheDocument();
  });

  it("click tab khác → gọi onChange(key)", () => {
    const onChange = vi.fn();
    renderUi(<UiTabs items={ITEMS} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Nháp" }));
    expect(onChange).toHaveBeenCalledWith("draft");
  });

  it("tab disabled không gọi onChange", () => {
    const onChange = vi.fn();
    renderUi(<UiTabs items={ITEMS} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Đã ghi sổ" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowRight di chuyển focus sang tab kế tiếp", () => {
    renderUi(<UiTabs items={ITEMS} value="all" onChange={() => {}} />);
    const first = screen.getByRole("tab", { name: "Tất cả" });
    // focus() ngoài fireEvent → tự bọc act để không rơi cảnh báo React.
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Nháp" })).toHaveFocus();
  });
});
