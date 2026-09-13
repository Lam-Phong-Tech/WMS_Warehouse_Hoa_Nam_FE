/**
 * AuthField — ô nhập cho các màn auth, dùng NHÃN TĨNH trên ô + placeholder
 * (pattern login-v2 của Vuexy). Chỉ là lớp mỏng đặt sẵn `labelPlacement="above"`
 * trên `UiFormText` canonical — KHÔNG import UI engine trực tiếp, không tạo ô
 * nhập song song; toàn bộ hành vi (password toggle, validation, IME) kế thừa
 * từ UiFormText.
 */
import type { FieldValues } from "react-hook-form";
import { UiFormText, type UiFormTextProps } from "@/shared/ui";

export type AuthFieldProps<T extends FieldValues> = Omit<
  UiFormTextProps<T>,
  "labelPlacement" | "multiline" | "rows" | "type"
> & {
  /** Biểu tượng ở đầu ô nhập của các màn AUTH. */
  startIcon?: string;
  /** Vuexy auth field chỉ dùng text/password — không multiline. */
  type?: "text" | "password";
};

export function AuthField<T extends FieldValues>(props: AuthFieldProps<T>) {
  return <UiFormText {...props} labelPlacement="above" />;
}
