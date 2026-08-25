/**
 * REQ-001: phân loại "Nơi nhận" (bảng agencies, cột recipient_type).
 * Danh sách giá trị phải khớp validate của BE (BaM1RecipientController):
 * recipient_type là required khi tạo và chỉ nhận đúng 4 mã dưới đây.
 * Dùng chung cho màn master Nơi nhận và các báo cáo GĐ1 — KHÔNG khai lại
 * label cục bộ ở từng màn để tránh lệch nhãn tiếng Việt.
 */
export const RECIPIENT_TYPES = [
  "DISTRIBUTOR",
  "AGENCY",
  "PROJECT_CUSTOMER",
  "RETAIL_CUSTOMER",
] as const;

export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  DISTRIBUTOR: "Nhà phân phối",
  AGENCY: "Đại lý",
  PROJECT_CUSTOMER: "Khách công trình",
  RETAIL_CUSTOMER: "Khách lẻ",
};

/** Nhãn tiếng Việt cho recipient_type; giá trị lạ (dữ liệu cũ) trả nguyên mã. */
export function recipientTypeLabel(value?: string | null): string {
  if (!value) return "—";
  return RECIPIENT_TYPE_LABELS[value as RecipientType] ?? value;
}
