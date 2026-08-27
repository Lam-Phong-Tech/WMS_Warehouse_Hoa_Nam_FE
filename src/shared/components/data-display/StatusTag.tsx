import type { ChipProps } from "@mui/material";
import { UiStatusBadge, type UiStatusTone } from "@/shared/ui";
import { UNKNOWN_BUSINESS_LABEL } from "@/shared/constants/business-labels";

/**
 * @deprecated compatibility adapter — dùng UiStatusBadge cho code mới.
 * Giữ nguyên public API (status/colorMap/labelMap/unknownLabel); phần render
 * đã chuyển sang UiStatusBadge (soft-tint Vuexy) thay cho preset màu antd cũ.
 */
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

// Ngữ nghĩa preset antd cũ → tone của UiStatusBadge. Các preset không nằm
// trong bảng (hex/tên màu CSS tuỳ ý) fail-safe về neutral — không còn render
// màu tự do ngoài hệ token.
const COLOR_TO_TONE: Record<string, UiStatusTone> = {
  success: "success",
  green: "success",
  lime: "success",
  error: "error",
  red: "error",
  volcano: "error",
  magenta: "error",
  warning: "warning",
  gold: "warning",
  orange: "warning",
  processing: "info",
  blue: "info",
  geekblue: "info",
  cyan: "info",
  default: "neutral",
  purple: "primary",
};

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
 *
 * @deprecated compatibility adapter — dùng UiStatusBadge cho code mới.
 */
export function StatusTag({
  status,
  colorMap,
  labelMap,
  unknownLabel = UNKNOWN_BUSINESS_LABEL,
  variant: _variant, // giữ trong API cũ; UiStatusBadge chỉ có một kiểu soft-tint
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

  return (
    <UiStatusBadge
      tone={COLOR_TO_TONE[color] ?? "neutral"}
      label={label}
      sx={sx}
      {...chipProps}
    />
  );
}
