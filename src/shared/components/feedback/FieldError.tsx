import type { CommonProps } from "../cards/types";

export interface FieldErrorProps extends CommonProps {
  /** Thông điệp lỗi của field; falsy → không render. */
  message?: string | null;
}

/** Dòng lỗi nhỏ hiển thị dưới một input (dùng ngoài Form.Item của antd). */
export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={className}
      style={{ color: "#ff4d4f", fontSize: 12, marginTop: 4 }}
    >
      {message}
    </div>
  );
}
