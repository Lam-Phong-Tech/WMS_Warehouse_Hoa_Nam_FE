import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";
import { UNKNOWN_BUSINESS_LABEL } from "@/shared/constants/business-labels";

export interface StatusTagProps extends Omit<
  ChipProps,
  "color" | "children" | "label"
> {
  /** Giá trị trạng thái: số (employee status), boolean (active/inactive), hoặc string tuỳ ý. */
  status: string | number | boolean;
  /** Map value → màu (tên preset antd cũ hoặc hex/tên màu CSS bất kỳ — vẫn tương thích ngược). */
  colorMap?: Record<string | number, string>;
  /** Map value → nhãn hiển thị. */
  labelMap?: Record<string | number, string>;
  /** Nhãn an toàn khi enum chưa có mapping. Không render raw enum ra giao diện người dùng. */
  unknownLabel?: string;
}

// antd Tag color preset -> màu semantic MUI Chip (Chip.color chỉ nhận 1 tập cố định,
// khác antd Tag nhận preset name tuỳ ý hoặc hex).
const SEMANTIC_COLOR: Partial<Record<string, ChipProps["color"]>> = {
  success: "success",
  processing: "info",
  error: "error",
  warning: "warning",
  default: "default",
};

// 2 preset antd không phải tên màu CSS hợp lệ -> quy đổi hex tương đương.
// Mọi preset còn lại (blue/gold/red/purple/cyan/green/orange/magenta/lime...)
// đã là tên màu CSS chuẩn nên dùng thẳng được, không cần map.
const PRESET_TO_CSS_COLOR: Partial<Record<string, string>> = {
  volcano: "#fa541c",
  geekblue: "#2f54eb",
};

function resolveChipAppearance(color: string): {
  muiColor: ChipProps["color"];
  variant?: ChipProps["variant"];
  borderColor?: string;
} {
  const semantic = SEMANTIC_COLOR[color];
  if (semantic) return { muiColor: semantic };
  const cssColor = PRESET_TO_CSS_COLOR[color] ?? color;
  return { muiColor: "default", variant: "outlined", borderColor: cssColor };
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
  variant,
  sx,
  ...chipProps
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
    mappedLabel ?? (typeof status === "number" ? String(status) : unknownLabel);

  const appearance = resolveChipAppearance(color);

  return (
    <Chip
      label={label}
      color={appearance.muiColor}
      variant={variant ?? appearance.variant}
      size="small"
      sx={
        appearance.borderColor
          ? {
              color: appearance.borderColor,
              borderColor: appearance.borderColor,
              ...sx,
            }
          : sx
      }
      {...chipProps}
    />
  );
}
