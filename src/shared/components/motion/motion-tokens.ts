/**
 * Token chuyển động dùng chung cho TOÀN dự án — MIRROR của canonical source
 * `@/shared/ui/tokens` (primitives.MOTION). Giữ path này vì nhiều consumer
 * (mui-adapter, AnimatedList, hn-motion.css đối chiếu) đã trỏ vào đây.
 *
 * hn-motion.css phải cùng giá trị — parity test:
 * src/test/ui-foundation/token-css-parity.test.ts.
 */
import { MOTION } from "@/shared/ui/tokens";

export const MOTION_DURATION = MOTION.duration;
export const MOTION_EASING = MOTION.easing;

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
