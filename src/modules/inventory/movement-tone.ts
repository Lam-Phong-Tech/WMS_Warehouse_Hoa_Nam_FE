import type { UiStatusTone } from "@/shared/ui";

/**
 * Màu chip theo loại biến động — đồng bộ với bảng truy vết RPT-03
 * (MOVEMENT_KIND_TONES): nhập = success, xuất = primary, xuất linh kiện = info,
 * phiếu đảo = warning. Không dùng error vì đảo/điều chỉnh là nghiệp vụ hợp lệ,
 * không phải lỗi.
 */
const MOVEMENT_TYPE_TONES: Readonly<Record<string, UiStatusTone>> = {
  RECEIPT: "success",
  ISSUE: "primary",
  COMPONENT_ISSUE: "info",
  REVERSAL: "warning",
};

export function movementTypeTone(type: string): UiStatusTone {
  return MOVEMENT_TYPE_TONES[type.trim().toUpperCase()] ?? "neutral";
}
