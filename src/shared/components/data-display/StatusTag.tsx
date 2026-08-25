import { Tag } from "antd";
import type { TagProps } from "antd";
import { UNKNOWN_BUSINESS_LABEL } from "@/shared/constants/business-labels";

export interface StatusTagProps extends Omit<TagProps, "color" | "children"> {
  /** Giá trị trạng thái: số (employee status), boolean (active/inactive), hoặc string tuỳ ý. */
  status: string | number | boolean;
  /** Map value → màu Tag antd (preset hoặc hex). */
  colorMap?: Record<string | number, string>;
  /** Map value → nhãn hiển thị. */
  labelMap?: Record<string | number, string>;
  /** Nhãn an toàn khi enum chưa có mapping. Không render raw enum ra giao diện người dùng. */
  unknownLabel?: string;
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
 * Tag trạng thái dùng chung. Với string enum, caller nên truyền labelMap theo domain.
 * Nếu enum mới chưa được map, component hiển thị nhãn an toàn thay vì làm lộ raw
 * contract tiếng Anh lên giao diện operator.
 */
export function StatusTag({
  status,
  colorMap,
  labelMap,
  unknownLabel = UNKNOWN_BUSINESS_LABEL,
  ...tagProps
}: StatusTagProps) {
  const key = String(status);

  const color =
    colorMap?.[status as string | number] ??
    colorMap?.[key] ??
    DEFAULT_BOOL_COLOR[key] ??
    "default";

  const mappedLabel =
    labelMap?.[status as string | number] ??
    labelMap?.[key] ??
    DEFAULT_BOOL_LABEL[key];

  // Number enum không có map vẫn giữ số để không phá các badge số hiện hữu.
  // String enum không có map phải fail-closed về tiếng Việt.
  const label =
    mappedLabel ??
    (typeof status === "number" ? String(status) : unknownLabel);

  return (
    <Tag color={color} {...tagProps}>
      {label}
    </Tag>
  );
}
