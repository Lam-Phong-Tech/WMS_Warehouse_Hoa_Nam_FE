/**
 * Lớp NGÔN NGỮ NGƯỜI ĐỌC cho màn "Nhật ký hệ thống".
 *
 * Bảng `audit_log` của BE lưu nguyên liệu kỹ thuật, không phải câu chữ cho
 * người dùng kho:
 *  - `description` là accessor ghép máy móc `"{action} {object_type} #{uuid}"`
 *    (xem `Modules/AuditLog/app/Models/AuditLog.php`) — 5402/5501 bản ghi
 *    KHÔNG có `reason`, nên gần như toàn bộ cột "Mô tả" hiện ra dạng
 *    `POST_ISSUE stock_document #ecd447d4-aae2-...`.
 *  - `object_type` là TÊN BẢNG / slug route (`stock_document`, `item_instance`,
 *    `label-print-events`).
 *  - `before_data` / `after_data` là JSON thô (`{"status": "SCANNING"}`).
 *
 * File này dịch cả ba thứ đó sang tiếng Việt: nhãn loại đối tượng, câu mô tả
 * tự dựng, và cặp "tên trường – giá trị" cho khối dữ liệu trước/sau thay đổi.
 * Bản JSON gốc KHÔNG bị bỏ đi — Dialog chi tiết vẫn cho bung ra để tra soát.
 *
 * Song ngữ theo đúng cơ chế chung: mọi map bọc `bilingual(vi, en)`; TUYỆT ĐỐI
 * không spread map khác vào đây (spread đóng băng ngôn ngữ lúc import) và
 * không gán `EMPTY_TEXT` ra hằng cấp module — xem business-labels.ts.
 */
import {
  AUDIT_ACTION_LABELS,
  IAM_USER_STATUS_LABELS,
  PHYSICAL_RETURN_STATUS_LABELS,
  SCAN_RESULT_LABELS,
  bilingual,
  businessLabel,
  enumLabelOrText,
  spellOutEnumCode,
} from "@/shared/constants/business-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatQuantity } from "@/shared/utils/format-number";
import { shortId } from "@/shared/utils/shortId";
import type { UiStatusTone } from "@/shared/ui";
import type { AuditLog } from "../types/audit-logs.types";

/* -------------------------------------------------------------------------- */
/* Loại đối tượng (cột `object_type`)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Giá trị thật trong DB lộn xộn giữa tên bảng số ít (`stock_document`), tên
 * bảng số nhiều (`users`, `defects`) và slug route (`label-print-events`) —
 * nên chuẩn hoá về snake_case số ít trước khi tra bảng.
 */
function normalizeObjectType(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

const OBJECT_TYPE_LABELS = bilingual(
  {
    item_instance: "Hiện vật (theo serial)",
    stock_document: "Phiếu nhập/xuất kho",
    inbound_document: "Phiếu nhập kho",
    outbound_document: "Phiếu xuất kho",
    component_issue_document: "Phiếu xuất linh kiện",
    reversal_document: "Phiếu điều chỉnh tồn",
    document_attachment: "Tệp đính kèm chứng từ",
    stock_movement: "Biến động tồn",
    warranty_case: "Hồ sơ bảo hành",
    putaway_event: "Lượt xếp khay",
    label_print_event: "Lượt in tem nhãn",
    printer_config: "Cấu hình máy in",
    container: "Khay/thùng chứa",
    warehouse: "Kho",
    sku: "SKU",
    product: "Sản phẩm",
    defect: "Danh mục lỗi",
    agency: "Đối tượng nhận hàng",
    app_user: "Tài khoản người dùng",
    user: "Tài khoản người dùng",
    role: "Vai trò",
    permission: "Quyền",
    refresh_token: "Phiên đăng nhập",
    audit_log: "Nhật ký hệ thống",
    report: "Báo cáo",
    scan_batch: "Lô quét",
    pv_product_image: "Ảnh sản phẩm App PV",
    pv_admin: "Quản trị App PV",
  },
  {
    item_instance: "Item (by serial)",
    stock_document: "Goods receipt / issue document",
    inbound_document: "Inbound document",
    outbound_document: "Outbound document",
    component_issue_document: "Component issue document",
    reversal_document: "Stock adjustment document",
    document_attachment: "Document attachment",
    stock_movement: "Stock movement",
    warranty_case: "Warranty case",
    putaway_event: "Putaway event",
    label_print_event: "Label print event",
    printer_config: "Printer configuration",
    container: "Container / tray",
    warehouse: "Warehouse",
    sku: "SKU",
    product: "Product",
    defect: "Defect catalogue",
    agency: "Recipient",
    app_user: "User account",
    user: "User account",
    role: "Role",
    permission: "Permission",
    refresh_token: "Sign-in session",
    audit_log: "System audit log",
    report: "Report",
    scan_batch: "Scan batch",
    pv_product_image: "PV product image",
    pv_admin: "PV app administration",
  },
);

/** `users` → `user`, `agencies` → `agency`, `defects` → `defect`. */
function singularize(key: string): string {
  if (key.endsWith("ies")) return `${key.slice(0, -3)}y`;
  if (key.endsWith("ses")) return key.slice(0, -2);
  if (key.endsWith("s")) return key.slice(0, -1);
  return key;
}

/** Nhãn tiếng Việt cho `object_type`; giá trị lạ được tách gạch dưới cho đọc được. */
export function auditObjectTypeLabel(
  objectType: string | null | undefined,
): string {
  const key = normalizeObjectType(String(objectType ?? ""));
  if (!key) return EMPTY_TEXT;
  const direct = OBJECT_TYPE_LABELS[key as keyof typeof OBJECT_TYPE_LABELS];
  if (direct) return direct;
  const singular = singularize(key);
  const bySingular =
    OBJECT_TYPE_LABELS[singular as keyof typeof OBJECT_TYPE_LABELS];
  if (bySingular) return bySingular;
  return spellOutEnumCode(key);
}

/* -------------------------------------------------------------------------- */
/* Màu badge hành động (dùng chung bảng + Dialog chi tiết)                      */
/* -------------------------------------------------------------------------- */

const ACTION_TONES: Record<string, UiStatusTone> = {
  CREATE: "success",
  RESTORE: "success",
  LOGIN: "success",
  POST: "success",
  POST_ISSUE: "success",
  POST_RECEIPT: "success",
  POST_COMPONENT_ISSUE: "success",
  REVERSAL_POST: "success",
  PUTAWAY_CONFIRM: "success",
  APPROVE: "success",
  WARRANTY_CASE_RECEIVED: "success",
  ITEM_REGISTERED_AT_POST_RECEIPT: "success",
  UPDATE: "info",
  SUBMIT: "info",
  CREATE_INBOUND: "info",
  CREATE_OUTBOUND: "info",
  CREATE_COMPONENT_ISSUE: "info",
  CREATE_REVERSAL: "info",
  SCAN: "info",
  SCAN_INBOUND: "info",
  SWITCH_CONTEXT: "info",
  TOKEN_REFRESH: "info",
  REPORT_EXPORTED: "info",
  PV_PRODUCT_IMAGE_UPLOADED: "info",
  DELETE: "error",
  CANCEL: "error",
  REJECT: "error",
  REVERSAL_CANCELLED: "error",
  LOGIN_DENIED: "error",
  LOGIN_FAILED: "error",
  TOKEN_REFRESH_FAILED: "error",
  AUTHZ_PERMISSION_DENIED: "error",
  RECORD_LOSS: "error",
  REVOKE_ROLE_SCOPE: "warning",
  REVOKE_USER_PERMISSION: "warning",
  CHANGE_PASSWORD: "warning",
  AUTO_LOCK: "warning",
  WARRANTY_STATUS_CHANGE: "warning",
  SYNC_ROLE_SCOPES: "primary",
  ASSIGN_ROLES: "primary",
  ASSIGN_PERMISSIONS: "primary",
  GRANT_USER_PERMISSION: "primary",
  ARCHIVE: "neutral",
  LOGOUT: "neutral",
};

export function auditActionTone(action: string): UiStatusTone {
  return ACTION_TONES[action] ?? "neutral";
}

/** Nhãn hành động; action lạ được tách gạch dưới thay vì rơi về "Khác". */
export function auditActionLabel(action: string | null | undefined): string {
  const raw = String(action ?? "").trim();
  if (!raw) return EMPTY_TEXT;
  return businessLabel(AUDIT_ACTION_LABELS, raw, spellOutEnumCode(raw));
}

/** Cột `result` (SUCCESS/FAILED/DENIED) — hiện dùng ở file Excel xuất ra. */
const RESULT_LABELS = bilingual(
  { SUCCESS: "Thành công", FAILED: "Lỗi", DENIED: "Bị từ chối" },
  { SUCCESS: "Success", FAILED: "Failed", DENIED: "Denied" },
);

export function auditResultLabel(result: string | null | undefined): string {
  const raw = String(result ?? "").trim();
  if (!raw) return "";
  return enumLabelOrText(RESULT_LABELS, raw);
}

/* -------------------------------------------------------------------------- */
/* Câu mô tả                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Vài `reason` do BE ghi bằng tiếng Anh/kỹ thuật (DenyAuditRecorder, luồng
 * đăng nhập). Dịch đúng những câu đang có thật trong DB, phần còn lại giữ
 * nguyên vì đó là lý do do người dùng nhập.
 */
const REASON_TEXTS = bilingual(
  {
    "Invalid credentials": "Sai tài khoản hoặc mật khẩu",
    "Invalid, expired, revoked or replayed refresh token":
      "Phiên đăng nhập không còn hiệu lực",
  },
  {
    "Invalid credentials": "Invalid credentials",
    "Invalid, expired, revoked or replayed refresh token":
      "Sign-in session is no longer valid",
  },
);

const MISSING_PERMISSION_PREFIX = bilingual(
  { label: "Thiếu quyền" },
  { label: "Missing permission" },
);

/** Chuẩn hoá `reason` về câu người đọc được (rỗng → null). */
export function auditReasonText(
  reason: string | null | undefined,
): string | null {
  const raw = String(reason ?? "").trim();
  if (!raw) return null;
  const mapped = REASON_TEXTS[raw as keyof typeof REASON_TEXTS];
  if (mapped) return mapped;
  // BE ghi "Thiếu permission: iam.user.view" — mã quyền giữ nguyên (đúng quy
  // ước: mã quyền/endpoint là dữ liệu tra soát), chỉ chữ "permission" đổi.
  const denied = raw.match(/^Thiếu permission:\s*(.+)$/u);
  if (denied) return `${MISSING_PERMISSION_PREFIX.label}: ${denied[1]}`;
  return raw;
}

/**
 * Mã nghiệp vụ của đối tượng nếu BE có ghi kèm trong `after_data` (số chứng
 * từ là thứ nhân viên kho tra cứu được, khác hẳn UUID). Không có thì rút gọn
 * `object_id` — không bao giờ nối nguyên 36 ký tự UUID vào câu.
 */
function auditObjectRef(log: AuditLog): string | null {
  const after = log.after_data ?? {};
  for (const key of ["doc_no", "code", "sku_code", "serial"]) {
    const value = after[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return log.object_id ? shortId(log.object_id) : null;
}

/**
 * Câu mô tả hiển thị thay cho `log.description` của BE.
 * VD: `POST_ISSUE stock_document #ecd447d4-...` → "Ghi nhận xuất kho —
 * Phiếu nhập/xuất kho PX-COV-00038".
 */
export function describeAuditLog(log: AuditLog): string {
  const parts = [auditActionLabel(log.action)];
  const objectLabel = log.object_type
    ? auditObjectTypeLabel(log.object_type)
    : "";
  const ref = auditObjectRef(log);
  if (objectLabel) parts.push(ref ? `${objectLabel} ${ref}` : objectLabel);
  const sentence = parts.filter(Boolean).join(" — ");
  const reason = auditReasonText(log.reason);
  return reason ? `${sentence}: ${reason}` : sentence;
}

/* -------------------------------------------------------------------------- */
/* Dữ liệu trước / sau thay đổi                                                */
/* -------------------------------------------------------------------------- */

/** Tên trường JSON → nhãn. Khoá lấy từ dữ liệu thật (khảo sát DB 2026-09-07). */
const DATA_FIELD_LABELS = bilingual(
  {
    status: "Trạng thái",
    original_document_status: "Trạng thái phiếu gốc",
    box_status: "Trạng thái hộp linh kiện",
    account_status: "Trạng thái tài khoản",
    physical_return_status: "Tình trạng hàng quay lại kho",
    scan_result: "Kết quả quét",
    doc_no: "Số chứng từ",
    document_id: "Định danh chứng từ",
    original_document_id: "Định danh phiếu gốc",
    item_id: "Định danh hiện vật",
    sku_id: "Định danh SKU",
    physical_code_id: "Định danh mã dán trên hàng",
    movement_ids: "Biến động tồn phát sinh",
    lines: "Dòng hàng",
    version: "Phiên bản bản ghi",
    item_unique: "Quản lý theo từng hiện vật",
    encoded_payload_version: "Phiên bản mã QR",
    inbound_quantity_source: "Nguồn số lượng nhập",
    rfid_gate: "Cổng RFID",
    purpose: "Mục đích",
    stock_effect: "Ảnh hưởng tồn kho",
    reason: "Lý do",
    error_code: "Mã lỗi",
    permission_required: "Quyền cần có",
    route: "Đường dẫn API",
    method: "Phương thức gọi",
    token_fingerprint: "Dấu nhận dạng phiên",
    identity_field: "Định danh đăng nhập",
    account_found: "Tài khoản có tồn tại",
    email: "Email",
    report: "Báo cáo",
    row_count: "Số dòng dữ liệu",
    filters: "Bộ lọc đã dùng",
    storage_disk: "Nơi lưu tệp",
    storage_key: "Khóa lưu tệp",
    file_size_bytes: "Dung lượng tệp",
    content_type: "Định dạng nội dung",
    mime_type: "Định dạng tệp",
    code: "Mã",
    quantity: "Số lượng",
  },
  {
    status: "Status",
    original_document_status: "Source document status",
    box_status: "Component box status",
    account_status: "Account status",
    physical_return_status: "Physical return status",
    scan_result: "Scan result",
    doc_no: "Document no.",
    document_id: "Document id",
    original_document_id: "Source document id",
    item_id: "Item id",
    sku_id: "SKU id",
    physical_code_id: "Physical code id",
    movement_ids: "Stock movements created",
    lines: "Document lines",
    version: "Record version",
    item_unique: "Tracked per item",
    encoded_payload_version: "QR payload version",
    inbound_quantity_source: "Inbound quantity source",
    rfid_gate: "RFID gate",
    purpose: "Purpose",
    stock_effect: "Stock effect",
    reason: "Reason",
    error_code: "Error code",
    permission_required: "Permission required",
    route: "API route",
    method: "HTTP method",
    token_fingerprint: "Session fingerprint",
    identity_field: "Sign-in identifier",
    account_found: "Account exists",
    email: "Email",
    report: "Report",
    row_count: "Row count",
    filters: "Filters used",
    storage_disk: "Storage disk",
    storage_key: "Storage key",
    file_size_bytes: "File size",
    content_type: "Content type",
    mime_type: "File type",
    code: "Code",
    quantity: "Quantity",
  },
);

/**
 * Trạng thái xuất hiện trong `before_data`/`after_data` gộp từ nhiều bảng
 * (chứng từ kho, hồ sơ bảo hành, hộp linh kiện). Viết tay cả hai thứ tiếng —
 * KHÔNG spread các map status sẵn có (spread làm đóng băng ngôn ngữ).
 */
const AUDIT_STATUS_LABELS = bilingual(
  {
    DRAFT: "Nháp",
    SCANNING: "Đang quét",
    POSTED: "Đã ghi sổ",
    CANCELLED: "Đã hủy",
    CHECKING: "Đang kiểm tra",
    RECEIVED: "Đã tiếp nhận",
    REPAIRING: "Đang sửa chữa",
    RETURNED: "Đã trả lại",
    COMPLETED: "Đã hoàn tất",
    CONFIRMED: "Đã xác nhận",
    PENDING_RETURN: "Chờ hàng quay lại kho",
    STORED: "Đã lưu kho",
    ACTIVE: "Đang hoạt động",
    INACTIVE: "Tạm ngưng",
    LOCKED: "Đã khóa",
  },
  {
    DRAFT: "Draft",
    SCANNING: "Scanning",
    POSTED: "Posted",
    CANCELLED: "Cancelled",
    CHECKING: "Under inspection",
    RECEIVED: "Received",
    REPAIRING: "Under repair",
    RETURNED: "Returned",
    COMPLETED: "Completed",
    CONFIRMED: "Confirmed",
    PENDING_RETURN: "Awaiting return to warehouse",
    STORED: "Stored",
    ACTIVE: "Active",
    INACTIVE: "Suspended",
    LOCKED: "Locked",
  },
);

const INBOUND_QUANTITY_SOURCE_LABELS = bilingual(
  {
    ACTUAL_SCAN: "Theo số lượng quét thực tế",
    DECLARED: "Theo số lượng khai báo",
  },
  { ACTUAL_SCAN: "Actual scanned quantity", DECLARED: "Declared quantity" },
);

const RFID_GATE_LABELS = bilingual(
  { OPTIONAL: "Không bắt buộc", REQUIRED: "Bắt buộc", DISABLED: "Không dùng" },
  { OPTIONAL: "Optional", REQUIRED: "Required", DISABLED: "Disabled" },
);

const PURPOSE_LABELS = bilingual(
  {
    WARRANTY: "Bảo hành",
    SALE: "Bán hàng",
    INTERNAL: "Sử dụng nội bộ",
    REPAIR: "Sửa chữa",
  },
  {
    WARRANTY: "Warranty",
    SALE: "Sale",
    INTERNAL: "Internal use",
    REPAIR: "Repair",
  },
);

const STOCK_EFFECT_LABELS = bilingual(
  {
    NONE: "Không đổi tồn",
    INCREASE: "Tăng tồn",
    DECREASE: "Giảm tồn",
  },
  {
    NONE: "No stock change",
    INCREASE: "Stock increase",
    DECREASE: "Stock decrease",
  },
);

const ERROR_CODE_LABELS = bilingual(
  {
    ACCESS_DENIED: "Không đủ quyền truy cập",
    NOT_FOUND: "Không tìm thấy dữ liệu",
    VALIDATION_FAILED: "Dữ liệu không hợp lệ",
    CONFLICT: "Dữ liệu đã bị thay đổi bởi người khác",
  },
  {
    ACCESS_DENIED: "Access denied",
    NOT_FOUND: "Not found",
    VALIDATION_FAILED: "Validation failed",
    CONFLICT: "Conflicting concurrent change",
  },
);

const IDENTITY_FIELD_LABELS = bilingual(
  { EMAIL: "Email", USERNAME: "Tên đăng nhập", PHONE: "Số điện thoại" },
  { EMAIL: "Email", USERNAME: "Username", PHONE: "Phone number" },
);

const STORAGE_DISK_LABELS = bilingual(
  {
    S3: "Lưu trữ đám mây (S3/MinIO)",
    LOCAL: "Máy chủ nội bộ",
    PUBLIC: "Thư mục công khai",
  },
  {
    S3: "Object storage (S3/MinIO)",
    LOCAL: "Local server",
    PUBLIC: "Public folder",
  },
);

/** Trường nào tra bảng nhãn nào. */
const VALUE_LABELS: Record<string, Readonly<Record<string, string>>> = {
  status: AUDIT_STATUS_LABELS,
  original_document_status: AUDIT_STATUS_LABELS,
  box_status: AUDIT_STATUS_LABELS,
  account_status: IAM_USER_STATUS_LABELS,
  physical_return_status: PHYSICAL_RETURN_STATUS_LABELS,
  scan_result: SCAN_RESULT_LABELS,
  inbound_quantity_source: INBOUND_QUANTITY_SOURCE_LABELS,
  rfid_gate: RFID_GATE_LABELS,
  purpose: PURPOSE_LABELS,
  stock_effect: STOCK_EFFECT_LABELS,
  error_code: ERROR_CODE_LABELS,
  identity_field: IDENTITY_FIELD_LABELS,
  storage_disk: STORAGE_DISK_LABELS,
};

/**
 * Trường là ĐỊNH DANH kỹ thuật: rút gọn thay vì in nguyên UUID.
 * (`storage_key` là đường dẫn tệp, cũng dài và không có nghĩa với người đọc.)
 */
const ID_FIELDS = new Set([
  "document_id",
  "original_document_id",
  "item_id",
  "sku_id",
  "physical_code_id",
  "physical_code",
  "token_fingerprint",
  "storage_key",
]);

/**
 * Trường giữ NGUYÊN VĂN: mã quyền, endpoint, số chứng từ, định dạng tệp —
 * đúng quy ước "giữ nguyên tên trường API / mã quyền / endpoint khi in ra màn".
 */
const RAW_FIELDS = new Set([
  "doc_no",
  "code",
  "route",
  "method",
  "permission_required",
  "email",
  "content_type",
  "mime_type",
  "report",
  "encoded_payload_version",
]);

const YES_NO_LABELS = bilingual(
  { yes: "Có", no: "Không" },
  { yes: "Yes", no: "No" },
);

const COUNT_UNITS = bilingual(
  { items: "mục", movements: "biến động tồn", lines: "dòng" },
  { items: "items", movements: "stock movements", lines: "rows" },
);

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatQuantity(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatQuantity(bytes / 1024)} KB`;
  return `${formatQuantity(bytes / (1024 * 1024))} MB`;
}

function formatScalar(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_TEXT;
  if (typeof value === "boolean") {
    return value ? YES_NO_LABELS.yes : YES_NO_LABELS.no;
  }
  if (typeof value === "number") {
    return key === "file_size_bytes"
      ? formatBytes(value)
      : formatQuantity(value);
  }
  const raw = String(value).trim();
  if (RAW_FIELDS.has(key)) return raw;
  if (ID_FIELDS.has(key) || UUID_SHAPE.test(raw)) return shortId(raw);
  const map = VALUE_LABELS[key];
  if (map) return enumLabelOrText(map, raw);
  return enumLabelOrText({}, raw);
}

function formatValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_TEXT;
    const unit =
      key === "movement_ids"
        ? COUNT_UNITS.movements
        : key === "lines"
          ? COUNT_UNITS.lines
          : COUNT_UNITS.items;
    const allTechnical = value.every(
      (item) =>
        typeof item === "string" && (UUID_SHAPE.test(item) || item.length > 20),
    );
    if (
      allTechnical ||
      value.some((item) => item && typeof item === "object")
    ) {
      return `${formatQuantity(value.length)} ${unit}`;
    }
    return value.map((item) => formatScalar(key, item)).join(", ");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return EMPTY_TEXT;
    return entries
      .map(
        ([childKey, childValue]) =>
          `${auditDataFieldLabel(childKey)}: ${formatValue(childKey, childValue)}`,
      )
      .join("; ");
  }
  return formatScalar(key, value);
}

/** Nhãn tiếng Việt cho tên trường JSON; trường lạ được tách gạch dưới. */
export function auditDataFieldLabel(key: string): string {
  const label = DATA_FIELD_LABELS[key as keyof typeof DATA_FIELD_LABELS];
  return label ?? spellOutEnumCode(key);
}

export interface AuditDataEntry {
  key: string;
  label: string;
  value: string;
}

/**
 * Thứ tự đọc: nghiệp vụ trước (trạng thái, số chứng từ...), kỹ thuật sau
 * (định danh, phiên bản, tệp) — phần còn lại giữ nguyên thứ tự BE trả về.
 */
const FIELD_ORDER = [
  "status",
  "original_document_status",
  "box_status",
  "account_status",
  "physical_return_status",
  "scan_result",
  "doc_no",
  "quantity",
  "lines",
  "movement_ids",
  "purpose",
  "stock_effect",
  "inbound_quantity_source",
  "rfid_gate",
  "reason",
  "error_code",
  "permission_required",
  "route",
  "method",
  "report",
  "row_count",
  "filters",
];

/** JSON thô → danh sách "tên trường tiếng Việt – giá trị đã dịch". */
export function auditDataEntries(
  data: Record<string, unknown> | null | undefined,
): AuditDataEntry[] {
  if (!data) return [];
  const keys = Object.keys(data);
  const ordered = [
    ...FIELD_ORDER.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !FIELD_ORDER.includes(key)),
  ];
  return ordered.map((key) => ({
    key,
    label: auditDataFieldLabel(key),
    value: formatValue(key, data[key]),
  }));
}
