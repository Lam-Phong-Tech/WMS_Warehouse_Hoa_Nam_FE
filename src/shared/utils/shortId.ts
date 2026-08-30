/**
 * Rút gọn ID kỹ thuật (UUID nội bộ...) kiểu `abcdef…567890` để dùng ở những nơi
 * CHỈ nhận text thuần (tiêu đề dialog, chuỗi template) — không được lộ chuỗi
 * thô đầy đủ. Nơi có thể render component, dùng `CopyableId` thay vì hàm này
 * (kèm nút sao chép giá trị đầy đủ).
 */
export function shortId(
  value: string | null | undefined,
  visibleChars = 6,
): string {
  if (!value) return "";
  if (value.length <= visibleChars * 2 + 1) return value;
  return `${value.slice(0, visibleChars)}…${value.slice(-visibleChars)}`;
}
