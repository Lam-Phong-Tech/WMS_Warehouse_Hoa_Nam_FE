import type { QueryClient } from "@tanstack/react-query";
import { QUERY_CACHE_REGISTRY } from "./cache-policy";

/**
 * INVALIDATION LIÊN MODULE — phần mà cache theo module KHÔNG thể tự lo.
 *
 * Hiện trạng trước thay đổi này: mỗi module chỉ vô hiệu cache của CHÍNH NÓ.
 * `usePostInboundReceipt` gọi `invalidateQueries({queryKey: inboundKeys.all})`
 * và dừng ở đó — trong khi ghi sổ một phiếu nhập làm đổi SỐ TỒN, bảng điều
 * khiển và mọi báo cáo XNT. Những khoá đó nằm ở module khác nên không ai đụng
 * tới, và màn hình tồn kho tiếp tục hiện số cũ cho tới khi hết staleTime.
 *
 * Hai hàm dưới đây đóng đúng khoảng trống đó. Danh sách root được SUY RA từ
 * QUERY_CACHE_REGISTRY chứ không chép tay, để thêm một root báo cáo mới là nó
 * tự nằm trong diện được làm mới.
 *
 * Chi phí gần bằng 0: `invalidateQueries` chỉ refetch NGAY những query đang có
 * observer (đang hiển thị trên màn hình); query không mount chỉ bị đánh dấu cũ
 * và sẽ tự làm mới ở lần mở sau. Vì vậy làm mới "rộng tay" ở đây an toàn hơn
 * nhiều so với bỏ sót một màn hình đang hiển thị số sai.
 */
const REPORT_ROOTS: readonly string[] = QUERY_CACHE_REGISTRY.filter(
  ([, cacheClass]) => cacheClass === "report",
).map(([root]) => root);

/** Mọi thứ đọc ra từ số tồn kho. */
const STOCK_DERIVED_ROOTS: readonly string[] = [
  "inventory",
  "dashboard",
  "putaway",
  ...REPORT_ROOTS,
];

/** Mọi thứ đọc ra từ master/danh mục. */
const MASTER_DERIVED_ROOTS: readonly string[] = [
  "ref",
  "mvp-master",
  "catalog-master",
  "warehouse",
  "warehouses",
  ...REPORT_ROOTS,
];

function invalidateRoots(
  queryClient: QueryClient,
  roots: readonly string[],
): Promise<void> {
  return Promise.all(
    roots.map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  ).then(() => undefined);
}

/**
 * Gọi sau MỌI mutation có thể làm đổi số tồn: ghi sổ phiếu nhập/xuất, đảo bút
 * toán, xuất linh kiện bảo hành, cất hàng, phát mã hiện vật.
 *
 * Cố ý "rộng" thay vì cố đoán chính xác endpoint nào chạm tồn: đoán sai theo
 * hướng thiếu thì người dùng thấy số sai — hỏng dữ liệu; đoán sai theo hướng
 * thừa thì tốn thêm một request của màn hình đang mở — không hỏng gì.
 */
export function invalidateStockDerived(
  queryClient: QueryClient,
): Promise<void> {
  return invalidateRoots(queryClient, STOCK_DERIVED_ROOTS);
}

/**
 * Gọi sau mutation master/danh mục (SKU, kho, đại lý, danh mục lỗi, catalog).
 *
 * BẮT BUỘC kể từ khi danh mục dùng chung chuyển sang root `ref`: sửa tên kho ở
 * màn Cấu hình kho mà chỉ vô hiệu `["warehouse"]` thì dropdown ở mọi màn khác
 * (đọc `["ref","warehouses",...]`) vẫn giữ tên cũ tới 30 phút, và bản persisted
 * còn giữ lâu hơn.
 */
export function invalidateMasterDerived(
  queryClient: QueryClient,
): Promise<void> {
  return invalidateRoots(queryClient, MASTER_DERIVED_ROOTS);
}

/** Chỉ để test/tài liệu đọc lại được danh sách đã suy ra. */
export const INVALIDATION_ROOTS = {
  stock: STOCK_DERIVED_ROOTS,
  master: MASTER_DERIVED_ROOTS,
} as const;
