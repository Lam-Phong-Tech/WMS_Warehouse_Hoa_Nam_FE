/**
 * motion/ — bộ chuyển động dùng chung.
 *
 * Ba tầng phối hợp với nhau, sửa tầng nào cũng phải ngó hai tầng còn lại:
 *   1. src/styles/hn-motion.css   — hover/focus/press cho antd + vỏ .hn-*
 *   2. src/app/mui-theme.ts       — chuyển động MUI chạy bằng JS
 *   3. thư mục này                — primitive React cho các trường hợp cần
 *                                   giữ phần tử lại lúc biến mất (thêm/xóa dòng)
 */
export {
  AnimatedList,
  AnimatedListItem,
  AnimatedInlineList,
  AnimatedInlineItem,
  type AnimatedListProps,
  type AnimatedListItemProps,
  type AnimatedInlineItemProps,
} from "./AnimatedList";
export { createRowKey } from "./row-key";
export { useReducedMotion } from "./useReducedMotion";
export {
  MOTION_DURATION,
  MOTION_EASING,
  MOTION_ENABLED,
  motionDuration,
} from "./motion-tokens";
