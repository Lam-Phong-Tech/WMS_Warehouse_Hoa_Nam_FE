/**
 * Hợp đồng của lớp icon canonical (Flaticon Uicons).
 *
 * Guard tĩnh `yarn ui:icons` đã lo phần "slug có tồn tại / slot đã nối vào
 * theme". File này khoá phần TINH TẾ mà guard không thấy: component icon phải
 * ghép được className state của MUI/antd và KHÔNG rò prop nội bộ (ownerState,
 * fontSize) ra DOM — rò là React cảnh báo và HTML bẩn.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import Checkbox from "@mui/material/Checkbox";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { createFlatIcon } from "./flat-icon";
import { ICON_SLUGS, MUI_ICON_SLOTS } from "./icon-slots";
import { ICON_FAMILY, flatIconClass } from "./icon-family";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

describe("createFlatIcon", () => {
  it("render thẻ <i> mang class Flaticon và ẩn khỏi a11y tree", () => {
    const Icon = createFlatIcon("user");
    const { container } = render(<Icon data-testid="icon" />);
    const el = container.querySelector("i")!;
    expect(el.className).toBe(flatIconClass("user"));
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("GHÉP className của slot thay vì ghi đè (state mở/đóng của MUI)", () => {
    const Icon = createFlatIcon("angle-small-down");
    const { container } = render(<Icon className="MuiSelect-icon Mui-open" />);
    const el = container.querySelector("i")!;
    expect(el.className).toContain(`${ICON_FAMILY.prefix}-angle-small-down`);
    expect(el.className).toContain("MuiSelect-icon");
    expect(el.className).toContain("Mui-open");
  });

  it("nuốt ownerState/fontSize của MUI, không đẩy ra DOM", () => {
    const Icon = createFlatIcon("check");
    const { container } = render(
      // MUI slot API bơm 2 prop này xuống mọi slot icon.
      <Icon ownerState={{ open: true }} fontSize="small" />,
    );
    const el = container.querySelector("i")!;
    expect(el.getAttribute("ownerstate")).toBeNull();
    expect(el.getAttribute("fontsize")).toBeNull();
  });

  it("size của factory thành font-size, style của call site vẫn đè được", () => {
    const Icon = createFlatIcon("cross-small", { size: 16 });
    const { container } = render(<Icon style={{ fontSize: 24 }} />);
    expect(container.querySelector("i")!.style.fontSize).toBe("24px");
  });
});

describe("slot icon nối vào theme MUI", () => {
  it("Select dùng mũi tên Flaticon thay icon SVG nội bộ", () => {
    const { container } = renderUi(
      <Select value="a" label="Kho">
        <MenuItem value="a">Kho A</MenuItem>
      </Select>,
    );
    expect(container.querySelector("svg.MuiSvgIcon-root")).toBeNull();
    expect(
      container.querySelector(
        `i.fi.${ICON_FAMILY.prefix}-${ICON_SLUGS.expand}`,
      ),
    ).not.toBeNull();
  });

  it("Checkbox đổi glyph theo trạng thái chọn", () => {
    const { container, rerender } = renderUi(<Checkbox checked={false} />);
    expect(
      container.querySelector(
        `i.${ICON_FAMILY.prefix}-${ICON_SLUGS.checkboxBlank}`,
      ),
    ).not.toBeNull();

    rerender(
      <MuiThemeProvider theme={muiTheme}>
        <Checkbox checked />
      </MuiThemeProvider>,
    );
    expect(
      container.querySelector(
        `i.${ICON_FAMILY.prefix}-${ICON_SLUGS.checkboxChecked}`,
      ),
    ).not.toBeNull();
    expect(container.querySelector("svg.MuiSvgIcon-root")).toBeNull();
  });

  it("mọi slot khai báo đều có giá trị (không rỗng)", () => {
    for (const [component, slots] of Object.entries(MUI_ICON_SLOTS)) {
      expect(Object.keys(slots).length, `${component} rỗng`).toBeGreaterThan(0);
    }
  });
});

describe("UiSpinner", () => {
  it("là glyph Flaticon + giữ role progressbar", async () => {
    const { UiSpinner } = await import("@/shared/ui/components/UiSpinner");
    const { container } = renderUi(<UiSpinner size={20} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      container.querySelector(`i.fi.${ICON_FAMILY.prefix}-spinner`),
    ).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });
});
