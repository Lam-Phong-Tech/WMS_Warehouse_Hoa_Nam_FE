import { Alert as AntAlert } from 'antd';
import type { AlertProps } from 'antd';

export type { AlertProps };

/**
 * Alert chung (wrapper antd Alert, mặc định hiện icon).
 * Lỗi theo contract API nên dùng `ApiErrorAlert` (tự bóc message + field errors).
 */
export function Alert({ showIcon = true, ...rest }: AlertProps) {
  return <AntAlert showIcon={showIcon} {...rest} />;
}
