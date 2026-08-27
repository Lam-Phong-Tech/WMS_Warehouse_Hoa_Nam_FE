let fallbackCounter = 0;

/**
 * Sinh khóa ổn định cho một dòng trong danh sách thêm/xóa được.
 *
 * Vì sao cần: React nhận biết "dòng nào vừa thêm / dòng nào vừa mất" hoàn toàn
 * qua `key`. Dùng chỉ số mảng thì xóa dòng giữa sẽ bị hiểu là "các dòng sau đổi
 * nội dung", kéo theo hai hậu quả: hiệu ứng thu gọn không chạy được (không có
 * dòng nào bị coi là biến mất), và mọi ô nhập phía sau bị dựng lại — mất focus,
 * mất giá trị đang gõ dở, chớp trắng. Đó chính là cảm giác "giật" khi thao tác.
 *
 * Khóa chỉ sống trong phiên làm việc của form, không gửi lên API.
 */
export function createRowKey(prefix = "row"): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${(fallbackCounter += 1)}`;
  return `${prefix}-${random}`;
}
