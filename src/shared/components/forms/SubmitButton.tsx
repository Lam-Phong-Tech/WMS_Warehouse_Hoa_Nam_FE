import type { ReactNode } from "react";
import { UI_STATE, uiStateTestId } from "@/shared/constants/ui-state";
import {
  ActionButton,
  type ActionButtonProps,
} from "@/shared/components/actions";

export interface SubmitButtonProps extends Omit<
  ActionButtonProps,
  "kind" | "type"
> {
  children?: ReactNode;
}

/** Nút gửi form (`type="submit"`) — nhãn mặc định "Lưu", icon/màu theo chuẩn. */
export function SubmitButton({ children = "Lưu", ...rest }: SubmitButtonProps) {
  // WWHN-268: nút bị chặn (disabled hoặc đang gửi) phải nhận diện được bằng
  // selector ổn định để QA2 chụp bằng chứng trạng thái "disabled".
  const blocked = Boolean(rest.disabled) || Boolean(rest.loading);
  return (
    <ActionButton
      kind="save"
      data-ui-state={blocked ? UI_STATE.DISABLED : undefined}
      data-testid={blocked ? uiStateTestId(UI_STATE.DISABLED) : undefined}
      {...rest}
      type="submit"
    >
      {children}
    </ActionButton>
  );
}
