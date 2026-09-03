import { EMPTY_TEXT } from "@/shared/constants/display";
import { tStatic } from "@/shared/i18n/useT";

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

// Getter để nhãn đọc theo ngôn ngữ HIỆN TẠI mỗi lần truy cập (API
// Record<RecipientType, string> giữ nguyên cho các màn master/báo cáo đang dùng).
export const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  get DISTRIBUTOR() {
    return tStatic("shared.recipient.distributor");
  },
  get AGENCY() {
    return tStatic("shared.recipient.agency");
  },
  get PROJECT_CUSTOMER() {
    return tStatic("shared.recipient.projectCustomer");
  },
  get RETAIL_CUSTOMER() {
    return tStatic("shared.recipient.retailCustomer");
  },
};

/** Nhãn tiếng Việt cho recipient_type; giá trị lạ (dữ liệu cũ) trả nguyên mã. */
export function recipientTypeLabel(value?: string | null): string {
  if (!value) return EMPTY_TEXT;
  return RECIPIENT_TYPE_LABELS[value as RecipientType] ?? value;
}
