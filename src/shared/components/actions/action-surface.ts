import { alpha } from "@mui/material/styles";
import { RADIUS } from "@/shared/ui/tokens";
import {
  ACTION_ICON_COLORS,
  ACTION_TONAL_TEXT_COLORS,
} from "@/shared/theme/actionIconColors";
import { ACTION_KINDS, type ActionKind } from "./action-kinds";

/**
 * Kiểu bề mặt của nút hành động.
 *
 * - `flat`  — nền trong suốt, chỉ icon mang màu nghiệp vụ.
 * - `tonal` — NỀN NHẠT cùng tông + chữ/icon đậm cùng màu, không viền, không
 *             đổ bóng. Dựng theo biến thể `tonal` của Vuexy.
 */
export type ActionAppearance = "flat" | "tonal";

/**
 * Kiểu bề mặt mặc định cho TOÀN dự án. Đổi đúng dòng này là đổi hình thức của
 * cả 280+ nút hành động — không màn nào được tự quyết.
 *
 * Đã chốt `"tonal"`: nút có nền nhạt cùng tông nghiệp vụ nên nhận diện được là
 * nút, khác hẳn chữ thường — yêu cầu UX "button phải nhìn ra là button".
 */
export const ACTION_APPEARANCE_DEFAULT: ActionAppearance = "tonal";

const SURFACE = {
  /** Độ phủ của nền nhạt, theo `--v-activated-opacity` của Vuexy/Vuetify. */
  fill: 0.12,
  /** Nền đậm thêm khi rê chuột. */
  fillHover: 0.22,
  /**
   * Bo góc nút hành động — dùng ĐÚNG `RADIUS.control` như mọi control khác
   * (input, nút trong hộp thoại), không khai một giá trị riêng.
   *
   * Trước đây là 20px: trên nút cao 36px con số đó ra dáng viên thuốc, khiến
   * nút hành động trong bảng nhìn khác hẳn nút "Hủy"/"Xác nhận" ở footer hộp
   * thoại ngay bên cạnh — cùng là nút mà hai hình dạng.
   */
  radius: RADIUS.control,
} as const;

/** Màu nền nhạt của một hành động. */
export function actionTonalFill(kind: ActionKind): string {
  return alpha(ACTION_ICON_COLORS[ACTION_KINDS[kind].tone], SURFACE.fill);
}

/** Màu chữ + icon của một hành động (đã đo tương phản ≥ 4.65:1 trên nền của nó). */
export function actionTonalText(kind: ActionKind): string {
  return ACTION_TONAL_TEXT_COLORS[ACTION_KINDS[kind].tone];
}

/**
 * `sx` dựng bề mặt "tonal" theo tông nghiệp vụ của `kind`.
 *
 * Bo góc lặp lại tường minh ở đây để ghi đè bo góc mà MUI tự đặt cho biến thể
 * nút đang dùng — giá trị vẫn là `RADIUS.control` chung của hệ.
 *
 * KHÔNG đổ bóng và KHÔNG viền — đúng như `variant="tonal"` của Vuexy.
 */
// Cố ý KHÔNG chú thích kiểu trả về là SxProps<Theme>: SxProps có thể là mảng
// hoặc hàm, nên nơi gọi không spread ({...}) vào sx được. Để TS tự suy ra kiểu
// object literal thì spread hợp lệ.
export function actionSurfaceSx(kind: ActionKind) {
  const tone = ACTION_ICON_COLORS[ACTION_KINDS[kind].tone];
  return {
    color: actionTonalText(kind),
    border: 0,
    borderRadius: `${SURFACE.radius}px`,
    backgroundColor: alpha(tone, SURFACE.fill),
    boxShadow: "none",
    "&:hover": {
      backgroundColor: alpha(tone, SURFACE.fillHover),
      boxShadow: "none",
    },
    // Nút bị khoá (thiếu quyền hoặc đang gửi) bỏ hẳn màu nghiệp vụ — nếu không
    // người dùng tưởng vẫn bấm được.
    "&.Mui-disabled": {
      color: "text.disabled",
      backgroundColor: "action.disabledBackground",
    },
  };
}
