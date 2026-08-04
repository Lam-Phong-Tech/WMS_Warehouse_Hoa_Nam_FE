import { Tag } from "antd";
import type { TagProps } from "antd";

export interface StatusTagProps extends Omit<TagProps, "color" | "children"> {
  /** Giá trị trạng thái: số (employee status), boolean (active/inactive), hoặc string tuỳ ý. */
  status: string | number | boolean;
  /** Map value → màu Tag antd (preset hoặc hex). */
  colorMap?: Record<string | number, string>;
  /** Map value → nhãn hiển thị. */
  labelMap?: Record<string | number, string>;
}

const DEFAULT_BOOL_COLOR: Record<string, string> = {
  true: "success",
  false: "default",
};

const DEFAULT_BOOL_LABEL: Record<string, string> = {
  true: "Hoạt động",
  false: "Ngừng hoạt động",
};

/**
 * Tag trạng thái linh hoạt — thay thế cho StatusBadge khi cần hiển thị enum
 * nhiều giá trị (không chỉ active/inactive boolean).
 *
 * ```tsx
 * // Active/inactive (boolean)
 * <StatusTag status={dept.active} />
 *
 * // Employee status (number enum)
 * import { EMPLOYEE_STATUS_COLOR_MAP, EMPLOYEE_STATUS_LABEL_MAP } from '@/shared/components';
 * <StatusTag status={employee.employeeStatus} colorMap={EMPLOYEE_STATUS_COLOR_MAP} labelMap={EMPLOYEE_STATUS_LABEL_MAP} />
 * ```
 */
export function StatusTag({
  status,
  colorMap,
  labelMap,
  ...tagProps
}: StatusTagProps) {
  const key = String(status);

  const color =
    colorMap?.[status as string | number] ??
    colorMap?.[key] ??
    DEFAULT_BOOL_COLOR[key] ??
    "default";

  const label =
    labelMap?.[status as string | number] ??
    labelMap?.[key] ??
    DEFAULT_BOOL_LABEL[key] ??
    key;

  return (
    <Tag color={color} {...tagProps}>
      {label}
    </Tag>
  );
}
