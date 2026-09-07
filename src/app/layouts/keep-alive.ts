import { ROUTES } from "@/shared/constants/routes";

// Cờ hiển thị trang sống ở shared/ui (overlay của design system cần đọc nó);
// re-export để phía app dùng cùng một tên.
export {
  PageVisibilityContext,
  usePageVisible,
} from "@/shared/ui/page-visibility";

/**
 * Nhóm route được GIỮ SỐNG khi rời đi (xem KeepAliveOutlet). Chỉ nhóm báo cáo —
 * đúng chỗ người dùng than "chuyển tab qua lại lag", và là những màn nặng nhất.
 * Màn nghiệp vụ (nhập/xuất/kho) vẫn mount lại như cũ để form/luồng quét không
 * giữ trạng thái cũ ngoài ý muốn.
 */
const KEEP_ALIVE_PREFIXES: readonly string[] = [
  ROUTES.REPORTS_INVENTORY_FLOW,
  ROUTES.REPORTS_OUTBOUND_FLOW,
  ROUTES.REPORTS_STOCK_RECONCILE,
  ROUTES.REPORTS_TRACEABILITY,
  ROUTES.REPORTS_IMPORT_QUALITY,
  ROUTES.REPORTS_PACKING_LABEL,
  ROUTES.REPORTS_WARRANTY,
  ROUTES.REPORTS_RECIPIENT,
  ROUTES.REPORTS_PENDING_EVIDENCE,
];

export function isKeepAlivePath(pathname: string): boolean {
  return KEEP_ALIVE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}
