/**
 * UiAppShell — khung shell canonical Vuexy (Part 3, PRESENTATIONAL ONLY).
 *
 * Grid 2 cột: sidebar cố định bên trái (bề rộng theo LAYOUT, đổi khi
 * `collapsed`), phần còn lại xếp dọc topbar → main (overflow auto) → footer.
 * Nền canvas qua token bgCanvas; sidebar nền surface trắng theo
 * baseline DEC-UI-BASELINE-01. KHÔNG nối vào MainLayout/router ở Part 3 —
 * việc thay shell thật thuộc Part 4.
 */
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { MOTION, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { LAYOUT } from "./layout-tokens";

export interface UiAppShellProps {
  /** Nội dung cột sidebar (thường là UiSidebarNav). */
  sidebar: ReactNode;
  /** Thanh trên cùng của vùng nội dung (thường là UiTopbar). */
  topbar: ReactNode;
  /** Nội dung chính của trang. */
  children: ReactNode;
  /** Footer tuỳ chọn dưới vùng nội dung (thường là UiFooter). */
  footer?: ReactNode;
  /** Thu gọn sidebar → cột trái đổi sang bề rộng collapsed. */
  collapsed?: boolean;
}

export function UiAppShell({
  sidebar,
  topbar,
  children,
  footer,
  collapsed = false,
}: UiAppShellProps) {
  const sidebarWidth = collapsed
    ? LAYOUT.sidebarCollapsedWidth
    : LAYOUT.sidebarWidth;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        // Chốt chiều cao viewport để main tự cuộn, sidebar đứng yên.
        height: "100dvh",
        minHeight: "100dvh",
        backgroundColor: S.bgCanvas,
        transition: `grid-template-columns ${MOTION.duration.normal}ms ${MOTION.easing.standard}`,
      }}
    >
      {/* Cột sidebar — nền surface SÁNG theo baseline Vuexy */}
      <Box
        component="aside"
        sx={{
          backgroundColor: S.bgSurface,
          borderRight: `1px solid ${S.border}`,
          overflowY: "auto",
          overflowX: "hidden",
          minWidth: 0,
        }}
      >
        {sidebar}
      </Box>

      {/* Phần còn lại: topbar sticky + main cuộn + footer */}
      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {topbar}
        <Box component="main" sx={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {children}
        </Box>
        {footer ?? null}
      </Box>
    </Box>
  );
}
