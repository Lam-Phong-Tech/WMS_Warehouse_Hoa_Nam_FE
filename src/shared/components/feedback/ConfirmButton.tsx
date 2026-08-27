import type { ReactNode } from "react";
import { Popconfirm } from "antd";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import {
  ActionButton,
  type ActionButtonProps,
} from "@/shared/components/actions";

export interface ConfirmButtonProps extends Omit<
  ActionButtonProps,
  "onClick" | "title"
> {
  /** Gọi khi người dùng xác nhận. */
  onConfirm: () => void;
  title?: ReactNode;
  description?: ReactNode;
  okText?: string;
  cancelText?: string;
  loading?: boolean;
  children: ReactNode;
  /** aria-label cho nút (accessibility). Nên mô tả rõ hành động + đối tượng, vd "Xoá nhân viên Nguyễn Văn A". */
  "aria-label"?: string;
}

/**
 * Nút kèm hộp xác nhận (dùng cho xoá / hành động nguy hiểm).
 *
 * Nút hiển thị là `<ActionButton />` chuẩn — caller bắt buộc khai `kind`
 * (thường là `"delete"`) để icon và màu khớp với phần còn lại của dự án.
 */
export function ConfirmButton({
  onConfirm,
  title = "Bạn chắc chắn?",
  description,
  okText = "Đồng ý",
  cancelText = "Huỷ",
  loading,
  children,
  ...buttonProps
}: ConfirmButtonProps) {
  return (
    <Popconfirm
      title={<span {...uiStateProps(UI_STATE.CONFIRM)}>{title}</span>}
      description={description}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{ loading }}
      onConfirm={onConfirm}
    >
      <ActionButton {...buttonProps}>{children}</ActionButton>
    </Popconfirm>
  );
}
