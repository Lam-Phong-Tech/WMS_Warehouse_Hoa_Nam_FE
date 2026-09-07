import { bilingual } from "@/shared/constants/business-labels";
import type { TranslateFn } from "@/shared/i18n/useT";

/**
 * NHÃN CỦA CỘT "Lỗi / lý do" (RPT-05) — dịch mã kỹ thuật của máy in sang câu
 * tiếng Việt mà nhân viên kho đọc được.
 *
 * Cột này gộp BA nguồn có bản chất khác nhau, đó là lý do phải có lớp dịch
 * riêng thay vì in thẳng giá trị BE trả về:
 *
 *  - `error_code` — MÃ enum do agent in / seeder ghi (`PRINTER_JAMMED`,
 *    `PAPER_OUT`…). Người dùng báo lỗi vì đúng những mã này hiện nguyên dạng
 *    tiếng Anh giữa màn tiếng Việt.
 *  - `metadata.reason` — VỪA là mã (`PAPER_JAM`, `TEMPLATE_MISMATCH` của bộ
 *    seeder) VỪA là lý do in lại do chính người dùng chọn/gõ ở modal phiếu xuất
 *    (`REPRINT_REASONS` trong AlignedOutboundDetailModal.tsx đã là tiếng Việt).
 *    Vì vậy không thể dịch mù: chuỗi không có hình dạng mã thì giữ nguyên.
 *  - `error_message` — câu mô tả tự do của BE, luôn giữ nguyên.
 *
 * Song ngữ theo đúng cơ chế `bilingual()` của business-labels.ts (Proxy đọc
 * ngôn ngữ lúc truy cập thuộc tính) — KHÔNG spread map này vào map khác.
 */
export const PACKING_LABEL_FAILURE_LABELS: Readonly<Record<string, string>> =
  bilingual(
    {
      // error_code — WarehouseOperationsCoverageSeeder / LabelSnapshotSeeder.
      PRINTER_JAMMED: "Máy in bị kẹt giấy",
      PRINTER_OUT_OF_PAPER: "Máy in hết giấy",
      PRINTER_OFFLINE: "Máy in mất kết nối",
      PRINTER_UNAVAILABLE: "Máy in không sẵn sàng",
      LABEL_TEMPLATE_INVALID: "Mẫu nhãn không hợp lệ",
      TIMEOUT: "Máy in không phản hồi kịp",
      PAPER_OUT: "Máy in hết giấy",
      // metadata.reason dạng mã — cùng bộ seeder.
      PAPER_JAM: "Máy in bị kẹt giấy",
      OUT_OF_PAPER: "Máy in hết giấy",
      TEMPLATE_MISMATCH: "Mẫu nhãn không khớp khổ giấy",
    },
    {
      PRINTER_JAMMED: "Printer jam",
      PRINTER_OUT_OF_PAPER: "Printer out of paper",
      PRINTER_OFFLINE: "Printer offline",
      PRINTER_UNAVAILABLE: "Printer unavailable",
      LABEL_TEMPLATE_INVALID: "Invalid label template",
      TIMEOUT: "Printer timed out",
      PAPER_OUT: "Printer out of paper",
      PAPER_JAM: "Printer jam",
      OUT_OF_PAPER: "Printer out of paper",
      TEMPLATE_MISMATCH: "Label template does not match paper size",
    },
  );

/**
 * Trạng thái của BẢN LƯU nhãn (`label_snapshots.status`) — tập đóng do CHECK
 * `chk_label_snapshot_current_status` của Postgres khoá lại, nên map đủ sáu giá
 * trị là phủ hết. Hộp thoại kiểm chứng trước đây in thẳng `PRINTED`.
 */
export const LABEL_SNAPSHOT_STATUS_LABELS: Readonly<Record<string, string>> =
  bilingual(
    {
      DRAFT: "Nháp",
      PREVIEWED: "Đã xem trước",
      READY_TO_PRINT: "Sẵn sàng in",
      PENDING_PRINT: "Chờ in",
      PRINTED: "Đã in",
      PRINT_FAILED: "In lỗi",
    },
    {
      DRAFT: "Draft",
      PREVIEWED: "Previewed",
      READY_TO_PRINT: "Ready to print",
      PENDING_PRINT: "Pending print",
      PRINTED: "Printed",
      PRINT_FAILED: "Print failed",
    },
  );

/**
 * "Trông như mã enum" = CHỮ HOA + ít nhất một gạch dưới.
 *
 * Bắt buộc có gạch dưới để một lý do in lại người dùng gõ hoa toàn bộ ("HONG",
 * "GAP LAI") không bị hiểu nhầm là mã máy rồi bọc thành "Lỗi in khác (mã …)".
 * Mã một từ thật sự (`TIMEOUT`) vẫn ra đúng nhãn vì tra map chạy TRƯỚC.
 */
const ENUM_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u;

/**
 * Một mẩu của cột "Lỗi / lý do" sau khi đã Việt hoá.
 *
 * Trả chuỗi rỗng khi không có gì để nói — chỗ gọi tự quyết định in `EMPTY_TEXT`
 * hay bỏ hẳn dòng. Mã lạ (BE thêm mã mới mà FE chưa kịp map) KHÔNG bị nuốt mất:
 * nó được bọc trong câu tiếng Việt kèm nguyên mã để còn tra soát được — đây là
 * màn kiểm chứng, giấu mã đi thì mất luôn đầu mối.
 */
export function packingLabelFailureText(
  value: string | null | undefined,
  t: TranslateFn,
): string {
  const raw = String(value ?? "").trim();
  if (raw === "") return "";
  const mapped = PACKING_LABEL_FAILURE_LABELS[raw];
  if (mapped !== undefined) return mapped;
  if (ENUM_CODE.test(raw))
    return t("reports.packingLabel.failureUnknown", { code: raw });
  // Lý do in lại do người dùng chọn/gõ — đã là câu tiếng Việt, giữ nguyên.
  return raw;
}
