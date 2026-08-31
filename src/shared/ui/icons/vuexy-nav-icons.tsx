/**
 * VuexyNavIcon — vẽ icon thanh điều hướng theo demo UI/UX đã chốt.
 * Hình học nằm ở `vuexy-nav-icon-paths.ts`; ở đây chỉ là vỏ <svg> với thuộc
 * tính mặc định của lucide (viewBox 24, fill none, stroke currentColor, đầu/góc
 * nét bo tròn) và nét theo demo: 1.65 cho icon menu, 1.8 cho nút thu gọn.
 */
import { createElement } from "react";
import { VUEXY_NAV_ICONS, type VuexyNavIconName } from "./vuexy-nav-icon-paths";

export interface VuexyNavIconProps {
  name: VuexyNavIconName;
  /** Cạnh ô icon (px). Demo: 20 cho menu, 15 cho chevron, 18 cho nút thu gọn. */
  size?: number;
  /** Nét vẽ. Demo: 1.65 cho menu/chevron, 1.8 cho nút thu gọn. */
  strokeWidth?: number;
}

export function VuexyNavIcon({
  name,
  size = 20,
  strokeWidth = 1.65,
}: VuexyNavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      {VUEXY_NAV_ICONS[name].map(([tag, attrs], index) =>
        createElement(tag, { key: index, ...attrs }),
      )}
    </svg>
  );
}
