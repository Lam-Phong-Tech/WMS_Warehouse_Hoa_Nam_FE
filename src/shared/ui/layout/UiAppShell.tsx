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
import {
  useCallback,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MOTION, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { LAYOUT } from "./layout-tokens";

function clampSidebarWidth(width: number): number {
  return Math.min(
    LAYOUT.sidebarMaxWidth,
    Math.max(LAYOUT.sidebarMinWidth, Math.round(width)),
  );
}

/** Bước thay đổi bề rộng khi dùng phím mũi tên trên tay cầm kéo giãn (a11y). */
const SIDEBAR_KEYBOARD_STEP = 16;

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
   * Bề rộng sidebar khi MỞ RỘNG (px). Bỏ trống = LAYOUT.sidebarWidth mặc định.
   * Truyền cùng `onSidebarWidthChange` để bật tay cầm KÉO GIÃN chiều rộng —
   * dùng khi nhãn menu dài cần đọc trọn.
   */
  sidebarWidth?: number;
  /**
   * Gọi khi người dùng kéo (hoặc dùng phím) đổi bề rộng sidebar. Có handler này
   * (và không collapsed/không ẩn) thì tay cầm kéo giãn hiện ở mép phải sidebar.
   */
  onSidebarWidthChange?: (width: number) => void;
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
  sidebarWidth,
  onSidebarWidthChange,
  className,
  sidebarClassName,
  mainClassName,
}: UiAppShellProps) {
  const [dragging, setDragging] = useState(false);

  const expandedWidth = clampSidebarWidth(sidebarWidth ?? LAYOUT.sidebarWidth);
  const effectiveWidth = collapsed
    ? LAYOUT.sidebarCollapsedWidth
    : expandedWidth;
  const columns = sidebarHidden ? "1fr" : `${effectiveWidth}px 1fr`;
  // Tay cầm kéo giãn chỉ có ý nghĩa khi sidebar đang mở rộng và đang hiển thị.
  const resizable =
    Boolean(onSidebarWidthChange) && !collapsed && !sidebarHidden;

  const startDrag = useCallback(
    (event: ReactPointerEvent) => {
      if (!resizable || !onSidebarWidthChange) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = effectiveWidth;
      setDragging(true);
      // Khoá select-text + ép con trỏ col-resize toàn trang trong lúc kéo để
      // không bôi đen nội dung và con trỏ không nhấp nháy khi ra khỏi tay cầm.
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (moveEvent: PointerEvent) => {
        onSidebarWidthChange(
          clampSidebarWidth(startWidth + (moveEvent.clientX - startX)),
        );
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [resizable, effectiveWidth, onSidebarWidthChange],
  );

  const handleKeyResize = (event: ReactKeyboardEvent) => {
    if (!onSidebarWidthChange) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSidebarWidthChange(
        clampSidebarWidth(effectiveWidth - SIDEBAR_KEYBOARD_STEP),
      );
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onSidebarWidthChange(
        clampSidebarWidth(effectiveWidth + SIDEBAR_KEYBOARD_STEP),
      );
    }
  };

  return (
    <Box
      className={className}
      sx={{
        position: "relative",
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
        // Khi đang kéo, tắt transition để cột bám sát con trỏ (không giật/lag).
        transition: dragging
          ? "none"
          : `grid-template-columns ${MOTION.duration.normal}ms ${MOTION.easing.standard}`,
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

      {/* Tay cầm KÉO GIÃN — đặt tuyệt đối tại đường biên phải của sidebar để
          không cuộn theo nội dung aside (aside có overflowY:auto). */}
      {resizable ? (
        <Box
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để đổi bề rộng thanh điều hướng"
          aria-valuenow={effectiveWidth}
          aria-valuemin={LAYOUT.sidebarMinWidth}
          aria-valuemax={LAYOUT.sidebarMaxWidth}
          tabIndex={0}
          data-testid="sidebar-resize-handle"
          onPointerDown={startDrag}
          onKeyDown={handleKeyResize}
          onDoubleClick={() => onSidebarWidthChange?.(LAYOUT.sidebarWidth)}
          title="Kéo để đổi bề rộng · bấm đúp để về mặc định"
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${effectiveWidth}px`,
            width: 10,
            transform: "translateX(-50%)",
            cursor: "col-resize",
            zIndex: 5,
            display: "flex",
            justifyContent: "center",
            touchAction: "none",
            // Vạch chỉ báo mảnh ở giữa, đậm lên khi hover/kéo/focus.
            "&::after": {
              content: '""',
              width: 2,
              height: "100%",
              backgroundColor: dragging ? S.primary : "transparent",
              transition: `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
            },
            "&:hover::after": { backgroundColor: S.primary },
            "&:focus-visible": { outline: "none" },
            "&:focus-visible::after": { backgroundColor: S.primary, width: 3 },
          }}
        />
      ) : null}

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
