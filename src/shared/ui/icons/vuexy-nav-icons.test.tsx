/**
 * Khoá hình học icon thanh điều hướng = đúng bản demo UI/UX đã chốt
 * (1.WMS_Hoa_Nam_Sidebar_Demo.html — lucide@1.17.0). Ai đổi path là test đỏ,
 * tránh "sửa cho gần giống" làm lệch khỏi bản chốt.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { VUEXY_NAV_ICONS, type VuexyNavIconName } from "./vuexy-nav-icon-paths";
import { VuexyNavIcon } from "./vuexy-nav-icons";

/** Path 'd' đặc trưng của từng icon, chép từ lucide bản demo nạp. */
const SIGNATURE_D: Partial<Record<VuexyNavIconName, string>> = {
  "package-search": "M12 22V12",
  warehouse: "M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11",
  "chart-column-big": "M3 3v16a2 2 0 0 0 2 2h16",
  "settings-2": "M14 17H5",
  "chevron-down": "m6 9 6 6 6-6",
};

describe("VuexyNavIcon — hình học khớp demo", () => {
  it("đủ 8 icon nhóm + chevron + nút thu gọn", () => {
    expect(Object.keys(VUEXY_NAV_ICONS)).toHaveLength(10);
  });

  it("giữ nguyên path 'd' đặc trưng của lucide bản demo", () => {
    for (const [name, d] of Object.entries(SIGNATURE_D)) {
      const parts = VUEXY_NAV_ICONS[name as VuexyNavIconName] as ReadonlyArray<
        readonly [string, Record<string, string>]
      >;
      const found = parts.some(([, attrs]) => attrs.d === d);
      expect(found, `${name} phải chứa path "${d}"`).toBe(true);
    }
  });

  it("render <svg> viewBox 24, nét mặc định 1.65, đổi được strokeWidth", () => {
    const { container, rerender } = render(<VuexyNavIcon name="warehouse" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke-width")).toBe("1.65");
    expect(svg.getAttribute("fill")).toBe("none");
    // warehouse = 4 hình (2 path mái/thân + 2 path vạch ngang)
    expect(svg.children).toHaveLength(4);

    rerender(<VuexyNavIcon name="circle-dot" strokeWidth={1.8} size={18} />);
    const dot = container.querySelector("svg")!;
    expect(dot.getAttribute("stroke-width")).toBe("1.8");
    expect(dot.getAttribute("width")).toBe("18");
  });
});
