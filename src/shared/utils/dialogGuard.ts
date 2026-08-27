export type MuiDialogCloseReason = "backdropClick" | "escapeKeyDown";

/**
 * Bọc onClose của MUI Dialog. Trước đây helper này chặn đóng khi bấm ra ngoài
 * (backdrop) để tránh mất dữ liệu đang nhập, nhưng theo yêu cầu sản phẩm hiện tại,
 * bấm ra ngoài PHẢI đóng được modal ở mọi nơi — nên helper chỉ còn giữ vai trò
 * chuẩn hoá chữ ký onClose, không còn chặn theo `reason` nữa.
 */
export function guardBackdropClose(onClose: () => void) {
  return (_event: unknown, _reason: MuiDialogCloseReason) => {
    onClose();
  };
}
