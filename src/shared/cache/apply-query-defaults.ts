import type { QueryClient } from "@tanstack/react-query";
import { CACHE_POLICIES, QUERY_CACHE_REGISTRY } from "./cache-policy";

/**
 * Áp chính sách cache cho TOÀN BỘ query bằng `setQueryDefaults` theo tiền tố khoá.
 *
 * Vì sao làm ở đây thay vì sửa 112 call site: `setQueryDefaults` khớp theo tiền
 * tố queryKey nên mọi query — kể cả query viết sau này — tự nhận đúng
 * staleTime/gcTime của nhóm mà không ai phải nhớ khai. Một call site vẫn có thể
 * ghi đè khi có lý do nghiệp vụ riêng; giá trị inline luôn thắng defaults.
 *
 * Ràng buộc: các tiền tố trong QUERY_CACHE_REGISTRY KHÔNG được lồng nhau, vì
 * `getQueryDefaults` của TanStack sẽ cảnh báo khi nhiều defaults cùng khớp một
 * khoá. `assertNoNestedPrefixes` bên dưới biến ràng buộc đó thành lỗi thấy được
 * ngay khi chạy test, thay vì một cảnh báo console dễ bị bỏ qua.
 */
export function assertNoNestedPrefixes(): void {
  const roots = QUERY_CACHE_REGISTRY.map(([root]) => root);
  const duplicates = roots.filter(
    (root, index) => roots.indexOf(root) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(
      `[cache] Duplicate query root in QUERY_CACHE_REGISTRY: ${[...new Set(duplicates)].join(", ")}`,
    );
  }
}

export function applyQueryCacheDefaults(client: QueryClient): void {
  assertNoNestedPrefixes();

  for (const [root, cacheClass] of QUERY_CACHE_REGISTRY) {
    const policy = CACHE_POLICIES[cacheClass];
    client.setQueryDefaults([root], {
      staleTime: policy.staleTime,
      gcTime: policy.gcTime,
    });
  }
}
