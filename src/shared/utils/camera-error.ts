/**
 * Dịch lỗi mở camera (DOMException của trình duyệt — message tiếng Anh kỹ
 * thuật như "Permission denied", "Requested device not found") thành câu
 * tiếng Việt nêu rõ nguyên nhân + cách xử lý cho người vận hành kho.
 *
 * Dùng chung cho mọi màn quét bằng camera (CameraScanModal, Inbound...).
 */
import { tStatic } from "@/shared/i18n/useT";

export function getCameraErrorMessage(error: unknown): string {
  const name =
    error instanceof DOMException
      ? error.name
      : error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return tStatic("shared.scanner.errPermission");
    case "NotFoundError":
    case "OverconstrainedError":
      return tStatic("shared.scanner.errNotFound");
    case "NotReadableError":
    case "AbortError":
      return tStatic("shared.scanner.errBusy");
    default:
      return tStatic("shared.scanner.errGeneric");
  }
}
