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
  /**
   * Ẩn hẳn cột sidebar (mobile/tablet <lg): grid còn 1 cột, sidebar do caller
   * render trong Drawer overlay + nút hamburger ở topbar.
   */
  sidebarHidden?: boolean;
  /** Class marker cho vỏ ngoài (test-hook legacy `.hn-mvp-app` — không style). */
  className?: string;
  /** Class marker cho aside (test-hook legacy `.hn-mvp-aside`). */
  sidebarClassName?: string;
  /** Class marker cho main (test-hook legacy `.hn-mvp-main`). */
  mainClassName?: string;
}

export function UiAppShell({
  sidebar,
  topbar,
  children,
  footer,
  collapsed = false,
  sidebarHidden = false,
  className,
  sidebarClassName,
  mainClassName,
}: UiAppShellProps) {
  const sidebarWidth = collapsed
    ? LAYOUT.sidebarCollapsedWidth
    : LAYOUT.sidebarWidth;
  const columns = sidebarHidden ? "1fr" : `${sidebarWidth}px 1fr`;

  return (
    <Box
      className={className}
      sx={{
        display: "grid",
        gridTemplateColumns: columns,
        // Chốt chiều cao viewport để main tự cuộn, sidebar đứng yên.
        height: "100dvh",
        minHeight: "100dvh",
        // Không có overflow:hidden, hàng grid ẩn (auto) sẽ giãn theo chiều cao
        // NỘI DUNG của main thay vì bị chốt ở 100dvh ("grid blowout") — lúc đó
        // main mất vùng cuộn riêng và cả document cuộn theo, kéo sidebar/topbar
        // trôi cùng. overflow:hidden ở đây buộc con phải tự cuộn bên trong.
        overflow: "hidden",
        backgroundColor: S.bgCanvas,
        transition: `grid-template-columns ${MOTION.duration.normal}ms ${MOTION.easing.standard}`,
      }}
    >
      {/* Cột sidebar — nền surface SÁNG theo baseline Vuexy */}
      {sidebarHidden ? null : (
        <Box
          component="aside"
          className={sidebarClassName}
          data-testid="app-sidebar"
          sx={{
            backgroundColor: S.bgSurface,
            borderRight: `1px solid ${S.border}`,
            overflowY: "auto",
            overflowX: "hidden",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {sidebar}
        </Box>
      )}

      {/* Phần còn lại: topbar sticky + main cuộn + footer */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {topbar}
        <Box
          component="main"
          className={mainClassName}
          sx={{ flex: 1, overflow: "auto", minHeight: 0 }}
        >
          {children}
        </Box>
        {footer ?? null}
      </Box>
    </Box>
  );
}
