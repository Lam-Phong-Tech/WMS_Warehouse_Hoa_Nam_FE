/**
 * SEMANTIC (dark) — CHƯA CÓ TRONG BASELINE.
 *
 * DEC-UI-BASELINE-01 không phê duyệt dark mode; Mini App (hệ X) cũng chỉ cấu
 * hình selector mà chưa implement token dark. Giữ file này làm chỗ đứng cấu
 * trúc (theo kiến trúc đích của Prompt 2) — khi có Change Request, điền
 * mapping dark tại đây và bật qua adapter, KHÔNG tạo nguồn token thứ hai.
 */
import type { SemanticTokens } from "./semantic-light";

/** null = dark mode chưa thuộc baseline; adapter phải bỏ qua khi null. */
export const SEMANTIC_DARK: SemanticTokens | null = null;
