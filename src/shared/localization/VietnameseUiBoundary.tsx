import { useLayoutEffect, type ReactNode } from "react";

/**
 * Lớp bảo vệ cuối cho các màn legacy/wireframe còn chứa literal kỹ thuật tiếng Anh.
 *
 * Nguyên tắc:
 * - chỉ thay TEXT/placeholder/title/aria-label mà người dùng nhìn hoặc đọc bằng screen reader;
 * - không đụng value form, data-*, permission key, API field, endpoint hay raw enum gửi BE;
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
  OPEN: "Đang mở",
  CLASSIFIED: "Đã phân loại",
  CLOSED: "Đã đóng",
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
};

const PHRASE_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
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
  [/Request ID/gi, "Mã yêu cầu"],
  [/Item mới\s*·\s*chờ Post/gi, "Sản phẩm mới · chờ ghi nhận"],
  [/Baseline hiện hành/gi, "Quy trình hiện hành"],
  [/\bstock-neutral\b/gi, "không làm thay đổi tồn kho"],
  [/\bavailable_qty\b/g, "tồn khả dụng"],
  [/\bsnapshot\b/gi, "nội dung nhãn đã lưu"],
  [/\breconcile\b/gi, "đối chiếu"],
  [/\bPreview\b/g, "Xem trước"],
  [/\bReady\b/g, "Sẵn sàng"],
  [/\bLedger\b/g, "Sổ tồn kho"],
  [/\bSerial\b/g, "Số sê-ri"],
  [/\bPutaway\b/g, "Xếp khay"],
  [/\bReversal\b/g, "Điều chỉnh tồn kho"],
  [/\bScan\b/g, "Quét"],
  [/\bscan\b/g, "quét"],
  [/\bmatch\b/gi, "đối chiếu"],
  [/\brequest\b/gi, "yêu cầu"],
  [/\bItem\b/g, "Sản phẩm"],
  [/\bitem\b/g, "sản phẩm"],
  [/\bBOX\b/g, "Hộp"],
  [/\bbox\b/g, "hộp"],
  [/\bTRAY\b/g, "Khay"],
  [/\btray\b/g, "khay"],
  [/\bVersion\b/g, "Phiên bản"],
  [/\bruntime\b/gi, "khi vận hành"],
  [/\bcache\b/gi, "bộ nhớ tạm"],
  [/\bbundle\b/gi, "phiên bản giao diện"],
  [/\bfallback\b/gi, "phương án thay thế"],
  [/\bgate\b/gi, "điều kiện"],
  [/\breplay\b/gi, "trả lại kết quả cũ"],
];

const LOCALIZED_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;
const SKIP_SELECTOR =
  'script,style,code,pre,[data-no-vietnamese-localization="true"]';

function preserveOuterWhitespace(source: string, replacement: string): string {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${replacement}${trailing}`;
}

export function translateUserFacingText(source: string): string {
  if (!source) return source;

  const trimmed = source.trim();
  const exact = EXACT_TEXT_LABELS[trimmed];
  if (exact) return preserveOuterWhitespace(source, exact);

  let translated = source;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}

function shouldSkip(element: Element | null): boolean {
  return Boolean(element?.closest(SKIP_SELECTOR));
}

function localizeTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || shouldSkip(parent)) return;
  const current = node.nodeValue ?? "";
  const next = translateUserFacingText(current);
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
    const root = document.getElementById("root");
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
