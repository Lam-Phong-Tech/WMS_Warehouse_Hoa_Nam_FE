import type { ReactNode } from "react";
import { Button } from "antd";
import type { ButtonProps } from "antd";
import { SaveOutlined } from "@ant-design/icons";

export interface SubmitButtonProps extends Omit<ButtonProps, "htmlType"> {
  children?: ReactNode;
}

/** Nút gửi form (type primary, htmlType submit) — nhãn mặc định "Lưu". */
export function SubmitButton({
  children = "Lưu",
  type = "primary",
  ...rest
}: SubmitButtonProps) {
  return (
    <Button type={type} htmlType="submit" icon={<SaveOutlined />} {...rest}>
      {children}
    </Button>
  );
}
