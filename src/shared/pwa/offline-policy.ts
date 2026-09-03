import { tStatic } from "@/shared/i18n/useT";

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

export const OFFLINE_MUTATION_CODE = "OFFLINE_MUTATION_BLOCKED";
// Hằng export vẫn là string (API cũ, axios.ts đọc trực tiếp) — được gán một
// lần lúc nạp module theo ngôn ngữ đã persist; chấp nhận vì chuỗi lỗi transport
// này chỉ dựng lúc request bị chặn, tương tự tStatic ở service khác.
export const OFFLINE_MUTATION_MESSAGE = tStatic(
  "shared.pwa.offlineMutationBlocked",
);

export function isOfflineMutationBlocked(
  method?: string,
  isOnline = typeof navigator === "undefined" ? true : navigator.onLine,
): boolean {
  const normalizedMethod = (method ?? "get").toLowerCase();
  return !isOnline && MUTATION_METHODS.has(normalizedMethod);
}
