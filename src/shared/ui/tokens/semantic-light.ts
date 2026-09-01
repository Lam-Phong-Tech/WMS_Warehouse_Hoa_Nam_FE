/**
 * SEMANTIC — hợp đồng token ngữ nghĩa của design system.
 *
 * TỪ ĐỢT DARK MODE: mỗi giá trị ở đây là một THAM CHIẾU BIẾN CSS
 * (`var(--wms-…)`) chứ không còn là màu thô. Nhờ vậy mọi `sx`, `styleOverrides`
 * và CSS đang đọc `SEMANTIC_LIGHT` tự đổi màu khi `<html data-theme>` đổi —
 * không phải render lại, không phải sửa hàng trăm chỗ dùng.
 *
 * Tên `SEMANTIC_LIGHT` GIỮ NGUYÊN để 60+ file đang import khỏi phải sửa; đọc
 * nó là "bảng semantic của chế độ ĐANG hiển thị", không phải "chỉ chế độ sáng".
 * Giá trị thô theo từng chế độ nằm ở `palette.ts`.
 *
 * KHI NÀO KHÔNG ĐƯỢC DÙNG FILE NÀY: chỗ cần một màu THẬT vì giá trị không đi
 * qua CSS — palette của MUI, bảng màu ApexCharts, phép trộn màu bằng JS. Những
 * chỗ đó phải đọc `PALETTE` (palette.ts), nếu không sẽ nhận nguyên chuỗi
 * "var(--wms-…)" và vẽ ra màu đen/không màu.
 */
import { PALETTE_KEYS, cssVarNameOf, type PaletteKey } from "./palette";

const cssVarFacade = Object.fromEntries(
  PALETTE_KEYS.map((key) => [key, `var(${cssVarNameOf(key)})`]),
) as Record<PaletteKey, string>;

export const SEMANTIC_LIGHT = cssVarFacade;

export type SemanticTokens = Record<PaletteKey, string>;
