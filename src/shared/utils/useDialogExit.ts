import { useCallback, useState } from "react";
import { MOTION_ENABLED } from "@/shared/components/motion/motion-tokens";
import { guardBackdropClose } from "./dialogGuard";

/**
 * Giữ hiệu ứng ĐÓNG cho những modal mà component cha render có điều kiện
 * (`{isOpen && <XxxModal onClose={...} />}`) và bên trong viết `<Dialog open>`.
 *
 * Với cách viết đó, gọi thẳng `onClose` của cha sẽ unmount modal NGAY LẬP TỨC:
 * MUI không còn cơ hội chạy transition, modal biến mất "phựt" — đúng cảm giác
 * cứng mà người dùng phàn nàn, và bấm ra ngoài cũng bị y hệt.
 *
 * Hook đảo lại thứ tự: hạ `open` xuống false trước để Grow chạy hết hiệu ứng
 * thoát, chạy xong (`onExited`) mới báo cho cha unmount.
 *
 *   const dialog = useDialogExit(onClose);
 *   <Dialog {...dialog.dialogProps} maxWidth="sm" fullWidth>
 *     <IconButton onClick={dialog.close}>   // nút X / Hủy dùng dialog.close
 *
 * MỌI lời gọi đóng trong modal (nút X, nút Hủy, đóng sau khi lưu thành công)
 * phải chuyển sang `dialog.close` — chỗ nào còn gọi thẳng `onClose` thì chỗ đó
 * vẫn đóng cứng như cũ.
 *
 * Ở môi trường test (MOTION_ENABLED = false) `close` gọi thẳng `onClose` như
 * trước khi có hook, nên bộ test hiện có không phải sửa và không bị chậm thêm.
 */
export function useDialogExit(onClose: () => void) {
  const [open, setOpen] = useState(true);

  const close = useCallback(() => {
    if (!MOTION_ENABLED) {
      onClose();
      return;
    }
    setOpen(false);
  }, [onClose]);

  return {
    /**
     * State mở nội bộ. Chỉ cần đến khi modal còn nhận thêm prop `open` từ cha:
     * `open={openProp && dialog.open}`. Bình thường cứ spread `dialogProps`.
     */
    open,
    /** Gọi thay cho `onClose` ở mọi nút/luồng đóng bên trong modal. */
    close,
    /** Spread vào <Dialog>: đã gồm open, onClose (bấm ra ngoài + Esc) và onExited. */
    dialogProps: {
      open,
      onClose: guardBackdropClose(close),
      slotProps: { transition: { onExited: onClose } },
    },
  };
}
