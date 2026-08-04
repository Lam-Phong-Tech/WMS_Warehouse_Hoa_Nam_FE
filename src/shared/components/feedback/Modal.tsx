import { Modal as AntModal } from "antd";
import type { ModalProps } from "antd";

export type { ModalProps };

/**
 * Modal chung (wrapper antd Modal) với mặc định tiếng Việt cho nút.
 * Form thêm/sửa nên dùng `FormModal` (đã gói sẵn Form dọc) thay vì Modal trần.
 */
export function Modal({
  okText = "Đồng ý",
  cancelText = "Huỷ",
  ...rest
}: ModalProps) {
  return <AntModal okText={okText} cancelText={cancelText} {...rest} />;
}
