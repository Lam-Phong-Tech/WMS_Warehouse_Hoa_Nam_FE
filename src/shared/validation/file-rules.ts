/**
 * LUẬT TỆP ĐÍNH KÈM DÙNG CHUNG — một nguồn duy nhất cho "loại tệp nào được
 * nhận, nặng bao nhiêu" của mọi ô upload.
 *
 * Vì sao cần: thuộc tính `accept` của `<input type="file">` CHỈ lọc hộp thoại
 * chọn tệp. Mọi vùng KÉO-THẢ (`onDrop` + `event.dataTransfer.files`) đi vòng
 * qua nó hoàn toàn — thả một `.exe` vào vùng thả là tệp bay thẳng lên API và
 * người dùng chỉ nhận toast 422 chung chung (phát hiện 06/09/2026 ở
 * DocumentAttachmentsPanel). Trước đó mỗi màn tự chép một bộ MIME + số byte
 * riêng: WarrantyDetailModal, WarrantyIntakeModal, OutboundIntakeModal và
 * SkuImportModal có bốn bản sao của cùng một luật, lệch nhau lúc nào không hay.
 *
 * Cách kiểm: PHẦN MỞ RỘNG là luật chính (chặn `.exe`, `.zip`, `.js`…), MIME chỉ
 * là vòng phụ và được BỎ QUA khi trình duyệt trả chuỗi rỗng — Windows/Chrome
 * hay trả `""` cho `.xls`, `.webp` cũ, và một số máy trả `application/octet-stream`
 * cho tệp lấy từ USB. Đây là kiểm tra SỚM phía client, không phải hàng rào bảo
 * mật: đổi tên `.exe` thành `.jpg` thì chỉ BE (đọc magic bytes) mới bắt được.
 */
import { tStatic } from "@/shared/i18n/useT";

/** Trần dung lượng tuyệt đối — đừng chép số byte ra ngoài file này. */
export const FILE_SIZE_LIMITS = {
  /** Ảnh đính kèm (hồ sơ bảo hành, chứng từ). */
  image: 10 * 1024 * 1024,
  /** Video đính kèm hồ sơ bảo hành (WAR-02). */
  video: 300 * 1024 * 1024,
  /** Tệp chứng từ đính kèm phiếu (ảnh hoặc PDF). */
  document: 15 * 1024 * 1024,
  /** Tệp Excel nhập liệu hàng loạt. */
  excel: 15 * 1024 * 1024,
} as const;

export interface FileRule {
  /**
   * Phần mở rộng hợp lệ, LUÔN có dấu chấm và viết thường (".jpg"). Đây là luật
   * chính — danh sách rỗng nghĩa là không chặn theo đuôi (chỉ dùng cho luật
   * dựng động từ cấu hình BE khi BE chưa trả danh sách).
   */
  extensions: readonly string[];
  /**
   * MIME hợp lệ. Rỗng = bỏ qua vòng MIME. Tệp có `file.type === ""` luôn được
   * cho qua vòng này (xem đầu file).
   */
  mimes: readonly string[];
  /** Trần dung lượng theo byte. */
  maxBytes: number;
}

/** Luật mẫu dùng lại ở nhiều màn — đừng chép danh sách đuôi ra ngoài file này. */
export const FILE_RULES = {
  /**
   * Chứng từ đính kèm phiếu nhập/xuất/đảo (DocumentAttachmentsPanel):
   * ảnh hoặc PDF, ≤ 15MB.
   */
  documentAttachment: {
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
    mimes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    maxBytes: FILE_SIZE_LIMITS.document,
  } satisfies FileRule,

  /** Annex D SCR-WAR-01 field `images`: jpg/png/webp, ≤ 10MB/tệp. */
  warrantyImage: {
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    mimes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxBytes: FILE_SIZE_LIMITS.image,
  } satisfies FileRule,

  /** WAR-02 video hồ sơ bảo hành: mp4/mov/webm, ≤ 300MB/tệp. */
  warrantyVideo: {
    extensions: [".mp4", ".mov", ".webm"],
    mimes: ["video/mp4", "video/quicktime", "video/webm"],
    maxBytes: FILE_SIZE_LIMITS.video,
  } satisfies FileRule,

  /** Tệp Excel nhập hàng loạt (SKU, phiếu xuất): xlsx/xls, ≤ 15MB. */
  excelImport: {
    extensions: [".xlsx", ".xls"],
    mimes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
    maxBytes: FILE_SIZE_LIMITS.excel,
  } satisfies FileRule,
} as const;

export type FileCheck =
  | { ok: true }
  | { ok: false; reason: "type" | "size"; message: string };

/** Đuôi tệp viết thường KÈM dấu chấm (".jpg"); chuỗi rỗng khi tên không có đuôi. */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  // Dấu chấm ở vị trí 0 là tệp ẩn kiểu Unix (".gitignore"), không phải đuôi.
  if (dot <= 0) return "";
  return fileName.slice(dot).toLowerCase();
}

/** Định dạng dung lượng cho thông báo lỗi: 15728640 → "15 MB". */
export function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  const mb = bytes / (1024 * 1024);
  // Trần cấu hình luôn là số MB tròn: đừng hiện "15.0 MB".
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Tệp có ĐÚNG LOẠI theo luật không (bỏ qua dung lượng). Dùng để PHÂN LOẠI khi
 * một vùng thả nhận nhiều luật cùng lúc — ví dụ màn chi tiết bảo hành nhận cả
 * ảnh lẫn video và phải biết tệp vừa thả thuộc nhóm nào trước khi đếm slot.
 */
export function matchesFileRule(file: File, rule: FileRule): boolean {
  const extension = fileExtension(file.name);
  if (rule.extensions.length > 0 && !rule.extensions.includes(extension)) {
    return false;
  }
  // MIME rỗng = trình duyệt không đoán được; đuôi đã hợp lệ nên cho qua.
  if (rule.mimes.length > 0 && file.type && !rule.mimes.includes(file.type)) {
    return false;
  }
  return true;
}

/** Danh sách đuôi cho thuộc tính `accept` của `<input type="file">`. */
export function acceptAttribute(rule: FileRule): string {
  return rule.extensions.join(",");
}

/** Danh sách đuôi để ghép vào câu lỗi: ".jpg, .png, .pdf". */
export function describeExtensions(rule: FileRule): string {
  return rule.extensions.join(", ");
}

/**
 * Dựng luật động từ cấu hình BE trả về (SkuImportModal đọc `allowedExtensions`
 * và `maxFileSizeMb` từ API nên không dùng được hằng số tĩnh). Đuôi được chuẩn
 * hoá về dạng ".xlsx" dù BE trả "xlsx" hay ".XLSX".
 */
export function buildFileRule(input: {
  extensions?: readonly string[] | null;
  maxBytes?: number | null;
  mimes?: readonly string[];
  fallback: FileRule;
}): FileRule {
  const extensions = input.extensions?.length
    ? input.extensions.map(
        (value) => `.${value.toLowerCase().replace(/^\./, "")}`,
      )
    : input.fallback.extensions;
  return {
    extensions,
    // Cấu hình BE chỉ nói đuôi, không nói MIME — giữ MIME của luật gốc chỉ khi
    // danh sách đuôi không đổi, còn lại bỏ vòng MIME để không từ chối oan.
    mimes:
      input.mimes ??
      (extensions === input.fallback.extensions ? input.fallback.mimes : []),
    maxBytes:
      input.maxBytes != null && input.maxBytes > 0
        ? input.maxBytes
        : input.fallback.maxBytes,
  };
}

/**
 * Kiểm tra một tệp theo luật. Nơi gọi nào đã có sẵn câu lỗi riêng thì đọc
 * `reason` để chọn câu của mình; nơi mới cứ dùng thẳng `message`.
 */
export function checkFile(file: File, rule: FileRule): FileCheck {
  if (!matchesFileRule(file, rule)) {
    return {
      ok: false,
      reason: "type",
      message: tStatic("shared.validation.fileTypeInvalid", {
        name: file.name,
        list: describeExtensions(rule),
      }),
    };
  }
  if (file.size > rule.maxBytes) {
    return {
      ok: false,
      reason: "size",
      message: tStatic("shared.validation.fileTooLarge", {
        name: file.name,
        max: formatFileSize(rule.maxBytes),
      }),
    };
  }
  return { ok: true };
}
