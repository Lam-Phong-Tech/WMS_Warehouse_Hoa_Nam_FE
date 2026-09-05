import type { CSSProperties, ReactNode } from "react";

/**
 * Chữ dài trong ô danh sách — cắt bằng CSS, KHÔNG cắt chuỗi trong JS.
 *
 * Cắt bằng JS (`slice(0, 40) + "…"`) làm mất chữ khỏi DOM: Ctrl+F không tìm
 * thấy, trình đọc màn hình đọc thiếu, và độ dài cắt luôn sai ở một bề rộng màn
 * hình nào đó. Cắt bằng CSS giữ nguyên nội dung, chỉ giấu phần tràn — chữ đầy
 * đủ hiện lại ở tooltip `title` khi rê chuột.
 *
 * ĐIỀU KIỆN để "…" chạy: phần tử cha phải BỊ CHẶN BỀ NGANG (ô bảng có
 * `max-width`, hoặc cha flex/grid có `min-width: 0`). Không có trần bề ngang
 * thì ô nở theo nội dung và chẳng bao giờ tràn để mà cắt.
 */
export interface TruncatedTextProps {
  children: ReactNode;
  /** Số dòng tối đa trước khi cắt. Mặc định 2. */
  lines?: number;
  /** Trần bề ngang cho chính khối chữ (khi ô chứa chưa có max-width). */
  maxWidth?: number | string;
  /** Ghi đè tooltip — mặc định lấy chính nội dung khi nó là chữ thuần. */
  title?: string;
  className?: string;
}

export function TruncatedText({
  children,
  lines = 2,
  maxWidth,
  title,
  className,
}: TruncatedTextProps) {
  const isPlainText =
    typeof children === "string" || typeof children === "number";
  const style: CSSProperties = {};
  if (maxWidth !== undefined) style.maxWidth = maxWidth;
  // 1 và 2 dòng đã có sẵn class tiện ích; số dòng khác thì đặt thẳng biến clamp.
  if (lines > 2) style.WebkitLineClamp = lines;

  return (
    <span
      className={[lines === 1 ? "hn-truncate" : "hn-truncate-2", className]
        .filter(Boolean)
        .join(" ")}
      title={title ?? (isPlainText ? String(children) : undefined)}
      style={style}
    >
      {children}
    </span>
  );
}
