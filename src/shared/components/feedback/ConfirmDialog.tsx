import type { ReactNode } from "react";
import { Modal } from "antd";

export interface ConfirmDialogOptions {
  title: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  /** Tô đỏ nút đồng ý (hành động nguy hiểm). */
  danger?: boolean;
  onOk: () => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Hộp xác nhận gọi theo lệnh (imperative) — dùng khi không tiện bọc UI.
 * Với nút inline (vd xoá trong bảng) ưu tiên `ConfirmButton`.
 *
 *   confirmDialog({ title: 'Xoá mục này?', danger: true, onOk: () => remove(id) });
 */
export function confirmDialog({
  title,
  content,
  okText = "Đồng ý",
  cancelText = "Huỷ",
  danger = false,
  onOk,
  onCancel,
}: ConfirmDialogOptions) {
  Modal.confirm({
    title,
    content,
    okText,
    cancelText,
    okButtonProps: danger ? { danger: true } : undefined,
    onOk,
    onCancel,
  });
}
