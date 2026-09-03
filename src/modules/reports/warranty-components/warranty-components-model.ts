/**
 * Mô hình dữ liệu của RPT-06 "Báo cáo Bảo hành & linh kiện" (baseline UI/UX
 * 8.7). Tách khỏi component để phần suy dẫn nghiệp vụ (rủi ro hạn, linh kiện đã
 * xuất, mốc thời gian) test được độc lập với JSX.
 */
import dayjs from "dayjs";
import { bilingual } from "@/shared/constants/business-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import type { Raw } from "@/modules/reports/operations/report-format";

/** Sáu trạng thái hồ sơ bảo hành theo đúng thứ tự của baseline 8.7. */
export const WARRANTY_STATUS_ORDER = [
  "RECEIVED",
  "CHECKING",
  "REPAIRING",
  "COMPLETED",
  "RETURNED",
  "CANCELLED",
] as const;

export type WarrantyStatus = (typeof WARRANTY_STATUS_ORDER)[number];

/**
 * Nhãn theo GIÁ TRỊ ENUM của BE nên bọc `bilingual` (đọc ngôn ngữ tại lúc truy
 * cập thuộc tính) thay vì khoá i18n: mọi call site đang index thẳng vào map.
 */
export const WARRANTY_STATUS_LABEL: Readonly<Record<WarrantyStatus, string>> =
  bilingual(
    {
      RECEIVED: "Tiếp nhận",
      CHECKING: "Đang kiểm tra",
      REPAIRING: "Đang sửa chữa",
      COMPLETED: "Hoàn tất",
      RETURNED: "Đã trả",
      CANCELLED: "Đã hủy",
    },
    {
      RECEIVED: "Intake",
      CHECKING: "Under inspection",
      REPAIRING: "Under repair",
      COMPLETED: "Completed",
      RETURNED: "Returned",
      CANCELLED: "Cancelled",
    },
  );

/** Năm mức rủi ro hạn xử lý của baseline 8.7. */
export const DUE_RISK_ORDER = [
  "ON_TRACK",
  "DUE_SOON",
  "OVERDUE",
  "NO_ESTIMATE",
  "NOT_APPLICABLE",
] as const;

export type DueRisk = (typeof DUE_RISK_ORDER)[number];

export const DUE_RISK_LABEL: Readonly<Record<DueRisk, string>> = bilingual(
  {
    ON_TRACK: "Đúng hạn",
    DUE_SOON: "Sắp đến hạn",
    OVERDUE: "Quá hạn",
    NO_ESTIMATE: "Chưa có dự kiến",
    NOT_APPLICABLE: "Không áp dụng",
  },
  {
    ON_TRACK: "On track",
    DUE_SOON: "Due soon",
    OVERDUE: "Overdue",
    NO_ESTIMATE: "No estimate yet",
    NOT_APPLICABLE: "Not applicable",
  },
);

export type BadgeTone = "info" | "success" | "warn" | "error";

/**
 * Cùng bảng tông màu với `tone()` của baseline: quá hạn = đỏ, sắp đến hạn và
 * đang sửa chữa = cam, hoàn tất/đã trả = lục, còn lại = lam.
 */
export function toneOf(value: string): BadgeTone {
  if (value === "OVERDUE") return "error";
  if (value === "DUE_SOON" || value === "REPAIRING") return "warn";
  if (value === "COMPLETED" || value === "RETURNED") return "success";
  return "info";
}

/** Hồ sơ đã đóng thì không còn đo hạn xử lý nữa. */
const CLOSED_STATUSES = new Set<string>(["COMPLETED", "RETURNED", "CANCELLED"]);

/** Ngưỡng "sắp đến hạn" giữ đúng con số đang dùng ở báo cáo bảo hành cũ. */
export const DUE_SOON_DAYS = 2;

export function dueRiskOf(
  status: string,
  dueDate: string,
  today: dayjs.Dayjs,
): DueRisk {
  if (CLOSED_STATUSES.has(status)) return "NOT_APPLICABLE";
  if (!dueDate) return "NO_ESTIMATE";
  const due = dayjs(dueDate);
  if (!due.isValid()) return "NO_ESTIMATE";
  const days = due.startOf("day").diff(today.startOf("day"), "day");
  if (days < 0) return "OVERDUE";
  if (days <= DUE_SOON_DAYS) return "DUE_SOON";
  return "ON_TRACK";
}

export type ComponentEntry = { skuCode: string; qty: number };

/**
 * `components_issued` do BE dựng ở dạng `"SKU-A × 2; SKU-B × 1"`. Một số bản
 * ghi chỉ trả SỐ LƯỢNG tổng (chuỗi toàn chữ số) — khi đó không có mã linh kiện
 * để liệt kê nhưng vẫn phải đếm đúng, nếu không cột "Linh kiện đã xuất" sẽ về 0
 * trong khi hồ sơ thực sự đã xuất linh kiện.
 */
export function parseComponentsIssued(value: string): {
  entries: ComponentEntry[];
  count: number;
} {
  const raw = (value ?? "").trim();
  if (!raw || raw === EMPTY_TEXT) return { entries: [], count: 0 };
  if (/^\d+$/u.test(raw)) return { entries: [], count: Number(raw) };
  const entries = raw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.includes("×"))
    .map((part) => {
      const [codePart, qtyPart] = part.split("×").map((piece) => piece.trim());
      return { skuCode: codePart, qty: Number(qtyPart) || 0 };
    })
    .filter((entry) => entry.skuCode !== "");
  return { entries, count: entries.length };
}

const DATE_DIMENSION_LABELS = bilingual(
  {
    RECEIVED: "Ngày tiếp nhận",
    COMPLETED: "Ngày hoàn tất",
    RETURNED: "Ngày trả khách",
  },
  {
    RECEIVED: "Intake date",
    COMPLETED: "Completion date",
    RETURNED: "Return date",
  },
);

/**
 * Mốc thời gian của bộ lọc — quyết định cột ngày dùng để thu hẹp lát cắt.
 *
 * `label` là GETTER: gán thẳng chuỗi ở đây sẽ đóng băng ngôn ngữ lúc import.
 */
export const DATE_DIMENSIONS = [
  {
    value: "RECEIVED",
    get label() {
      return DATE_DIMENSION_LABELS.RECEIVED;
    },
  },
  {
    value: "COMPLETED",
    get label() {
      return DATE_DIMENSION_LABELS.COMPLETED;
    },
  },
  {
    value: "RETURNED",
    get label() {
      return DATE_DIMENSION_LABELS.RETURNED;
    },
  },
] as const;

export type DateDimension = (typeof DATE_DIMENSIONS)[number]["value"];

export type WarrantyCaseRow = {
  caseId: string;
  caseNo: string;
  model: string;
  skuId: string;
  skuName: string;
  status: string;
  statusLabel: string;
  receivedAt: string;
  completedAt: string;
  returnedAt: string;
  dueDate: string;
  due: DueRisk;
  defectNames: string[];
  defectCodes: string[];
  components: ComponentEntry[];
  componentCount: number;
  owner: string;
  ownerId: string;
  department: string;
  departmentId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  raw: Raw;
};

/** Ngày ứng với mốc thời gian đang chọn — rỗng nghĩa là hồ sơ chưa có mốc đó. */
export function dateOfDimension(
  row: WarrantyCaseRow,
  dimension: DateDimension,
): string {
  if (dimension === "COMPLETED") return row.completedAt;
  if (dimension === "RETURNED") return row.returnedAt;
  return row.receivedAt;
}

/** So khớp không phân biệt hoa thường, bỏ qua khoảng trắng thừa. */
export function matches(haystack: string, needle: string): boolean {
  const term = needle.trim().toLowerCase();
  if (!term) return true;
  return haystack.toLowerCase().includes(term);
}

/** Trung bình số ngày từ tiếp nhận tới khi đóng hồ sơ, làm tròn 1 chữ số. */
export function averageCompletionDays(rows: WarrantyCaseRow[]): number | null {
  const spans = rows
    .map((row) => {
      const start = dayjs(row.receivedAt);
      const closed = row.completedAt || row.returnedAt;
      const end = dayjs(closed);
      if (!row.receivedAt || !closed || !start.isValid() || !end.isValid()) {
        return null;
      }
      const days = end.startOf("day").diff(start.startOf("day"), "day");
      return days >= 0 ? days : null;
    })
    .filter((value): value is number => value !== null);
  if (spans.length === 0) return null;
  return spans.reduce((sum, value) => sum + value, 0) / spans.length;
}
