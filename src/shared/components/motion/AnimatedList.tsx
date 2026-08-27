import type { CSSProperties, ReactNode } from "react";
import { Collapse } from "@mui/material";
import { TransitionGroup } from "react-transition-group";
import { MOTION_DURATION, MOTION_ENABLED } from "./motion-tokens";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Danh sách dòng thêm/xóa được có hiệu ứng trượt-mở và trượt-đóng.
 *
 * Dùng cho mọi chỗ người dùng bấm "Thêm dòng ..." / "Xóa dòng" (dòng SKU ở
 * phiếu xuất, dòng linh kiện ở phiếu nhập & bảo hành...). Trước đây dòng
 * xuất hiện/biến mất tức thì làm cả khối bên dưới nhảy một nhịp — đó chính
 * là cảm giác "giật".
 *
 * CÁCH DÙNG
 * ```tsx
 * <AnimatedList>
 *   {lines.map((line) => (
 *     <AnimatedListItem key={line.key}>   // key PHẢI ổn định, KHÔNG dùng index
 *       ...nội dung 1 dòng...
 *     </AnimatedListItem>
 *   ))}
 * </AnimatedList>
 * ```
 *
 * LƯU Ý QUAN TRỌNG VỀ `key`
 * Hiệu ứng ra/vào dựa hoàn toàn vào `key`. Nếu dùng `key={index}` thì khi xóa
 * dòng giữa, React coi như các dòng sau "đổi nội dung" chứ không phải "bị
 * xóa" — vừa mất hiệu ứng, vừa buộc tất cả ô nhập phía sau dựng lại từ đầu
 * (mất focus, chớp trắng). Luôn cấp id ổn định cho từng dòng.
 *
 * KHOẢNG CÁCH GIỮA CÁC DÒNG
 * Không đặt `gap`/`spacing` ở container: khi một dòng co về 0 thì phần gap
 * vẫn còn nguyên rồi biến mất đột ngột ở cuối. Khoảng cách được đặt bên
 * TRONG mỗi item (`gap` của AnimatedListItem) để nó co lại cùng chiều cao.
 */

export interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Gắn cho E2E/test khi cần chọn đúng khối danh sách. */
  "data-testid"?: string;
}

export function AnimatedList({
  children,
  className,
  style,
  "data-testid": dataTestId,
}: AnimatedListProps) {
  const reduced = useReducedMotion();
  const rootClassName = ["hn-animated-list", className]
    .filter(Boolean)
    .join(" ");

  // Test/giảm-chuyển-động: render thẳng, DOM đổi đồng bộ như trước khi có
  // lớp motion (xem ghi chú ở MOTION_ENABLED).
  if (!MOTION_ENABLED || reduced) {
    return (
      <div className={rootClassName} style={style} data-testid={dataTestId}>
        {children}
      </div>
    );
  }

  return (
    <TransitionGroup
      className={rootClassName}
      style={style}
      data-testid={dataTestId}
    >
      {children}
    </TransitionGroup>
  );
}

export interface AnimatedListItemProps {
  children: ReactNode;
  /** Khoảng cách xuống dòng kế tiếp (px). Đặt trong item để co giãn cùng dòng. */
  gap?: number;
  className?: string;
  /**
   * Các prop dưới đây do TransitionGroup tự truyền vào — không tự khai báo khi
   * gọi. Khai ở đây để TypeScript chấp nhận việc TransitionGroup clone element.
   */
  in?: boolean;
  onExited?: (node: HTMLElement) => void;
  appear?: boolean;
  enter?: boolean;
  exit?: boolean;
}

export function AnimatedListItem({
  children,
  gap = 12,
  className,
  ...transitionProps
}: AnimatedListItemProps) {
  const reduced = useReducedMotion();

  if (!MOTION_ENABLED || reduced) {
    return (
      <div className={className} style={{ marginBottom: gap }}>
        {children}
      </div>
    );
  }

  return (
    <Collapse
      {...transitionProps}
      className={["hn-animated-row", className].filter(Boolean).join(" ")}
      timeout={{
        enter: MOTION_DURATION.slow,
        exit: MOTION_DURATION.normal,
      }}
    >
      <div style={{ paddingBottom: gap }}>{children}</div>
    </Collapse>
  );
}
