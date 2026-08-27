import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";

/**
 * Bảng màu CHUẨN cho icon hành động toàn dự án.
 *
 * Mỗi hành động chỉ được dùng đúng 1 tông màu — không tự đặt mã màu tại chỗ.
 * Nguồn giá trị: canonical tokens (@/shared/ui/tokens) theo DEC-UI-BASELINE-01;
 * việc gán "hành động nào dùng tông nào" nằm ở
 * `@/shared/components/actions/action-kinds` (ACTION_KINDS[kind].tone).
 *
 * Mapping ngữ nghĩa → tông Vuexy (đổi từ hệ blue/amber cũ):
 * view/sync → info (cyan) · edit → warning · create/success → success ·
 * delete/danger → error · neutral → secondary · primary/upload → primary ·
 * download → primary-dark.
 */
export const ACTION_ICON_COLORS = {
  /** Hành động CHÍNH: Đồng ý / Xác nhận / Lưu / Thêm mới. */
  primary: S.primary,
  /** Xem / Mở / Xem chi tiết / Preview / Lịch sử */
  view: S.info,
  /** Sửa / Cập nhật / Chỉnh sửa */
  edit: S.warning,
  /** Thêm mới / Tạo */
  create: S.success,
  /** Xóa */
  delete: S.error,
  /** Hủy / Từ chối / Vô hiệu hóa / Khóa / Ngừng cấp — cùng tông với delete */
  danger: S.error,
  /** Duyệt / Kích hoạt / Xác nhận / Hoàn tất / Mở khóa / Lưu */
  success: S.success,
  /** Đóng / thao tác trung tính không mang nghĩa nghiệp vụ */
  neutral: S.secondary,
  /** Đồng bộ / Làm mới / Quét mã / Khôi phục (undo) */
  sync: S.infoDark,
  /** Tải lên / Nhập dữ liệu */
  upload: S.primary,
  /** Tải xuống / Xuất file / In */
  download: S.primaryDark,
} as const;

export type ActionIconColorKey = keyof typeof ACTION_ICON_COLORS;

/**
 * Màu CHỮ + ICON của nút hành động kiểu "tonal" (nền nhạt cùng tông).
 *
 * Không dùng lại `ACTION_ICON_COLORS` được: đặt chữ màu gốc lên nền soft 16%
 * không đạt ngưỡng đọc được 4.5:1 của WCAG AA. Bảng dưới dùng các sắc độ chữ
 * đậm hơn TRONG CÙNG dải màu, lấy từ bộ `*Text` của tokens (đã kiểm AA trong
 * spec X trên đúng nền soft của chính nó).
 */
export const ACTION_TONAL_TEXT_COLORS: Record<ActionIconColorKey, string> = {
  primary: S.primaryDark,
  view: S.infoText,
  edit: S.warningText,
  create: S.successText,
  delete: S.errorText,
  danger: S.errorText,
  success: S.successText,
  neutral: S.secondaryDark,
  sync: S.infoText,
  upload: S.primaryDark,
  download: S.primaryDark,
};
