import { useLanguageStore } from "@/shared/i18n/language.store";
import { chineseBusinessLabel } from "@/shared/i18n/chinese-messages";

/**
 * NHÃN NGHIỆP VỤ do BE trả về (status/severity/loại chứng từ...) — không nằm
 * trong messages.ts (xem đầu file đó) vì khoá là GIÁ TRỊ ENUM của BE chứ không
 * phải khoá giao diện.
 *
 * Mỗi map bọc qua `bilingual(vi, en)` — một Proxy đọc ngôn ngữ hiện tại tại THỜI ĐIỂM TRUY CẬP.
 * Với ZH, nhãn EN được tra tiếp trong danh mục tải cùng từ điển tiếng Trung.
 * thuộc tính. Nhờ vậy cả `businessLabel(...)` lẫn ~70 chỗ đang index thẳng
 * (`INBOUND_STATUS_LABELS[x]`, `Object.entries(...)` dựng options) đều tự đổi
 * ngôn ngữ mà KHÔNG phải sửa call site nào; App remount theo `key={language}`
 * đảm bảo mọi chỗ đọc lại sau khi đổi.
 *
 * Hai điều cấm để cơ chế này không thủng:
 *  1. KHÔNG spread một map ra hằng cấp module (`const X = { ...MAP }`) — spread
 *     sao chép giá trị theo ngôn ngữ lúc import và đóng băng ở đó. Cần map gộp
 *     thì gộp phần VI/EN riêng rồi bọc `bilingual` lần nữa (xem report-labels.ts).
 *  2. Map mới thêm vào file này BẮT BUỘC đủ bản EN và thêm nhãn ZH tương ứng — thiếu bản dịch sẽ rơi về nhãn cũ
 *     (fail-safe cùng lối messages.ts) nhưng đó chính là "điểm chết" đã bị báo.
 */
export function bilingual<T extends Record<string, string>>(
  vi: T,
  en: Record<keyof T & string, string>,
): Readonly<T> {
  return new Proxy(vi, {
    get(target, prop, receiver) {
      if (
        typeof prop === "string" &&
        useLanguageStore.getState().language !== "vi"
      ) {
        const translated = (en as Record<string, string>)[prop];
        if (translated !== undefined) {
          return useLanguageStore.getState().language === "zh"
            ? chineseBusinessLabel(translated)
            : translated;
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Readonly<T>;
}

const UNKNOWN_BY_LANGUAGE = {
  vi: "Chưa xác định",
  en: "Unknown",
  zh: "未知",
} as const;

/** Live binding (`export let`) — đọc tại thời điểm dùng, đổi theo ngôn ngữ. */
export let UNKNOWN_BUSINESS_LABEL: string =
  UNKNOWN_BY_LANGUAGE[useLanguageStore.getState().language] ??
  UNKNOWN_BY_LANGUAGE.vi;

useLanguageStore.subscribe((state) => {
  UNKNOWN_BUSINESS_LABEL =
    UNKNOWN_BY_LANGUAGE[state.language] ?? UNKNOWN_BY_LANGUAGE.vi;
});

export function businessLabel(
  labels: Readonly<Record<string, string>>,
  value: string | null | undefined,
  fallback?: string,
): string {
  const key = String(value ?? "").trim();
  if (!key) return fallback ?? UNKNOWN_BUSINESS_LABEL;
  return labels[key] ?? fallback ?? UNKNOWN_BUSINESS_LABEL;
}

/** HOA + ít nhất một gạch dưới — hình dạng mã enum của BE. */
const ENUM_CODE_SHAPE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u;

/** `OPENING_BALANCE` → `Opening Balance`. Chỉ dùng khi CHƯA có nhãn. */
export function spellOutEnumCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Nhãn cho cột VỪA chứa enum của BE VỪA có thể chứa chữ người dùng tự gõ
 * (`agencies.market`, `reversal_documents.reason_code`… đều là VARCHAR tự do).
 *
 * Khác `businessLabel` ở chỗ KHÔNG quy mọi thứ lạ về “Chưa xác định”:
 *  1. trùng bảng nhãn (bỏ qua hoa/thường) → nhãn;
 *  2. trông như mã → tách gạch dưới cho đọc được, vẫn tra soát được;
 *  3. còn lại → giữ nguyên từng ký tự, vì đó là chữ người dùng đã nhập.
 */
export function enumLabelOrText(
  labels: Readonly<Record<string, string>>,
  value: string | null | undefined,
): string {
  const raw = String(value ?? "").trim();
  if (raw === "") return "";
  const mapped = labels[raw.toUpperCase()];
  if (mapped !== undefined) return mapped;
  if (ENUM_CODE_SHAPE.test(raw)) return spellOutEnumCode(raw);
  return raw;
}

export const INBOUND_STATUS_LABELS = bilingual(
  {
    DRAFT: "Nháp",
    SCANNING: "Đang quét nhận hàng",
    POSTED: "Đã nhập kho",
    CANCELLED: "Đã hủy",
  },
  {
    DRAFT: "Draft",
    SCANNING: "Receiving scan in progress",
    POSTED: "Received into stock",
    CANCELLED: "Cancelled",
  },
);

export const OUTBOUND_STATUS_LABELS = bilingual(
  {
    DRAFT: "Nháp",
    SCANNING: "Đang quét xuất hàng",
    POSTED: "Đã xuất kho",
    CANCELLED: "Đã hủy",
  },
  {
    DRAFT: "Draft",
    SCANNING: "Issue scan in progress",
    POSTED: "Issued from stock",
    CANCELLED: "Cancelled",
  },
);

export const SCAN_RESULT_LABELS = bilingual(
  {
    VALID: "Hợp lệ",
    DUPLICATE: "Đã quét trước đó",
    UNKNOWN: "Không nhận diện được",
    INVALID: "Không hợp lệ",
  },
  {
    VALID: "Valid",
    DUPLICATE: "Already scanned",
    UNKNOWN: "Not recognized",
    INVALID: "Invalid",
  },
);

export const NOTIFICATION_SEVERITY_LABELS = bilingual(
  {
    info: "Thông tin",
    warning: "Cảnh báo",
    critical: "Nghiêm trọng",
  },
  {
    info: "Info",
    warning: "Warning",
    critical: "Critical",
  },
);

export const SCAN_ENTRY_STATUS_LABELS = bilingual(
  {
    ACTIVE: "Đang hiệu lực",
    REMOVED: "Đã bỏ khỏi phiếu",
  },
  {
    ACTIVE: "Active",
    REMOVED: "Removed from document",
  },
);

export const SCAN_BATCH_STATUS_LABELS = bilingual(
  {
    OPEN: "Đang mở",
    CLASSIFIED: "Đã phân loại",
    PARTIALLY_POSTED: "Đã ghi nhận một phần",
    CLOSED: "Đã đóng",
    CANCELLED: "Đã hủy",
  },
  {
    OPEN: "Open",
    CLASSIFIED: "Classified",
    PARTIALLY_POSTED: "Partially posted",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  },
);

export const QR_RESOLUTION_STATUS_LABELS = bilingual(
  {
    NEW_ITEM_CANDIDATE: "Sản phẩm mới chờ ghi nhận",
    EXISTING_ITEM: "Sản phẩm đã có trong hệ thống",
    LEGACY_ITEM: "Sản phẩm từ dữ liệu cũ",
  },
  {
    NEW_ITEM_CANDIDATE: "New item awaiting registration",
    EXISTING_ITEM: "Item already in the system",
    LEGACY_ITEM: "Item from legacy data",
  },
);

export const SCAN_CONTEXT_LABELS = bilingual(
  {
    INBOUND: "Nhập kho",
    OUTBOUND: "Xuất kho",
    INVENTORY: "Tồn kho",
    TRACE: "Tra cứu nguồn gốc",
    WARRANTY_RECEIVE: "Tiếp nhận bảo hành",
    WARRANTY_TEMP_ONLY: "Tiếp nhận bảo hành tạm",
  },
  {
    INBOUND: "Inbound",
    OUTBOUND: "Outbound",
    INVENTORY: "Inventory",
    TRACE: "Traceability lookup",
    WARRANTY_RECEIVE: "Warranty intake",
    WARRANTY_TEMP_ONLY: "Temporary warranty intake",
  },
);

export const SCAN_CLASSIFICATION_LABELS = bilingual(
  {
    ITEM: "Sản phẩm cụ thể",
    CONTAINER: "Vật chứa",
    SKU: "SKU",
  },
  {
    ITEM: "Specific item",
    CONTAINER: "Container",
    SKU: "SKU",
  },
);

export const CONTAINER_TYPE_LABELS = bilingual(
  {
    CARTON: "Thùng carton",
    BOX: "Hộp",
    TRAY: "Khay",
  },
  {
    CARTON: "Carton",
    BOX: "Box",
    TRAY: "Tray",
  },
);

/**
 * Trạng thái của VẬT CHỨA (khay/hộp) từ API container — trước đây không có
 * map nào nên chip "Khay đã chọn" in thẳng STORED/ACTIVE ra màn nghiệp vụ
 * (UAT TC_UI_08). Giá trị lạ đi qua enumLabelOrText để không bao giờ lộ
 * SCREAMING_SNAKE.
 */
export const CONTAINER_STATUS_LABELS = bilingual(
  {
    EMPTY: "Trống",
    PARTIAL: "Đang chứa",
    STORED: "Đang chứa hàng",
    ACTIVE: "Đang sử dụng",
    FULL: "Đã đầy",
    CLOSED: "Đã đóng",
    ISSUED: "Đã xuất",
  },
  {
    EMPTY: "Empty",
    PARTIAL: "Partially filled",
    STORED: "Holding stock",
    ACTIVE: "In use",
    FULL: "Full",
    CLOSED: "Closed",
    ISSUED: "Issued",
  },
);

/**
 * Lý do điều chỉnh tồn — `reversal_documents.reason_code`. BE tự đặt
 * `CORRECTION` cho mọi phiếu tạo qua API, `MANUAL` đến từ dữ liệu dựng sẵn;
 * cột khai `nullable|string|max:80` nên vẫn phải chịu được giá trị lạ.
 */
export const REVERSAL_REASON_LABELS = bilingual(
  {
    CORRECTION: "Điều chỉnh sai sót",
    MANUAL: "Điều chỉnh thủ công",
  },
  {
    CORRECTION: "Correction",
    MANUAL: "Manual adjustment",
  },
);

export const REVERSAL_STATUS_LABELS = bilingual(
  {
    DRAFT: "Nháp · chưa thay đổi tồn kho",
    POSTED: "Đã ghi sổ phiếu đảo",
    CANCELLED: "Đã hủy",
  },
  {
    DRAFT: "Draft · stock not changed yet",
    POSTED: "Stock adjustment posted",
    CANCELLED: "Cancelled",
  },
);

export const PHYSICAL_RETURN_STATUS_LABELS = bilingual(
  {
    PENDING_RETURN: "Chờ hàng quay lại kho",
    CONFIRMED: "Đã xác nhận hàng về kho",
  },
  {
    PENDING_RETURN: "Awaiting return to warehouse",
    CONFIRMED: "Return to warehouse confirmed",
  },
);

export const RETURN_CONDITION_LABELS = bilingual(
  {
    SELLABLE: "Có thể bán/xuất lại",
    DEFECTIVE: "Hàng lỗi",
    NON_SELLABLE: "Không thể bán/xuất",
  },
  {
    SELLABLE: "Sellable / issuable again",
    DEFECTIVE: "Defective",
    NON_SELLABLE: "Not sellable / issuable",
  },
);

/**
 * Mã lỗi của luồng NHẬP DỮ LIỆU (import SKU) và ĐỐI SOÁT yêu cầu xuất —
 * RPT-04 hiển thị ở "Mã lỗi nhiều nhất" và cột "Mã lỗi" của chi tiết lô
 * (UAT TC_UI_19: từng in thẳng SKU_CODE_DUPLICATE, QTY_EXCEEDS_STOCK…).
 * Nguồn mã: ImportErrorFileService (BE) + error_code của match lines; mã lạ
 * đi qua enumLabelOrText nên không bao giờ lộ SCREAMING_SNAKE.
 */
export const IMPORT_MATCH_ERROR_LABELS = bilingual(
  {
    SKU_CODE_DUPLICATE: "Mã SKU đã tồn tại trong hệ thống",
    DUPLICATE_CODE: "Mã SKU đã tồn tại trong hệ thống",
    DUPLICATE_SKU_CODE_IN_FILE: "Trùng mã SKU ngay trong tệp",
    MISSING_REQUIRED_FIELD: "Thiếu trường bắt buộc",
    MODEL_REQUIRED: "Thiếu mã model bắt buộc",
    INVALID_CODE_FORMAT: "Mã SKU sai định dạng",
    INVALID_NAME: "Tên SKU không hợp lệ",
    INVALID_CATEGORY: "Nhóm hàng không hợp lệ",
    INVALID_BRAND: "Thương hiệu không hợp lệ",
    INVALID_TRACKING_MODE: "Kiểu theo dõi không hợp lệ",
    INVALID_UNIT: "Đơn vị tính không hợp lệ",
    INVALID_ENUM: "Giá trị ngoài danh sách cho phép",
    INVALID_BOOLEAN: "Giá trị đúng/sai không hợp lệ",
    INVALID_VERSION_CODE: "Mã phiên bản quá dài",
    INACTIVE_SKU_CONFLICT: "SKU đang ngừng sử dụng",
    UNKNOWN_MASTER_CODE: "Mã danh mục không tồn tại",
    SKU_NOT_FOUND: "Không tìm thấy SKU",
    QTY_EXCEEDS_STOCK: "Số lượng vượt tồn khả dụng",
    SKU_ALREADY_MATCHED: "SKU đã được đối soát trước đó",
    DUPLICATE_REQUEST_NO: "Trùng số yêu cầu xuất",
    ERROR: "Lỗi xử lý dòng",
    UNKNOWN: "Lỗi chưa phân loại",
  },
  {
    SKU_CODE_DUPLICATE: "SKU code already exists",
    DUPLICATE_CODE: "SKU code already exists",
    DUPLICATE_SKU_CODE_IN_FILE: "Duplicate SKU code within the file",
    MISSING_REQUIRED_FIELD: "Missing required field",
    MODEL_REQUIRED: "Model code is required",
    INVALID_CODE_FORMAT: "Invalid SKU code format",
    INVALID_NAME: "Invalid SKU name",
    INVALID_CATEGORY: "Invalid category",
    INVALID_BRAND: "Invalid brand",
    INVALID_TRACKING_MODE: "Invalid tracking mode",
    INVALID_UNIT: "Invalid unit",
    INVALID_ENUM: "Value outside the allowed list",
    INVALID_BOOLEAN: "Invalid true/false value",
    INVALID_VERSION_CODE: "Version code too long",
    INACTIVE_SKU_CONFLICT: "SKU is inactive",
    UNKNOWN_MASTER_CODE: "Master data code not found",
    SKU_NOT_FOUND: "SKU not found",
    QTY_EXCEEDS_STOCK: "Quantity exceeds available stock",
    SKU_ALREADY_MATCHED: "SKU already matched",
    DUPLICATE_REQUEST_NO: "Duplicate request number",
    ERROR: "Row processing error",
    UNKNOWN: "Unclassified error",
  },
);

/**
 * Nguyên nhân lệch đối soát tồn (mismatch_reason của /inventory/balances và
 * /reports/inventory-reconciliation). UAT TC_UI_11: mã máy
 * BALANCE_NOT_EQUAL_SIGNED_LEDGER_SUM từng in thẳng cạnh chip "Có chênh lệch".
 * Giá trị lạ đi qua enumLabelOrText để không bao giờ lộ SCREAMING_SNAKE.
 */
export const RECONCILE_REASON_LABELS = bilingual(
  {
    BALANCE_NOT_EQUAL_SIGNED_LEDGER_SUM: "Số dư không khớp tổng sổ cái",
    BALANCE_MISSING_FOR_LEDGER: "Sổ cái có phát sinh nhưng thiếu số dư",
    LEDGER_MISSING_FOR_BALANCE: "Có số dư nhưng sổ cái không có phát sinh",
    QUANTITY_MISMATCH: "Số lượng không khớp giữa số dư và sổ cái",
  },
  {
    BALANCE_NOT_EQUAL_SIGNED_LEDGER_SUM:
      "Balance differs from signed ledger sum",
    BALANCE_MISSING_FOR_LEDGER: "Ledger has activity but balance is missing",
    LEDGER_MISSING_FOR_BALANCE: "Balance exists but ledger has no activity",
    QUANTITY_MISMATCH: "Quantity differs between balance and ledger",
  },
);

export const INVENTORY_STOCK_STATUS_LABELS = bilingual(
  {
    AVAILABLE: "Khả dụng",
    NON_SELLABLE: "Không thể bán/xuất",
    DEFECTIVE: "Hàng lỗi",
    QUARANTINE: "Chờ kiểm tra",
  },
  {
    AVAILABLE: "Available",
    NON_SELLABLE: "Not sellable / issuable",
    DEFECTIVE: "Defective",
    QUARANTINE: "Pending inspection",
  },
);

export const RECONCILE_STATUS_LABELS = bilingual(
  {
    MATCH: "Khớp",
    PASS: "Khớp",
    MISMATCH: "Có chênh lệch",
    FAIL: "Có chênh lệch",
  },
  {
    MATCH: "Matched",
    PASS: "Matched",
    MISMATCH: "Mismatch found",
    FAIL: "Mismatch found",
  },
);

export const MOVEMENT_TYPE_LABELS = bilingual(
  {
    RECEIPT: "Nhập kho",
    ISSUE: "Xuất kho",
    COMPONENT_ISSUE: "Xuất linh kiện",
    REVERSAL: "Phiếu đảo",
  },
  {
    RECEIPT: "Receipt",
    ISSUE: "Issue",
    COMPONENT_ISSUE: "Component issue",
    REVERSAL: "Stock adjustment",
  },
);

export const MOVEMENT_STATUS_LABELS = bilingual(
  {
    DRAFT: "Nháp",
    POSTED: "Đã ghi nhận",
    REVERSED: "Đã điều chỉnh",
    CANCELLED: "Đã hủy",
  },
  {
    DRAFT: "Draft",
    POSTED: "Posted",
    REVERSED: "Reversed",
    CANCELLED: "Cancelled",
  },
);

export const MOVEMENT_ROLE_LABELS = bilingual(
  {
    ORIGINAL: "Giao dịch gốc",
    REVERSAL: "Giao dịch điều chỉnh",
  },
  {
    ORIGINAL: "Original transaction",
    REVERSAL: "Adjustment transaction",
  },
);

export const SOURCE_DOCUMENT_TYPE_LABELS = bilingual(
  {
    receipt: "Phiếu nhập",
    issue: "Phiếu xuất",
    transfer: "Phiếu chuyển kho",
    inbound: "Phiếu nhập",
    outbound: "Phiếu xuất",
    RECEIPT: "Phiếu nhập",
    ISSUE: "Phiếu xuất",
    COMPONENT_ISSUE: "Phiếu xuất linh kiện",
    REVERSAL: "Phiếu đảo",
  },
  {
    receipt: "Receipt document",
    issue: "Issue document",
    transfer: "Transfer document",
    inbound: "Receipt document",
    outbound: "Issue document",
    RECEIPT: "Receipt document",
    ISSUE: "Issue document",
    COMPONENT_ISSUE: "Component issue document",
    REVERSAL: "Stock adjustment document",
  },
);

export const MASTER_STATUS_LABELS = bilingual(
  {
    ACTIVE: "Đang sử dụng",
    INACTIVE: "Ngừng sử dụng",
  },
  {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
  },
);

export const SKU_TYPE_LABELS = bilingual(
  {
    PRODUCT: "Sản phẩm",
    COMPONENT: "Linh kiện",
  },
  {
    PRODUCT: "Product",
    COMPONENT: "Component",
  },
);

export const IAM_USER_STATUS_LABELS = bilingual(
  {
    ACTIVE: "Đang hoạt động",
    INACTIVE: "Tạm ngưng",
    LOCKED: "Đã khóa",
  },
  {
    ACTIVE: "Active",
    INACTIVE: "Suspended",
    LOCKED: "Locked",
  },
);

export const IAM_ROLE_STATUS_LABELS = bilingual(
  {
    ACTIVE: "Đang sử dụng",
    INACTIVE: "Ngừng sử dụng",
  },
  {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
  },
);

export const IAM_SCOPE_LABELS = bilingual(
  {
    SYSTEM: "Toàn hệ thống",
    WAREHOUSE: "Theo kho",
    FUNCTION: "Theo chức năng",
  },
  {
    SYSTEM: "System-wide",
    WAREHOUSE: "Per warehouse",
    FUNCTION: "Per function",
  },
);

export const IAM_SCOPE_TYPE_LABELS = IAM_SCOPE_LABELS;

export const PV_STOCK_STATUS_LABELS = bilingual(
  {
    IN_STOCK: "Còn hàng",
    OUT_OF_STOCK: "Chưa có hàng",
  },
  {
    IN_STOCK: "In stock",
    OUT_OF_STOCK: "Out of stock",
  },
);

export const PUTAWAY_STATUS_LABELS = bilingual(
  {
    RECEIVED_PENDING_PUTAWAY: "Chờ xếp khay",
    STORED: "Đã xếp khay",
  },
  {
    RECEIVED_PENDING_PUTAWAY: "Awaiting putaway",
    STORED: "Stored in tray",
  },
);

export const STOCK_REQUEST_STATUS_LABELS = bilingual(
  {
    draft: "Nháp",
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Đã từ chối",
    converted: "Đã tạo phiếu kho",
    cancelled: "Đã hủy",
  },
  {
    draft: "Draft",
    pending: "Pending approval",
    approved: "Approved",
    rejected: "Rejected",
    converted: "Warehouse document created",
    cancelled: "Cancelled",
  },
);

export const TRANSFER_STATUS_LABELS = bilingual(
  {
    in_transit: "Đang vận chuyển",
    return_in_transit: "Đang vận chuyển hoàn",
    completed: "Đã hoàn tất",
    completed_with_loss: "Hoàn tất, có thiếu hụt",
    returned: "Đã hoàn trả",
  },
  {
    in_transit: "In transit",
    return_in_transit: "Return in transit",
    completed: "Completed",
    completed_with_loss: "Completed with loss",
    returned: "Returned",
  },
);

export const WARRANTY_IDENTIFICATION_STATUS_LABELS = bilingual(
  {
    IDENTIFIED: "Đã xác định sản phẩm",
    TEMP_ONLY: "Tiếp nhận tạm, chưa xác định sản phẩm",
  },
  {
    IDENTIFIED: "Product identified",
    TEMP_ONLY: "Temporary intake, product not identified",
  },
);

/**
 * Bản rút gọn cho badge trong bảng: cột "Nhận diện" chỉ rộng ~130px mà Chip của
 * MUI không xuống dòng, nhãn đầy đủ sẽ bị cắt "…". Header cột đã nêu ngữ cảnh nên
 * bỏ được phần "sản phẩm"; nhãn đầy đủ vẫn dùng ở modal chi tiết và báo cáo.
 */
export const WARRANTY_IDENTIFICATION_STATUS_SHORT_LABELS = bilingual(
  {
    IDENTIFIED: "Đã xác định",
    TEMP_ONLY: "Tiếp nhận tạm",
  },
  {
    IDENTIFIED: "Identified",
    TEMP_ONLY: "Temporary",
  },
);

export const WARRANTY_TRACE_STATUS_LABELS = bilingual(
  {
    TRACEABLE: "Có thông tin truy xuất",
    NOT_TRACEABLE: "Chưa có thông tin truy xuất",
  },
  {
    TRACEABLE: "Traceability available",
    NOT_TRACEABLE: "No traceability information",
  },
);

export const ITEM_STATUS_LABELS = bilingual(
  {
    NEW: "Mới tạo",
    IN_STOCK: "Đang trong kho",
    ISSUED: "Đã xuất cho khách",
    RETURNED_TO_CUSTOMER: "Đã trả khách",
    IN_WARRANTY: "Đang bảo hành",
    // Hai trạng thái cuối của vòng đời: DB cho phép (chk_erd_item_instances_0)
    // và seeder có sinh, thiếu nhãn thì UI in "Chưa xác định".
    LOST: "Thất lạc",
    ADJUSTED_OUT: "Đã điều chỉnh xuất",
  },
  {
    NEW: "Newly created",
    IN_STOCK: "In stock",
    ISSUED: "Issued to customer",
    RETURNED_TO_CUSTOMER: "Returned to customer",
    IN_WARRANTY: "In warranty",
    LOST: "Lost",
    ADJUSTED_OUT: "Adjusted out",
  },
);

export const WARRANTY_EVENT_TYPE_LABELS = bilingual(
  {
    RECEIVE: "Tiếp nhận",
    CHECK: "Kiểm tra",
    REPAIR: "Sửa chữa",
    COMPLETE: "Hoàn tất",
    RETURN: "Trả khách",
    CANCEL: "Hủy",
    NOTE: "Ghi chú",
    // `warranty_events.event_type` trong DB có cả UPDATE_STATUS (sự kiện đổi
    // trạng thái hồ sơ); thiếu khoá này thì dòng thời gian hiện nguyên mã.
    UPDATE_STATUS: "Đổi trạng thái",
  },
  {
    RECEIVE: "Intake",
    CHECK: "Inspection",
    REPAIR: "Repair",
    COMPLETE: "Completed",
    RETURN: "Returned to customer",
    CANCEL: "Cancelled",
    NOTE: "Note",
    UPDATE_STATUS: "Status change",
  },
);

export const AUDIT_ACTION_LABELS = bilingual(
  {
    CREATE: "Tạo mới",
    UPDATE: "Cập nhật",
    DELETE: "Xóa",
    REVOKE_ROLE_SCOPE: "Thu hồi phạm vi vai trò",
    SYNC_ROLE_SCOPES: "Cập nhật phạm vi vai trò",
    SUBMIT: "Gửi xử lý",
    CANCEL: "Hủy",
    ARCHIVE: "Lưu trữ",
    RESTORE: "Khôi phục",
    // Phiên đăng nhập / bảo mật (mục 13: tra "ai đã vào hệ thống").
    LOGIN: "Đăng nhập",
    LOGOUT: "Đăng xuất",
    LOGIN_DENIED: "Đăng nhập bị từ chối",
    TOKEN_REFRESH: "Làm mới phiên",
    CHANGE_PASSWORD: "Đổi mật khẩu",
    AUTO_LOCK: "Tự động khóa tài khoản",
    // Phân quyền / vai trò.
    ASSIGN_ROLES: "Gán vai trò",
    ASSIGN_PERMISSIONS: "Gán quyền",
    GRANT_USER_PERMISSION: "Cấp quyền riêng",
    REVOKE_USER_PERMISSION: "Thu hồi quyền riêng",
    // Thao tác nghiệp vụ thường gặp.
    POST: "Ghi nhận",
    POST_ISSUE: "Ghi nhận xuất kho",
    SCAN: "Quét mã",
    APPROVE: "Phê duyệt",
    REJECT: "Từ chối",
    RECEIVE: "Tiếp nhận",
    RETURN: "Trả hàng",
    CONFIRM_RETURN: "Xác nhận trả hàng",
    DISPATCH: "Xuất giao",
    CONVERT: "Chuyển đổi",
    RECORD_LOSS: "Ghi nhận thất thoát",
    CREATE_REVERSAL: "Tạo phiếu đảo",
    REVERSAL_POST: "Ghi sổ phiếu đảo",
    PUTAWAY_CONFIRM: "Xác nhận xếp khay",
    WARRANTY_STATUS_CHANGE: "Đổi trạng thái bảo hành",
    REPORT_EXPORTED: "Xuất báo cáo",
    // Nhập/xuất kho, linh kiện — action THẬT đang nằm trong bảng `audit_log`
    // (đếm 2026-09-07: ITEM_REGISTERED_AT_POST_RECEIPT 3815 bản ghi,
    // CREATE_INBOUND 339, POST_RECEIPT 323...). Thiếu các khoá này thì cột
    // "Hành động" rơi hết về "Hành động khác" — mất thông tin chứ không chỉ
    // xấu chữ.
    CREATE_INBOUND: "Tạo phiếu nhập kho",
    POST_RECEIPT: "Ghi sổ nhập kho",
    SCAN_INBOUND: "Quét nhận hàng phiếu nhập",
    ITEM_REGISTERED_AT_POST_RECEIPT: "Ghi nhận hiện vật khi ghi sổ nhập",
    CREATE_OUTBOUND: "Tạo phiếu xuất kho",
    CREATE_COMPONENT_ISSUE: "Tạo phiếu xuất linh kiện",
    POST_COMPONENT_ISSUE: "Ghi sổ xuất linh kiện",
    REVERSAL_CANCELLED: "Hủy phiếu đảo",
    WARRANTY_CASE_RECEIVED: "Tiếp nhận hồ sơ bảo hành",
    PV_PRODUCT_IMAGE_UPLOADED: "Tải ảnh sản phẩm App PV",
    // Phiên làm việc / bảo mật.
    SWITCH_CONTEXT: "Đổi kho làm việc",
    LOGIN_FAILED: "Đăng nhập thất bại",
    TOKEN_REFRESH_FAILED: "Làm mới phiên thất bại",
    AUTHZ_PERMISSION_DENIED: "Từ chối vì thiếu quyền",
    ASSIGN_ITEM_NFC: "Liên kết thẻ NFC",
    BUSINESS_PROFILE_UPDATE: "Cập nhật thông tin công việc",
    CANCEL_COMPONENT_ISSUE: "Hủy phiếu xuất linh kiện",
    CANCEL_STOCK_DOCUMENT: "Hủy phiếu nhập/xuất kho",
    CREATE_RECEIPT_BOX: "Tạo thùng nhận hàng",
    DEVTEST_BOX_COMPONENT_SKU_ACTIVATED: "Kích hoạt SKU linh kiện cho kiểm thử",
    DEVTEST_P18_READ_ROLE_GRANTED:
      "Cấp quyền xem vị trí linh kiện cho kiểm thử",
    DOCUMENT_ATTACHMENT_DELETED: "Xóa tệp đính kèm chứng từ",
    DOCUMENT_ATTACHMENT_DOWNLOADED: "Tải xuống tệp đính kèm chứng từ",
    DOCUMENT_ATTACHMENT_UPLOADED: "Tải lên tệp đính kèm chứng từ",
    IMPORT_ERROR_FILE_PURGE: "Dọn tệp lỗi nhập dữ liệu",
    INBOUND_CREATE_SCAN_DRIVEN: "Tạo phiếu nhập kho từ lượt quét",
    INBOUND_HEADER_UPDATE_SCAN_DRIVEN: "Cập nhật thông tin phiếu nhập kho",
    INBOUND_SKU_INFO_COMPLETED: "Hoàn tất thông tin SKU nhập kho",
    INBOUND_UNSCAN_ACTUAL: "Bỏ ghi nhận lượt quét nhập kho",
    LOGIN_THROTTLED: "Tạm giới hạn đăng nhập",
    MFA_CHALLENGE_ISSUED: "Yêu cầu xác thực hai bước",
    MFA_DISABLED: "Tắt xác thực hai bước",
    MFA_ENABLED: "Bật xác thực hai bước",
    MFA_ENROLL_STARTED: "Bắt đầu thiết lập xác thực hai bước",
    MINI_APP_OUTBOUND_DRAFT_CREATED: "Tạo phiếu xuất nháp trên ứng dụng",
    MINI_APP_RECORD_INBOUND: "Ghi nhận nhập kho trên ứng dụng",
    MINI_APP_RECORD_OUTBOUND: "Ghi nhận xuất kho trên ứng dụng",
    OUTBOUND_IMPORT_CONSUME: "Áp dụng dữ liệu nhập phiếu xuất",
    OUTBOUND_IMPORT_VALIDATE: "Kiểm tra dữ liệu nhập phiếu xuất",
    OUTBOUND_UNMATCH: "Gỡ hàng đã đối chiếu với phiếu xuất",
    P03_DRAFT_CANCEL: "Hủy phiếu nháp",
    P03_DRAFT_RECORD: "Ghi nhận phiếu nháp",
    P03_DRAFT_SAVE: "Lưu phiếu nháp",
    PACKING_LABEL_CREATED: "Tạo nhãn đóng gói",
    PACKING_LABEL_DISCARDED: "Hủy nhãn đóng gói",
    PACKING_LABEL_PREVIEWED: "Xem trước nhãn đóng gói",
    PACKING_LABEL_READY: "Chuẩn bị nhãn đóng gói để in",
    PACKING_LABEL_REPORT_SEEDED: "Tạo dữ liệu mẫu báo cáo in nhãn",
    PASSWORD_RESET: "Đặt lại mật khẩu",
    PASSWORD_RESET_REQUESTED: "Yêu cầu đặt lại mật khẩu",
    PREPARE_ITEM_NFC: "Chuẩn bị liên kết thẻ NFC",
    PUTAWAY_CANCEL: "Hủy phiếu xếp khay",
    PUTAWAY_DRAFT_CREATE: "Tạo phiếu xếp khay nháp",
    PV_PUBLISH: "Công bố sản phẩm trên ứng dụng",
    PV_UNPUBLISH: "Ẩn sản phẩm trên ứng dụng",
    RECIPIENT_CREATE: "Tạo đối tượng nhận hàng",
    RECIPIENT_UPDATE: "Cập nhật đối tượng nhận hàng",
    RECONCILIATION_INCIDENT_DETECTED: "Phát hiện sai lệch đối soát",
    REPORT_EXPORT_FILE_PURGE: "Dọn tệp báo cáo đã xuất",
    REPORT_EXPORT_REQUESTED: "Yêu cầu xuất báo cáo",
    REVERSAL_PHYSICAL_RETURN_CONFIRMED:
      "Xác nhận hàng quay lại kho theo phiếu đảo",
    REVOKE_SESSION: "Thu hồi phiên đăng nhập",
    REVOKE_OTHER_SESSIONS: "Đăng xuất các phiên khác",
    REVOKE_DEVICE: "Thu hồi thiết bị đăng nhập",
    SKU_CREATE: "Tạo SKU",
    SKU_IMPORT_COMMIT: "Áp dụng dữ liệu nhập SKU",
    SKU_IMPORT_CREATE: "Tạo lượt nhập dữ liệu SKU",
    SKU_IMPORT_DRY_RUN_CHECK: "Kiểm tra thử dữ liệu nhập SKU",
    SKU_UPDATE: "Cập nhật SKU",
    UIUX_V2_SCENARIO_SEEDED: "Tạo dữ liệu mẫu giao diện",
    UPDATE_PROFILE: "Cập nhật hồ sơ cá nhân",
    UPDATE_PROFILE_PREFERENCES: "Cập nhật tùy chọn tài khoản",
    WARRANTY_ATTACHMENT_DOWNLOADED: "Tải xuống tệp đính kèm bảo hành",
    WARRANTY_ATTACHMENT_UPLOADED: "Tải lên tệp đính kèm bảo hành",
    WARRANTY_NOTE_ADDED: "Thêm ghi chú bảo hành",
    WARRANTY_REPORT_EXPORTED: "Xuất báo cáo bảo hành",
    WORK_SHIFT_ENDED: "Kết thúc ca làm việc",
    WORK_SHIFT_OWNER_VERIFIED: "Xác minh người phụ trách ca làm việc",
    WORK_SHIFT_STARTED: "Bắt đầu ca làm việc",
  },
  {
    CREATE: "Create",
    UPDATE: "Update",
    DELETE: "Delete",
    REVOKE_ROLE_SCOPE: "Revoke role scope",
    SYNC_ROLE_SCOPES: "Sync role scopes",
    SUBMIT: "Submit",
    CANCEL: "Cancel",
    ARCHIVE: "Archive",
    RESTORE: "Restore",
    LOGIN: "Sign in",
    LOGOUT: "Sign out",
    LOGIN_DENIED: "Sign-in denied",
    TOKEN_REFRESH: "Session refresh",
    CHANGE_PASSWORD: "Change password",
    AUTO_LOCK: "Account auto-locked",
    ASSIGN_ROLES: "Assign roles",
    ASSIGN_PERMISSIONS: "Assign permissions",
    GRANT_USER_PERMISSION: "Grant individual permission",
    REVOKE_USER_PERMISSION: "Revoke individual permission",
    POST: "Post",
    POST_ISSUE: "Post stock issue",
    SCAN: "Scan code",
    APPROVE: "Approve",
    REJECT: "Reject",
    RECEIVE: "Receive",
    RETURN: "Return",
    CONFIRM_RETURN: "Confirm return",
    DISPATCH: "Dispatch",
    CONVERT: "Convert",
    RECORD_LOSS: "Record loss",
    CREATE_REVERSAL: "Create stock adjustment",
    REVERSAL_POST: "Post stock adjustment",
    PUTAWAY_CONFIRM: "Confirm putaway",
    WARRANTY_STATUS_CHANGE: "Change warranty status",
    REPORT_EXPORTED: "Report exported",
    CREATE_INBOUND: "Create inbound document",
    POST_RECEIPT: "Post goods receipt",
    SCAN_INBOUND: "Inbound receiving scan",
    ITEM_REGISTERED_AT_POST_RECEIPT: "Item registered on receipt posting",
    CREATE_OUTBOUND: "Create outbound document",
    CREATE_COMPONENT_ISSUE: "Create component issue",
    POST_COMPONENT_ISSUE: "Post component issue",
    REVERSAL_CANCELLED: "Stock adjustment cancelled",
    WARRANTY_CASE_RECEIVED: "Warranty case received",
    PV_PRODUCT_IMAGE_UPLOADED: "PV product image uploaded",
    SWITCH_CONTEXT: "Switch working warehouse",
    LOGIN_FAILED: "Sign-in failed",
    TOKEN_REFRESH_FAILED: "Session refresh failed",
    AUTHZ_PERMISSION_DENIED: "Denied: missing permission",
    ASSIGN_ITEM_NFC: "Link NFC tag",
    BUSINESS_PROFILE_UPDATE: "Update business profile",
    CANCEL_COMPONENT_ISSUE: "Cancel component issue",
    CANCEL_STOCK_DOCUMENT: "Cancel stock document",
    CREATE_RECEIPT_BOX: "Create receipt box",
    DEVTEST_BOX_COMPONENT_SKU_ACTIVATED: "Activate component SKU for testing",
    DEVTEST_P18_READ_ROLE_GRANTED: "Grant component location test access",
    DOCUMENT_ATTACHMENT_DELETED: "Delete document attachment",
    DOCUMENT_ATTACHMENT_DOWNLOADED: "Download document attachment",
    DOCUMENT_ATTACHMENT_UPLOADED: "Upload document attachment",
    IMPORT_ERROR_FILE_PURGE: "Purge import error file",
    INBOUND_CREATE_SCAN_DRIVEN: "Create inbound document from scans",
    INBOUND_HEADER_UPDATE_SCAN_DRIVEN: "Update inbound document information",
    INBOUND_SKU_INFO_COMPLETED: "Complete inbound SKU information",
    INBOUND_UNSCAN_ACTUAL: "Remove inbound scan",
    LOGIN_THROTTLED: "Throttle sign-in attempts",
    MFA_CHALLENGE_ISSUED: "Request two-step verification",
    MFA_DISABLED: "Disable two-step verification",
    MFA_ENABLED: "Enable two-step verification",
    MFA_ENROLL_STARTED: "Start two-step verification setup",
    MINI_APP_OUTBOUND_DRAFT_CREATED: "Create outbound draft in app",
    MINI_APP_RECORD_INBOUND: "Record inbound in app",
    MINI_APP_RECORD_OUTBOUND: "Record outbound in app",
    OUTBOUND_IMPORT_CONSUME: "Apply outbound import data",
    OUTBOUND_IMPORT_VALIDATE: "Validate outbound import data",
    OUTBOUND_UNMATCH: "Unmatch outbound item",
    P03_DRAFT_CANCEL: "Cancel document draft",
    P03_DRAFT_RECORD: "Record document draft",
    P03_DRAFT_SAVE: "Save document draft",
    PACKING_LABEL_CREATED: "Create packing label",
    PACKING_LABEL_DISCARDED: "Discard packing label",
    PACKING_LABEL_PREVIEWED: "Preview packing label",
    PACKING_LABEL_READY: "Prepare packing label for printing",
    PACKING_LABEL_REPORT_SEEDED: "Seed packing label report data",
    PASSWORD_RESET: "Reset password",
    PASSWORD_RESET_REQUESTED: "Request password reset",
    PREPARE_ITEM_NFC: "Prepare NFC tag linking",
    PUTAWAY_CANCEL: "Cancel putaway document",
    PUTAWAY_DRAFT_CREATE: "Create putaway draft",
    PV_PUBLISH: "Publish product in app",
    PV_UNPUBLISH: "Unpublish product in app",
    RECIPIENT_CREATE: "Create recipient",
    RECIPIENT_UPDATE: "Update recipient",
    RECONCILIATION_INCIDENT_DETECTED: "Detect reconciliation discrepancy",
    REPORT_EXPORT_FILE_PURGE: "Purge exported report file",
    REPORT_EXPORT_REQUESTED: "Request report export",
    REVERSAL_PHYSICAL_RETURN_CONFIRMED:
      "Confirm physical return for stock adjustment",
    REVOKE_SESSION: "Revoke sign-in session",
    REVOKE_OTHER_SESSIONS: "Sign out other sessions",
    REVOKE_DEVICE: "Revoke sign-in device",
    SKU_CREATE: "Create SKU",
    SKU_IMPORT_COMMIT: "Apply SKU import",
    SKU_IMPORT_CREATE: "Create SKU import",
    SKU_IMPORT_DRY_RUN_CHECK: "Check SKU import without saving",
    SKU_UPDATE: "Update SKU",
    UIUX_V2_SCENARIO_SEEDED: "Seed interface sample data",
    UPDATE_PROFILE: "Update personal profile",
    UPDATE_PROFILE_PREFERENCES: "Update account preferences",
    WARRANTY_ATTACHMENT_DOWNLOADED: "Download warranty attachment",
    WARRANTY_ATTACHMENT_UPLOADED: "Upload warranty attachment",
    WARRANTY_NOTE_ADDED: "Add warranty note",
    WARRANTY_REPORT_EXPORTED: "Export warranty report",
    WORK_SHIFT_ENDED: "End work shift",
    WORK_SHIFT_OWNER_VERIFIED: "Verify work shift owner",
    WORK_SHIFT_STARTED: "Start work shift",
  },
);

/**
 * Nhãn phân hệ hiển thị trên bảng/dropdown lọc Nhật ký hệ thống — đúng 5
 * luồng theo yêu cầu vận hành mục 6 (hệ thống & danh mục, nhập kho, xuất kho,
 * bảo hành, kiểm kê/đối soát), khớp giá trị thật BE ghi vào cột `module`
 * (Modules\AuditLog\app\Services\AuditLogger::MODULE_*, BE repo).
 */
export const AUDIT_MODULE_LABELS: Record<string, string> = bilingual(
  {
    SYSTEM: "Hệ thống & danh mục",
    INBOUND: "Nhập kho",
    OUTBOUND: "Xuất kho",
    WARRANTY: "Bảo hành",
    STOCKTAKE: "Tồn kho & kiểm soát",
  },
  {
    SYSTEM: "System & master data",
    INBOUND: "Inbound",
    OUTBOUND: "Outbound",
    WARRANTY: "Warranty",
    STOCKTAKE: "Inventory & control",
  },
);
