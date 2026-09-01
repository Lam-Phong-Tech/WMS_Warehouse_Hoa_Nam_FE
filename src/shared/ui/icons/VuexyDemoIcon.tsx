/**
 * VuexyDemoIcon — vỏ <svg> của demo UI/UX Tổng quan.
 *
 * Demo dựng icon bằng `iconSvg(name)`:
 *   `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">…</svg>`
 * còn fill/stroke/stroke-width do CSS của TỪNG vị trí quyết định
 * (`.kpi-icon svg`, `.icon-button svg`, `.notification-icon svg`…). Giữ nguyên
 * hợp đồng đó: component này KHÔNG tự đặt stroke để CSS cha vẫn là nguồn duy nhất.
 */
import { createElement } from "react";
import {
  VUEXY_DEMO_ICONS,
  type VuexyDemoIconName,
} from "./vuexy-demo-icon-paths";

export function VuexyDemoIcon({ name }: { name: VuexyDemoIconName }) {
  const parts = VUEXY_DEMO_ICONS[name] ?? VUEXY_DEMO_ICONS.info;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {parts.map((part, index) =>
        createElement(part[0], { key: index, ...part[1] }),
      )}
    </svg>
  );
}
