/**
 * Dịch lỗi mở camera (DOMException của trình duyệt — message tiếng Anh kỹ
 * thuật như "Permission denied", "Requested device not found") thành câu
 * tiếng Việt nêu rõ nguyên nhân + cách xử lý cho người vận hành kho.
 *
 * Dùng chung cho mọi màn quét bằng camera (CameraScanModal, Inbound...).
 */
export function getCameraErrorMessage(error: unknown): string {
  const name =
    error instanceof DOMException
      ? error.name
      : error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Trình duyệt đang chặn quyền dùng camera. Bấm vào biểu tượng ổ khóa cạnh thanh địa chỉ, cho phép Camera rồi thử lại; hoặc nhập mã thủ công.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Không tìm thấy camera trên thiết bị này. Kiểm tra camera đã cắm/bật chưa, hoặc nhập mã thủ công.";
    case "NotReadableError":
    case "AbortError":
      return "Camera đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại, hoặc nhập mã thủ công.";
    default:
      return "Không mở được camera. Kiểm tra quyền camera của trình duyệt rồi thử lại, hoặc nhập mã thủ công.";
  }
}
