import { useLayoutEffect, type ReactNode } from "react";

/**
 * Lớp bảo vệ cuối cho các màn legacy/wireframe còn chứa literal kỹ thuật tiếng Anh.
 *
 * Nguyên tắc:
 * - chỉ thay TEXT/placeholder/title/aria-label mà người dùng nhìn hoặc đọc bằng screen reader;
 * - không đụng value form, data-*, permission key, API field, endpoint hay raw enum gửi BE;
 * - dữ liệu nghiệp vụ trong ô bảng chỉ được map khi giá trị là exact enum đã biết;
 * - các module mới vẫn phải dùng domain label map trong business-labels.ts; boundary này
 *   chỉ là fail-closed safety net để literal cũ không lọt ra giao diện vận hành.
 */
const EXACT_TEXT_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Nháp",
  SCANNING: "Đang quét",
  POSTED: "Đã ghi nhận",
  CANCELLED: "Đã hủy",
  PRINTED: "Đã in",
  PREVIEWED: "Đã xem trước",
  READY_TO_PRINT: "Sẵn sàng in",
  PENDING_PRINT: "Chờ in",
  PRINT_FAILED: "In thất bại",
  VALIDATED: "Đã kiểm tra",
  VALID: "Hợp lệ",
  DUPLICATE: "Đã quét trước đó",
  UNKNOWN: "Không nhận diện được",
  INVALID: "Không hợp lệ",
  MATCH: "Khớp",
  MISMATCH: "Có chênh lệch",
  NOT_APPLICABLE: "Không áp dụng",
  AVAILABLE: "Khả dụng",
  NON_SELLABLE: "Không thể bán/xuất",
  DEFECTIVE: "Hàng lỗi",
  QUARANTINE: "Chờ kiểm tra",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  LOCKED: "Đã khóa",
  PRODUCT: "Sản phẩm",
  COMPONENT: "Linh kiện",
  CARTON: "Thùng carton",
  BOX: "Hộp",
  TRAY: "Khay",
  OPEN: "Đang mở",
  CLASSIFIED: "Đã phân loại",
  PARTIALLY_POSTED: "Đã ghi nhận một phần",
  CLOSED: "Đã đóng",
  NEW_ITEM_CANDIDATE: "Sản phẩm mới chờ ghi nhận",
  EXISTING_ITEM: "Sản phẩm đã có trong hệ thống",
  LEGACY_ITEM: "Sản phẩm từ dữ liệu cũ",
  PENDING_RETURN: "Chờ hàng quay lại kho",
  CONFIRMED: "Đã xác nhận hàng về kho",
  SELLABLE: "Có thể bán/xuất lại",
  IN_STOCK: "Còn hàng",
  OUT_OF_STOCK: "Chưa có hàng",
  RECEIVED_PENDING_PUTAWAY: "Chờ xếp khay",
  STORED: "Đã xếp khay",
  IDENTIFIED: "Đã xác định sản phẩm",
  TEMP_ONLY: "Tiếp nhận tạm, chưa xác định sản phẩm",
  TRACEABLE: "Có thông tin truy xuất",
  NOT_TRACEABLE: "Chưa có thông tin truy xuất",
  IN_WARRANTY: "Đang bảo hành",
  RETURNED_TO_CUSTOMER: "Đã trả khách",
  RECEIVED: "Đã tiếp nhận",
  CHECKING: "Đang kiểm tra",
  WAITING_PARTS: "Chờ linh kiện",
  REPAIRING: "Đang sửa chữa",
  COMPLETED: "Đã hoàn tất",
  RETURNED: "Đã trả khách",
  READY: "Sẵn sàng trả",
  REJECTED: "Đã từ chối",
  CONSUMED: "Đã sử dụng",
  OPENING: "Tồn đầu kỳ",
  RECEIPT: "Nhập kho",
  ISSUE: "Xuất kho",
  COMPONENT_ISSUE: "Xuất linh kiện",
  REVERSAL: "Điều chỉnh tồn kho",
  ORIGINAL: "Giao dịch gốc",
  SYSTEM: "Toàn hệ thống",
  WAREHOUSE: "Theo kho",
  FUNCTION: "Theo chức năng",
  draft: "Nháp",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  converted: "Đã tạo phiếu kho",
  cancelled: "Đã hủy",
  in_transit: "Đang vận chuyển",
  return_in_transit: "Đang vận chuyển hoàn",
  completed: "Đã hoàn tất",
  completed_with_loss: "Hoàn tất, có thiếu hụt",
  returned: "Đã hoàn trả",
};

const INLINE_TOKEN_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "nháp",
  SCANNING: "đang quét",
  POSTED: "đã ghi nhận",
  CANCELLED: "đã hủy",
  PRINTED: "đã in",
  PREVIEWED: "đã xem trước",
  READY_TO_PRINT: "sẵn sàng in",
  PENDING_PRINT: "chờ in",
  PRINT_FAILED: "in thất bại",
  MATCH: "khớp",
  MISMATCH: "có chênh lệch",
  NOT_APPLICABLE: "không áp dụng",
  AVAILABLE: "khả dụng",
  NON_SELLABLE: "không thể bán/xuất",
  DEFECTIVE: "hàng lỗi",
  QUARANTINE: "chờ kiểm tra",
  ACTIVE: "đang hoạt động",
  INACTIVE: "ngừng hoạt động",
  PRODUCT: "sản phẩm",
  COMPONENT: "linh kiện",
  BOX: "hộp",
  TRAY: "khay",
  RECEIVED_PENDING_PUTAWAY: "chờ xếp khay",
  STORED: "đã xếp khay",
};

const PHRASE_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Packing Label chưa PRINTED/gi, "Nhãn đóng gói chưa được in"],
  [/Phiếu POSTED là bất biến/gi, "Phiếu đã xuất kho không được chỉnh sửa trực tiếp"],
  [/Đã Preview Packing Label/gi, "Đã xem trước nhãn đóng gói"],
  [/Đã Ready\b/gi, "Đã sẵn sàng"],
  [/được Post trước đó/gi, "được hoàn tất trước đó"],
  [/full match/gi, "đối chiếu đủ"],
  [/RFID mapping là stock-neutral/gi, "Việc gán RFID không làm thay đổi tồn kho"],
  [/không có tag/gi, "không có thẻ RFID"],
  [/có tag/gi, "có thẻ RFID"],
  [/BarcodeDetector/gi, "tính năng đọc mã vạch/QR"],
  [/validation và API/gi, "kiểm tra hợp lệ của hệ thống"],
  [/API không trả kết quả/gi, "Hệ thống không trả kết quả"],
  [/HTTP\s+(\d{3})/g, "Mã phản hồi $1"],
  [/Evidence Full Post Receipt/gi, "Kết quả hoàn tất nhập kho"],
  [/Quét\s*&\s*Full Post Receipt/gi, "Quét & hoàn tất nhập kho"],
  [/Quét\s*&\s*Full Post/gi, "Quét & hoàn tất nhập kho"],
  [/Full Post Receipt/gi, "Hoàn tất nhập kho"],
  [/Post Receipt/gi, "Hoàn tất nhập kho"],
  [/Full Post/gi, "Hoàn tất"],
  [/Packing Label/gi, "Nhãn đóng gói"],
  [/Post Issue/gi, "Hoàn tất xuất kho"],
  [/Movement\s*\/\s*Trace/gi, "Biến động / Truy vết"],
  [/Product Master/gi, "Danh mục sản phẩm"],
  [/Component catalog/gi, "Danh mục linh kiện"],
  [/role template/gi, "mẫu vai trò"],
  [/permission catalog/gi, "danh mục quyền"],
  [/System scope/gi, "Toàn hệ thống"],
  [/Request ID/gi, "Mã yêu cầu"],
  [/RFID code/gi, "Mã RFID"],
  [/Item mới\s*·\s*chờ Post/gi, "Sản phẩm mới · chờ ghi nhận"],
  [/Baseline hiện hành/gi, "Quy trình hiện hành"],
  [/App PV/gi, "ứng dụng phân vùng"],
  [/Import Excel/gi, "Nhập từ Excel"],
  [/Confirm Outbound/gi, "Xác nhận phiếu xuất"],
  [/secure context/gi, "ngữ cảnh bảo mật"],
  [/camera API/gi, "chức năng camera"],
  [/Barcode\s*\/\s*QR/gi, "Mã vạch / QR"],
  [/Map RFID/gi, "Gán RFID"],
  [/\bstock-neutral\b/gi, "không làm thay đổi tồn kho"],
  [/\bavailable_qty\b/g, "tồn khả dụng"],
  [/\bsnapshot\b/gi, "nội dung nhãn đã lưu"],
  [/\breconcile\b/gi, "đối chiếu"],
  [/\bPreview\b/g, "Xem trước"],
  [/\bReady\b/g, "Sẵn sàng"],
  [/\bLedger\b/g, "Sổ tồn kho"],
  [/\bMovement\b/g, "Biến động tồn kho"],
  [/\bmovement\b/g, "biến động tồn kho"],
  [/\bSerial\b/g, "Số sê-ri"],
  [/\bserial\b/g, "số sê-ri"],
  [/\bPutaway\b/g, "Xếp khay"],
  [/\bReversal\b/g, "Điều chỉnh tồn kho"],
  [/\bScan\b/g, "Quét"],
  [/\bscan\b/g, "quét"],
  [/\bmatch\b/gi, "đối chiếu"],
  [/\brequest\b/gi, "yêu cầu"],
  [/\bscope\b/gi, "phạm vi"],
  [/\bItem\b/g, "Sản phẩm"],
  [/\bitem\b/g, "sản phẩm"],
  [/\bVersion\b/g, "Phiên bản"],
  [/\bPublish\b/g, "Đưa lên ứng dụng"],
  [/\bUnpublish\b/g, "Gỡ khỏi ứng dụng"],
  [/\bImport\b/g, "Nhập dữ liệu"],
  [/\bExport\b/g, "Xuất dữ liệu"],
  [/\bCRUD\b/g, "Tạo / Xem / Sửa / Xóa"],
  [/\bruntime\b/gi, "khi vận hành"],
  [/\bcache\b/gi, "bộ nhớ tạm"],
  [/\bbundle\b/gi, "phiên bản giao diện"],
  [/\bfallback\b/gi, "phương án thay thế"],
  [/\bgate\b/gi, "điều kiện"],
  [/\breplay\b/gi, "trả lại kết quả cũ"],
  [/\bwireframe\b/gi, "giao diện mẫu"],
  [/\blow-fi\b/gi, "mô phỏng"],
  [/\baction\b/gi, "thao tác"],
];

const LOCALIZED_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;
const SKIP_SELECTOR =
  'script,style,code,pre,[data-no-vietnamese-localization="true"],[data-testid="pv-product-card"]';
const UI_CONTROL_SELECTOR =
  'button,label,th,option,[role="button"],[role="tab"],.ant-tag,.pill,.ant-alert,.ant-modal-title,.ant-card-head-title,.ant-descriptions-item-label,.ant-tabs-tab';

function preserveOuterWhitespace(source: string, replacement: string): string {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${replacement}${trailing}`;
}

function exactBusinessLabel(source: string): string | null {
  const exact = EXACT_TEXT_LABELS[source.trim()];
  return exact ? preserveOuterWhitespace(source, exact) : null;
}

export function translateUserFacingText(source: string): string {
  if (!source) return source;

  const exact = exactBusinessLabel(source);
  if (exact !== null) return exact;

  let translated = source;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  // Raw enum nằm trong một câu người dùng vẫn phải được Việt hóa. Không áp dụng cho
  // chuỗi giống mã kỹ thuật đơn lẻ (không có khoảng trắng/dấu câu) để tránh đổi mã SKU,
  // permission key hoặc identifier có chứa một token trùng tên trạng thái.
  if (/\s|[·:,.()]/.test(translated)) {
    for (const [token, label] of Object.entries(INLINE_TOKEN_LABELS)) {
      translated = translated.replace(new RegExp(`\\b${token}\\b`, "g"), label);
    }
  }

  return translated;
}

function shouldSkip(element: Element | null): boolean {
  return Boolean(element?.closest(SKIP_SELECTOR));
}

function isPlainTableData(parent: Element): boolean {
  return Boolean(parent.closest("td")) && !Boolean(parent.closest(UI_CONTROL_SELECTOR));
}

function localizeTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || shouldSkip(parent)) return;
  const current = node.nodeValue ?? "";

  // Không dịch tự do dữ liệu nghiệp vụ trong cell. Chỉ exact enum/status đã biết mới
  // được map. Nhờ vậy tên khách/SKU như "Tool Box" hay "Item Pro" không bị thay chữ.
  const next = isPlainTableData(parent)
    ? (exactBusinessLabel(current) ?? current)
    : translateUserFacingText(current);

  if (next !== current) node.nodeValue = next;
}

function localizeAttributes(element: Element): void {
  if (shouldSkip(element)) return;
  for (const attribute of LOCALIZED_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const next = translateUserFacingText(current);
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function localizeSubtree(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    localizeTextNode(node as Text);
    return;
  }
  if (!(node instanceof Element)) return;
  if (shouldSkip(node)) return;

  localizeAttributes(node);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    localizeTextNode(current as Text);
    current = walker.nextNode();
  }

  node.querySelectorAll("*").forEach(localizeAttributes);
}

export function VietnameseUiBoundary({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    // Ant Design render Modal/Drawer/Dropdown/notification bằng portal dưới body,
    // không nhất thiết nằm trong #root. Observe toàn body để safety net áp dụng đồng
    // nhất cho cả page thường và overlay/portal.
    const root = document.body;
    if (!root) return;

    localizeSubtree(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          localizeTextNode(mutation.target as Text);
          continue;
        }
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          localizeAttributes(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach(localizeSubtree);
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...LOCALIZED_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
