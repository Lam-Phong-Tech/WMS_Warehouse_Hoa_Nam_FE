import type { ReactNode } from "react";
import { Button, Popconfirm } from "antd";
import type { ButtonProps } from "antd";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

export interface ConfirmButtonProps extends Omit<
  ButtonProps,
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

/** Nút kèm hộp xác nhận (dùng cho xoá / hành động nguy hiểm). */
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
      <Button {...buttonProps}>{children}</Button>
    </Popconfirm>
  );
}
