/**
 * UiNumberField — ô nhập SỐ cho form điều khiển bằng state chuỗi (không RHF).
 *
 * Vì sao không dùng `<UiTextField type="number">`: ô number của trình duyệt
 * chỉ hạn chế ký tự một cách lỏng lẻo — vẫn nhận "e", "+", "-" và chuỗi dài
 * tuỳ ý; thuộc tính `min`/`max` chỉ có tác dụng khi submit qua form HTML, mà
 * mọi dialog của dự án đều `noValidate` hoặc lưu bằng onClick. Kết quả là
 * "10000000000000" hay "-5" đi thẳng lên API (phản hồi 05/09/2026).
 *
 * Ô này giữ CHUỖI người dùng gõ (nên "1." hay "-" không bị giật), lọc ký tự
 * theo `rule` ngay khi gõ (không âm nếu sàn ≥ 0, không thập phân nếu nguyên,
 * không dài quá trần), còn kiểm tra cuối cùng vẫn là `checkNumber(value, rule)`
 * ở hàm validate của màn — cùng một `rule`, không lệch nhau.
 */
import TextField from "@mui/material/TextField";
import type { TextFieldProps } from "@mui/material/TextField";
import {
  numberInputMode,
  sanitizeNumberTyping,
  type NumberRule,
} from "@/shared/validation/number-rules";

export interface UiNumberFieldProps extends Omit<
  TextFieldProps,
  "value" | "onChange" | "type" | "inputMode"
> {
  /** Chuỗi đang nhập — màn hình giữ state và validate bằng `checkNumber`. */
  value: string;
  onChange: (next: string) => void;
  /** Luật số — dùng CÙNG object với `checkNumber` lúc submit. */
  rule: NumberRule;
}

export function UiNumberField({
  value,
  onChange,
  rule,
  slotProps,
  ...rest
}: UiNumberFieldProps) {
  const htmlInputProps =
    slotProps && "htmlInput" in slotProps && slotProps.htmlInput
      ? (slotProps.htmlInput as Record<string, unknown>)
      : {};
  return (
    <TextField
      size="small"
      {...rest}
      type="text"
      value={value}
      onChange={(event) =>
        onChange(sanitizeNumberTyping(event.target.value, rule))
      }
      autoComplete="off"
      slotProps={{
        ...slotProps,
        htmlInput: {
          inputMode: numberInputMode(rule),
          ...htmlInputProps,
        },
      }}
    />
  );
}
