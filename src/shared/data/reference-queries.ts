import { useQuery } from "@tanstack/react-query";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";

/** Bản ghi thô của BE; các màn hình tự map sang shape của mình như trước. */
export type ReferenceRow = Record<string, unknown>;

/**
 * DỮ LIỆU TRA CỨU DÙNG CHUNG — một khoá cho một tập dữ liệu, dùng lại toàn app.
 *
 * Vì sao file này tồn tại: danh mục kho từng được lấy bằng CHÍN queryKey khác
 * nhau ở chín nơi (`warehouses/inbound-active`, `inventory/trace-warehouse`,
 * `warehouse/list`, `rpt-ops/warehouses`, `iam/scope-warehouses`,
 * `physical-codes/active-warehouse`, `warranty/component-issue-warehouse`,
 * `warranty/intake-warehouse`, `warehouses/component-issue-list`). React Query
 * chỉ gộp request khi khoá GIỐNG NHAU, nên chín khoá = chín lần gọi API cho đúng
 * một danh mục gần như không bao giờ đổi.
 *
 * Quy ước: mọi tập tra cứu dùng chung nằm dưới root `ref` để nhận nguyên chính
 * sách nhóm `reference` (staleTime 30 phút, gcTime 4 giờ, persist 24 giờ) khai ở
 * @/shared/cache/cache-policy.ts.
 *
 * PHẠM VI DỮ LIỆU: `GET /warehouses` của BE lọc theo warehouse-scope của người
 * đăng nhập, nên kết quả PHỤ THUỘC người dùng. An toàn vì hai lớp: cache RAM bị
 * `useSwitchContext` vô hiệu khi đổi context, còn bản persisted nằm trong
 * namespace có cả user + scope + permission (@/shared/cache/cache-namespace.ts).
 */
export const referenceKeys = {
  all: ["ref"] as const,
  /**
   * Kho ACTIVE theo hợp đồng canonical.
   *
   * KHÔNG gộp chung khoá với `warehouseDirectory`: `fetchWarehouses` chạy
   * `assertCanonicalActiveWarehouse` khi `status=ACTIVE` và ném lỗi hợp đồng nếu
   * số kho ACTIVE khác 1. Hai truy vấn này có ngữ nghĩa khác nhau, không phải
   * hai biến thể phân trang của cùng một thứ.
   */
  activeWarehouses: () => [...referenceKeys.all, "warehouses", "active"] as const,
  /** Toàn bộ kho trong scope — dùng cho dropdown/bộ lọc/bản đồ mã kho -> tên. */
  warehouseDirectory: () =>
    [...referenceKeys.all, "warehouses", "directory"] as const,
};

/**
 * Số lượng kho lấy cho dropdown. Trước đây bốn nơi tự chọn 50/100/200 -> ba khoá
 * khác nhau cho cùng một nhu cầu. Chốt một con số duy nhất là bao trùm cả ba
 * (200 >= 100 >= 50) nên không nơi nào bị thiếu dữ liệu so với trước.
 */
const DIRECTORY_PAGE_SIZE = 200;

export interface ReferenceQueryOptions {
  /**
   * Giữ nguyên khả năng hoãn fetch của từng nơi gọi (ví dụ modal chỉ tải khi mở).
   * Nhiều observer cùng khoá nhưng khác `enabled` là hợp lệ: React Query chỉ cần
   * MỘT observer bật là fetch, và mọi observer còn lại dùng chung kết quả đó.
   */
  readonly enabled?: boolean;
}

/** Kho ACTIVE canonical. Dùng ở mọi modal cần "kho đang hoạt động". */
export function useActiveWarehouses({ enabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: referenceKeys.activeWarehouses(),
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
    enabled,
  });
}

/** Danh mục kho đầy đủ trong scope của người dùng. */
export function useWarehouseDirectory({
  enabled = true,
}: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: referenceKeys.warehouseDirectory(),
    queryFn: () => fetchWarehouses({ per_page: DIRECTORY_PAGE_SIZE }),
    enabled,
  });
}
