/**
 * SEMANTIC (dark) — bảng semantic của chế độ tối, dạng GIÁ TRỊ THÔ.
 *
 * Từ đợt bật dark mode toàn app, đây không còn là chỗ đứng rỗng nữa: nó là
 * `PALETTE.dark` được phơi ra dưới đúng tên cũ, dùng bởi adapter antd/MUI và
 * bởi test parity với `css-vars-dark.css`.
 *
 * Component KHÔNG đọc file này — component đọc `SEMANTIC_LIGHT` (mặt tiền
 * `var(--wms-…)`) và tự đổi theo `<html data-theme>`.
 */
import { PALETTE, type PaletteKey } from "./palette";

export const SEMANTIC_DARK: Record<PaletteKey, string> = PALETTE.dark;
