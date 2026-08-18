const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

export const OFFLINE_MUTATION_CODE = "OFFLINE_MUTATION_BLOCKED";
export const OFFLINE_MUTATION_MESSAGE =
  "Không thể thực hiện thao tác ghi khi đang ngoại tuyến. Hệ thống không xếp hàng thay đổi tồn kho hoặc dữ liệu nghiệp vụ; hãy kết nối mạng và thử lại.";

export function isOfflineMutationBlocked(
  method?: string,
  isOnline = typeof navigator === "undefined" ? true : navigator.onLine,
): boolean {
  const normalizedMethod = (method ?? "get").toLowerCase();
  return !isOnline && MUTATION_METHODS.has(normalizedMethod);
}
