import type { WarrantyCaseStatus } from "./types";
import type { ComponentIssueStatus } from "./services/componentIssueService";
import type { UiStatusTone } from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date";
export {
  ITEM_STATUS_LABELS,
  WARRANTY_EVENT_TYPE_LABELS,
  WARRANTY_IDENTIFICATION_STATUS_LABELS,
  WARRANTY_TRACE_STATUS_LABELS,
} from "@/shared/constants/business-labels";

/** Trạng thái baseline theo SRS v1.6: RECEIVED → CHECKING → REPAIRING → COMPLETED → RETURNED / CANCELLED. */
export const WARRANTY_BASELINE_STATUSES: WarrantyCaseStatus[] = [
  "RECEIVED",
  "CHECKING",
  "REPAIRING",
  "COMPLETED",
  "RETURNED",
  "CANCELLED",
];

export const WARRANTY_TERMINAL_STATUSES: WarrantyCaseStatus[] = [
  "RETURNED",
  "RETURNED_TO_CUSTOMER",
  "CLOSED",
  "CANCELLED",
];

/**
 * DEC-WAR-STATE-001 (WWHN-244): ma trận transition đã chốt, khớp 1-1 với
 * CurrentBaselineWarrantyController::TRANSITIONS. CHECKING -> COMPLETED được phép:
 * case kiểm tra xong kết luận không cần sửa không phải đi vòng qua REPAIRING giả.
 */
export const WARRANTY_NEXT_STATUS: Partial<
  Record<WarrantyCaseStatus, WarrantyCaseStatus[]>
> = {
  RECEIVED: ["CHECKING", "CANCELLED"],
  CHECKING: ["REPAIRING", "COMPLETED", "CANCELLED"],
  REPAIRING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["RETURNED", "CANCELLED"],
};

/**
 * DEC-WAR-STATE-001 guard 1 — chẩn đoán: rời CHECKING sang REPAIRING/COMPLETED bắt
 * buộc có confirmed_defect (BE trả 422 WARRANTY_DIAGNOSIS_REQUIRED).
 */
export const WARRANTY_DIAGNOSIS_REQUIRED_TARGETS: WarrantyCaseStatus[] = [
  "REPAIRING",
  "COMPLETED",
];

/**
 * DEC-WAR-STATE-001 guard 2/3 — COMPLETED bắt buộc ghi kết quả xử lý, RETURNED bắt
 * buộc ghi biên bản bàn giao/người nhận. Cả hai đi vào warranty_event.note
 * (422 WARRANTY_TREATMENT_RESULT_REQUIRED / WARRANTY_HANDOVER_NOTE_REQUIRED).
 */
export const WARRANTY_NOTE_REQUIRED_LABELS: Partial<
  Record<WarrantyCaseStatus, string>
> = {
  COMPLETED: "Kết quả xử lý (bắt buộc)",
  RETURNED: "Tên người nhận (bắt buộc)",
};

export const WARRANTY_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Đã tiếp nhận",
  OPEN: "Đang mở",
  CHECKING: "Đang kiểm tra",
  PROCESSING: "Đang xử lý",
  WAITING_PARTS: "Chờ linh kiện",
  REPAIRING: "Đang sửa chữa",
  COMPLETED: "Đã hoàn tất xử lý",
  READY: "Sẵn sàng trả",
  RETURNED: "Đã trả khách",
  RETURNED_TO_CUSTOMER: "Đã trả khách",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

export const WARRANTY_STATUS_COLORS: Record<string, string> = {
  RECEIVED: "default",
  OPEN: "default",
  CHECKING: "processing",
  PROCESSING: "processing",
  REPAIRING: "warning",
  WAITING_PARTS: "blue",
  COMPLETED: "success",
  READY: "success",
  RETURNED: "success",
  RETURNED_TO_CUSTOMER: "success",
  CLOSED: "default",
  CANCELLED: "error",
};

/** Dùng chung giữa ComponentIssueModal (COMP-01) và trang danh sách WAR-04. */
export const COMPONENT_ISSUE_STATUS_BADGE: Record<
  ComponentIssueStatus,
  { tone: UiStatusTone; label: string }
> = {
  DRAFT: { tone: "neutral", label: "Nháp" },
  SCANNING: { tone: "info", label: "Đang quét" },
  POSTED: { tone: "success", label: "Đã ghi nhận" },
  CANCELLED: { tone: "error", label: "Đã hủy" },
};

export const WARRANTY_ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  INTAKE: "Ảnh/tệp tiếp nhận",
  DIAGNOSTIC: "Ảnh/tệp chẩn đoán",
  RETURN: "Ảnh/tệp trả máy",
  OTHER: "Khác",
};

export function formatWarrantyDateTime(value?: string): string {
  if (!value) return "—";
  const formatted = formatDateTime(value);
  return formatted === "-" ? "—" : formatted;
}

/**
 * WWHN-244 — PII fail-closed ở tầng render.
 *
 * SRS v1.12 §13.8 + NFR-SRS-015 đã được BE thực thi (WarrantyPiiMasker), nhưng FE
 * trước đây render thẳng giá trị nhận được. Nếu bất kỳ đường nào trả PII thô —
 * alias endpoint chưa mask, response cache cũ, role bị cấu hình sai, snapshot/fixture
 * dev — thì giá trị thật lọt lên DOM và vào log/screenshot mà không ai chặn. Các hàm
 * dưới đây lặp lại đúng shape mask của BE để actor thiếu `warranty.pii.view` không
 * bao giờ nhìn thấy PII thô, bất kể payload chứa gì.
 */
export function maskWarrantyName(value?: string | null): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  return text
    .split(/\s+/)
    .map((word) => `${Array.from(word)[0] ?? ""}***`)
    .join(" ");
}

export function maskWarrantyPhone(value?: string | null): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  const chars = Array.from(text);
  if (chars.length <= 3) return "*".repeat(chars.length);
  return "*".repeat(chars.length - 3) + chars.slice(-3).join("");
}

export function maskWarrantyAddress(value?: string | null): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return "***";
  return `***, ${parts[parts.length - 1]}`;
}

/**
 * Áp mask khi actor không có `warranty.pii.view`. Idempotent với chuỗi đã mask sẵn
 * từ BE (mask lần hai không lộ thêm ký tự nào), nên gọi được vô điều kiện ở render.
 */
export function warrantyPiiText(
  value: string | null | undefined,
  canViewPii: boolean,
  kind: "name" | "phone" | "address",
): string {
  if (canViewPii) return (value ?? "").trim();
  if (kind === "phone") return maskWarrantyPhone(value);
  if (kind === "address") return maskWarrantyAddress(value);
  return maskWarrantyName(value);
}
