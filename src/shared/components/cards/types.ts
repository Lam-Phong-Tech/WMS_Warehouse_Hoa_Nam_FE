import type { ReactNode } from 'react';

/**
 * Props chung cho hầu hết các shared component.
 * Giúp đảm bảo API nhất quán.
 */
export interface CommonProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Props chung cho các component field trong form.
 * Kế thừa từ CommonProps và thêm các thuộc tính đặc thù cho input.
 */
export interface FieldProps extends CommonProps {
  size?: 'small' | 'middle' | 'large';
  variant?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean | string;
  helperText?: string;
  required?: boolean;
  onChange?: (value: unknown) => void;
}
