/**
 * Màu icon hành động theo nghiệp vụ — nguồn duy nhất cho màu icon Xem/Sửa/Xóa/...
 * rải rác khắp các trang (bảng danh sách, dropdown thao tác, footer modal).
 *
 * Giá trị trùng với `.btn.primary/success/warn/danger` trong
 * `src/styles/hn-wms-source-screen.css` để đồng bộ với nút CTA đã có.
 *
 * Dùng: <EyeOutlined style={{ color: ACTION_ICON_COLORS.view }} />
 * Không áp cho: icon trên nút antd đã tự tô màu qua `type="primary"` hoặc
 * `danger`, icon trang trí (prefix input), icon điều hướng (menu/sidenav).
 */
export const ACTION_ICON_COLORS = {
  /** Xem / Mở / Xem chi tiết / Preview */
  view: "#2563eb",
  /** Sửa / Cập nhật / Chỉnh sửa */
  edit: "#d97706",
  /** Xóa */
  delete: "#dc2626",
  /** Hủy / Từ chối / Vô hiệu hóa / Khóa / Ngừng cấp — cùng tông đỏ với delete */
  danger: "#dc2626",
  /** Duyệt / Kích hoạt / Xác nhận / Hoàn tất / Mở khóa */
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
