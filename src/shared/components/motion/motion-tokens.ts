/**
 * Token chuyển động dùng chung cho TOÀN dự án.
 *
 * Đây là bản TypeScript của các biến CSS trong src/styles/hn-motion.css —
 * hai nơi PHẢI cùng giá trị để hiệu ứng của MUI (chạy bằng JS: Dialog, Menu,
 * Collapse, Fade...) khớp nhịp với hiệu ứng của CSS/antd. Sửa ở đây thì sửa
 * luôn hn-motion.css và ngược lại.
 */

export const MOTION_DURATION = {
  /** Đổi màu chữ/icon — gần như tức thì nhưng không "cứng". */
  instant: 90,
  /** Hover/focus của control nhỏ. */
  fast: 140,
  /** Mặc định cho đa số chuyển động. */
  normal: 200,
  /** Modal/drawer/khối lớn xuất hiện. */
  slow: 280,
} as const;

export const MOTION_EASING = {
  /** Standard — dùng cho phần lớn trường hợp (đối xứng vào/ra). */
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Xuất hiện: bung nhanh rồi hãm lại — cảm giác "đáp xuống" mượt. */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Biến mất: rời đi dứt khoát. */
  in: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/**
 * Chuyển động có được bật hay không.
 *
 * Tắt trong môi trường test (vitest chạy MODE="test"): hiệu ứng vào/ra làm
 * phần tử nán lại trong DOM thêm vài trăm ms, khiến các assert kiểu
 * `expect(row).not.toBeInTheDocument()` ngay sau click bị đỏ oan. Ở test,
 * các primitive bên dưới render thẳng children — DOM thay đổi đồng bộ đúng
 * như trước khi có lớp motion, nên bộ test hiện có không phải sửa.
 *
 * Người dùng bật "giảm chuyển động" ở OS/trình duyệt được xử lý bằng
 * `@media (prefers-reduced-motion: reduce)` trong hn-motion.css và bằng
 * `useReducedMotion()` bên dưới cho phần chạy bằng JS.
 */
export const MOTION_ENABLED: boolean = import.meta.env?.MODE !== "test";

/** Thời lượng thực tế truyền cho component MUI (0 khi tắt chuyển động). */
export function motionDuration(ms: number): number {
  return MOTION_ENABLED ? ms : 0;
}
