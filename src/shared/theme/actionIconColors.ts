import { BRAND } from "@/app/theme";

/**
 * Bảng màu CHUẨN cho icon hành động toàn dự án.
 *
 * Mỗi hành động chỉ được dùng đúng 1 tông màu — không tự đặt mã màu tại chỗ.
 * Nguồn duy nhất: file này. Việc gán "hành động nào dùng tông nào" nằm ở
 * `@/shared/components/actions/action-kinds` (ACTION_KINDS[kind].tone).
 *
 * Dùng: <EyeOutlined style={{ color: ACTION_ICON_COLORS.view }} />
 * hoặc (khuyến nghị) qua primitive: <ActionButton kind="view" />
 *
 * Không áp cho: icon trang trí (prefix input), icon điều hướng (menu/sidenav).
 */
export const ACTION_ICON_COLORS = {
  /**
   * Hành động CHÍNH: Đồng ý / Xác nhận / Lưu / Thêm mới.
   * Bám màu chủ đạo của hệ thống (`BRAND.primary`) — đổi nhận diện là đổi
   * theo, không phải sửa ở đây.
   */
  primary: BRAND.primary,
  /** Xem / Mở / Xem chi tiết / Preview / Lịch sử */
  view: "#2563eb",
  /** Sửa / Cập nhật / Chỉnh sửa */
  edit: "#d97706",
  /** Thêm mới / Tạo */
  create: "#16a34a",
  /** Xóa */
  delete: "#dc2626",
  /** Hủy / Từ chối / Vô hiệu hóa / Khóa / Ngừng cấp — cùng tông đỏ với delete */
  danger: "#dc2626",
  /** Duyệt / Kích hoạt / Xác nhận / Hoàn tất / Mở khóa / Lưu */
  success: "#16a34a",
  /** Đóng / thao tác trung tính không mang nghĩa nghiệp vụ */
  neutral: "#6b7280",
  /** Đồng bộ / Làm mới / Quét mã / Khôi phục (undo) */
  sync: "#0891b2",
  /** Tải lên / Nhập dữ liệu */
  upload: "#4f46e5",
  /** Tải xuống / Xuất file / In */
  download: "#7c3aed",
} as const;

export type ActionIconColorKey = keyof typeof ACTION_ICON_COLORS;

/**
 * Màu CHỮ + ICON của nút hành động kiểu "tonal" (nền nhạt cùng tông).
 *
 * Không dùng lại `ACTION_ICON_COLORS` được: đặt chữ màu gốc lên nền nhạt 12%
 * chỉ đạt ~4.0–4.4:1, dưới ngưỡng đọc được 4.5:1 của WCAG AA. Bảng dưới đây
 * là sắc độ đậm hơn một bậc trong CÙNG dải màu, đã đo trên đúng nền nhạt của
 * chính nó — thấp nhất 4.65:1.
 *
 * Nền vẫn lấy từ `ACTION_ICON_COLORS` (màu gốc, phủ 12%), nên nút tonal và
 * icon nền phẳng vẫn cùng một hệ màu.
 */
export const ACTION_TONAL_TEXT_COLORS: Record<ActionIconColorKey, string> = {
  /** 5.66:1 */
  primary: "#1d4ed8",
  /** 5.66:1 */
  view: "#1d4ed8",
  /** 6.25:1 */
  edit: "#92400e",
  /** 6.24:1 */
  create: "#166534",
  /** 5.37:1 */
  delete: "#b91c1c",
  /** 5.37:1 */
  danger: "#b91c1c",
  /** 6.24:1 */
  success: "#166534",
  /** 6.51:1 */
  neutral: "#4b5563",
  /** 4.65:1 */
  sync: "#0e7490",
  /** 5.26:1 */
  upload: "#4f46e5",
  /** 4.75:1 */
  download: "#7c3aed",
};
