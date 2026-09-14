/**
 * UiAppShell — khung shell canonical Vuexy (PRESENTATIONAL ONLY).
 *
 * Grid 2 cột: sidebar cố định bên trái (bề rộng theo LAYOUT, đổi khi
 * `collapsed`), phần còn lại xếp dọc topbar → main (overflow auto) → footer.
 * Nền canvas qua token bgCanvas; sidebar nền surface trắng theo baseline
 * DEC-UI-BASELINE-01.
 *
 * KHÔNG có tay cầm kéo giãn bề rộng (gỡ theo yêu cầu người dùng 2026-08-31):
 * bề rộng cố định ở LAYOUT.sidebarWidth (340px — lệch demo 260px, nới ra để
 * hết ellipsis ở nhãn mục con dài, xem layout-tokens.ts).
 */
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  useRef,
  type ReactNode,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
} from "react";
import {
  COMPONENT_TOKENS,
  SEMANTIC_LIGHT as S,
  Z_INDEX,
} from "@/shared/ui/tokens";
import { LAYOUT } from "./layout-tokens";

const NAV = COMPONENT_TOKENS.nav;

/**
 * Rail chỉ "he mở" khi có CHUỘT THẬT (demo Vuexy dùng đúng media query này) —
 * trên cảm ứng thì rê tay không phải ý định mở menu.
 */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

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
  /** Biến thể trình bày có thể dùng bề rộng sidebar khác, không sửa token toàn app. */
  sidebarWidth?: number;
  /** Bề rộng rail ứng với `sidebarWidth` của biến thể trình bày. */
  sidebarCollapsedWidth?: number;
  /**
   * Ẩn hẳn cột sidebar (mobile/tablet <lg): grid còn 1 cột, sidebar do caller
   * render trong Drawer overlay + nút hamburger ở topbar.
   */
  sidebarHidden?: boolean;
  /**
   * PEEK (he mở) — đang thu gọn mà rê chuột/đưa focus vào rail thì sidebar
   * bung tạm ở dạng LỚP PHỦ: cột lưới vẫn giữ 76px nên nội dung KHÔNG bị xô
   * ngang, chỉ có bóng đổ đậm lên (đúng demo Vuexy đã chốt).
   */
  peek?: boolean;
  /**
   * Báo cho caller bật/tắt peek. Có handler này (và đang collapsed) thì shell
   * tự gắn hover/focus lên chính cột sidebar.
   */
  onPeekChange?: (peek: boolean) => void;
  /** Class marker cho vỏ ngoài (test-hook legacy `.hn-mvp-app` — không style). */
  className?: string;
  /** Inline CSS variables/style dành cho skin scoped của một màn cụ thể. */
  style?: CSSProperties;
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
  sidebarWidth = LAYOUT.sidebarWidth,
  sidebarCollapsedWidth = LAYOUT.sidebarCollapsedWidth,
  sidebarHidden = false,
  peek = false,
  onPeekChange,
  className,
  style,
  sidebarClassName,
  mainClassName,
}: UiAppShellProps) {
  const asideRef = useRef<HTMLElement | null>(null);
  const finePointer = useMediaQuery(FINE_POINTER_QUERY);

  const peeking = collapsed && peek && !sidebarHidden;

  // BỀ RỘNG DẢI GIỮ CHỖ cho sidebar — quyết định lề trái của NỘI DUNG. Lúc
  // peek vẫn giữ 76px để nội dung KHÔNG xô ngang (sidebar nở ra bằng lớp phủ).
  const trackWidth = collapsed ? sidebarCollapsedWidth : sidebarWidth;

  // BỀ RỘNG SIDEBAR (lớp phủ) — nở 260px khi mở rộng HOẶC đang peek, còn lại
  // 76px. Cả hai đều là px nên `width` nội suy MƯỢT (76↔260); mấu chốt để hết
  // giật: aside LUÔN position:absolute (không đổi relative↔absolute giữa
  // chừng) — trước đây đổi position + đổi 100%↔260px cùng lúc khiến trình
  // duyệt không nội suy được, sidebar "nhảy phát sang phải" rồi mới co lại.
  const asideWidth =
    !collapsed || peeking ? sidebarWidth : sidebarCollapsedWidth;

  const enterPeek = () => {
    if (!collapsed || sidebarHidden || peek) return;
    onPeekChange?.(true);
  };

  /**
   * Rời chuột khỏi rail thì đóng peek — TRỪ khi con trỏ bàn phím vẫn còn ở
   * trong sidebar (demo: `sidebar.contains(document.activeElement)`), nếu
   * không người dùng đang tab trong menu sẽ bị sập menu ngay dưới tay.
   */
  const leavePeek = () => {
    if (!peek) return;
    if (asideRef.current?.contains(document.activeElement)) return;
    onPeekChange?.(false);
  };

  const handleSidebarBlur = (event: ReactFocusEvent<HTMLElement>) => {
    if (!peek) return;
    const next = event.relatedTarget as Node | null;
    if (next && asideRef.current?.contains(next)) return;
    onPeekChange?.(false);
  };

  return (
    <Box
      className={className}
      style={style}
      sx={{
        // KHÔNG dùng CSS Grid: phần tử position:absolute nằm trong grid bị
        // giới hạn containing-block vào Ô LƯỚI của nó (cột 76px) nên `width`
        // của sidebar bị kẹp, không nở ra 260px được — hiệu ứng peek chết.
        // Dùng block position:relative làm mốc: aside (absolute) lấy trọn bề
        // ngang shell làm containing-block, còn nội dung né sidebar bằng
        // margin-left = trackWidth. Cả hai cùng animate 76↔260 nên mượt.
        position: "relative",
        // Chốt chiều cao viewport để main tự cuộn, sidebar đứng yên.
        height: "100dvh",
        minHeight: "100dvh",
        overflow: "hidden",
        backgroundColor: S.bgCanvas,
      }}
    >
      {/* Sidebar — LỚP PHỦ tuyệt đối, nở/thu bằng width (px ⇒ nội suy mượt) */}
      {sidebarHidden ? null : (
        <Box
          component="aside"
          ref={asideRef}
          className={sidebarClassName}
          data-testid="app-sidebar"
          data-peeking={peeking ? "true" : undefined}
          onMouseEnter={finePointer && onPeekChange ? enterPeek : undefined}
          onMouseLeave={finePointer && onPeekChange ? leavePeek : undefined}
          onFocus={onPeekChange ? enterPeek : undefined}
          onBlur={onPeekChange ? handleSidebarBlur : undefined}
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${asideWidth}px`,
            zIndex: Z_INDEX.sidebar,
            backgroundColor: S.bgSurface,
            borderRight: `1px solid ${NAV.color.border}`,
            boxShadow: peeking
              ? NAV.shadow.sidebarPeek
              : collapsed
                ? NAV.shadow.sidebarCollapsed
                : NAV.shadow.sidebar,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
            transition: `width ${NAV.motion.width}ms ${NAV.motion.easing}, box-shadow ${NAV.motion.width}ms ${NAV.motion.easing}`,
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          {sidebar}
        </Box>
      )}

      {/* Nội dung: topbar sticky + main cuộn + footer. Né sidebar bằng
          margin-left = trackWidth; lúc peek trackWidth vẫn 76 nên nội dung
          ĐỨNG YÊN, sidebar phủ lên trên. */}
      <Box
        sx={{
          height: "100%",
          marginLeft: sidebarHidden ? 0 : `${trackWidth}px`,
          transition: `margin-left ${NAV.motion.width}ms ${NAV.motion.easing}`,
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
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
