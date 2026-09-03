import type { WarrantyCaseStatus } from "./types";
import type { ComponentIssueStatus } from "./services/componentIssueService";
import type { UiStatusTone } from "@/shared/ui";
import type { MessageKey } from "@/shared/i18n/messages";
import { tStatic } from "@/shared/i18n/useT";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatDateTime } from "@/shared/utils/format-date";

/**
 * Map nhãn đọc-tại-lúc-truy-cập: giữ nguyên shape `Record<code, string>` cho
 * mọi call site hiện có (`LABELS[status]`), nhưng mỗi lần đọc property sẽ tra
 * `tStatic` theo ngôn ngữ đang chọn thay vì đóng băng chuỗi lúc import module.
 */
function lazyLabelMap<K extends string>(
  keys: Record<K, MessageKey>,
): Record<K, string> {
  const map = {} as Record<K, string>;
  for (const code of Object.keys(keys) as K[]) {
    Object.defineProperty(map, code, {
      enumerable: true,
      get: () => tStatic(keys[code]),
    });
  }
  return map;
}
export {
  ITEM_STATUS_LABELS,
  WARRANTY_EVENT_TYPE_LABELS,
  WARRANTY_IDENTIFICATION_STATUS_LABELS,
  WARRANTY_IDENTIFICATION_STATUS_SHORT_LABELS,
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
  Record<WarrantyCaseStatus, MessageKey>
> = {
  COMPLETED: "warranty.noteRequired.completed",
  RETURNED: "warranty.noteRequired.returned",
};

export const WARRANTY_STATUS_LABELS: Record<string, string> = lazyLabelMap({
  RECEIVED: "warranty.status.received",
  OPEN: "warranty.status.open",
  CHECKING: "warranty.status.checking",
  PROCESSING: "warranty.status.processing",
  WAITING_PARTS: "warranty.status.waitingParts",
  REPAIRING: "warranty.status.repairing",
  COMPLETED: "warranty.status.completed",
  READY: "warranty.status.ready",
  RETURNED: "warranty.status.returned",
  RETURNED_TO_CUSTOMER: "warranty.status.returned",
  CLOSED: "warranty.status.closed",
  CANCELLED: "warranty.status.cancelled",
});

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

/** Entry badge với nhãn đọc-tại-lúc-truy-cập (cùng lý do lazyLabelMap). */
function badgeEntry(
  tone: UiStatusTone,
  key: MessageKey,
): { tone: UiStatusTone; label: string } {
  return {
    tone,
    get label() {
      return tStatic(key);
    },
  };
}

/** Dùng chung giữa ComponentIssueModal (COMP-01) và trang danh sách WAR-04. */
export const COMPONENT_ISSUE_STATUS_BADGE: Record<
  ComponentIssueStatus,
  { tone: UiStatusTone; label: string }
> = {
  DRAFT: badgeEntry("neutral", "warranty.componentIssueStatus.draft"),
  SCANNING: badgeEntry("info", "warranty.componentIssueStatus.scanning"),
  POSTED: badgeEntry("success", "warranty.componentIssueStatus.posted"),
  CANCELLED: badgeEntry("error", "warranty.status.cancelled"),
};

export const WARRANTY_ATTACHMENT_TYPE_LABELS: Record<string, string> =
  lazyLabelMap({
    INTAKE: "warranty.attachmentType.intake",
    DIAGNOSTIC: "warranty.attachmentType.diagnostic",
    RETURN: "warranty.attachmentType.return",
    OTHER: "warranty.attachmentType.other",
  });

export function formatWarrantyDateTime(value?: string): string {
  if (!value) return EMPTY_TEXT;
  // formatDateTime đã trả EMPTY_TEXT khi rỗng/không hợp lệ (xem format-date.ts).
  return formatDateTime(value);
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
