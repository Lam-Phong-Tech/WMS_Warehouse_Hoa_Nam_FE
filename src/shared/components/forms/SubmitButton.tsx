import type { ReactNode } from "react";
import { Button } from "antd";
import type { ButtonProps } from "antd";
import { SaveOutlined } from "@/shared/components/icons";
import { UI_STATE, uiStateTestId } from "@/shared/constants/ui-state";

export interface SubmitButtonProps extends Omit<ButtonProps, "htmlType"> {
  children?: ReactNode;
}

/** Nút gửi form (type primary, htmlType submit) — nhãn mặc định "Lưu". */
export function SubmitButton({
  children = "Lưu",
  type = "primary",
  ...rest
}: SubmitButtonProps) {
  // WWHN-268: nút bị chặn (disabled hoặc đang gửi) phải nhận diện được bằng
  // selector ổn định để QA2 chụp bằng chứng trạng thái "disabled".
  const blocked = Boolean(rest.disabled) || Boolean(rest.loading);
  return (
    <Button
      type={type}
      htmlType="submit"
      icon={<SaveOutlined />}
      data-ui-state={blocked ? UI_STATE.DISABLED : undefined}
      data-testid={blocked ? uiStateTestId(UI_STATE.DISABLED) : undefined}
      {...rest}
    >
      {children}
    </Button>
  );
}
