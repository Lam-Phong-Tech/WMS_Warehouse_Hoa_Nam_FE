import { ROUTES } from "@/shared/constants/routes";

/**
 * WWHN-252 — dựng path chi tiết SCR-PV-02 từ một chỗ duy nhất.
 *
 * Tham số nhận sku_id (UUID) HOẶC mã SKU: màn hình nghiệp vụ nào có sẵn UUID
 * thì truyền UUID (đi thẳng vào getPvProduct), còn lại truyền mã và trang chi
 * tiết tự tra (xem PvProductDetailPage + findPvProductByCode).
 */
export function pvProductDetailPath(skuIdOrCode: string): string {
  return ROUTES.PV_PRODUCT_DETAIL.replace(
    ":skuId",
    encodeURIComponent(skuIdOrCode),
  );
}

/**
 * UUID dạng chuẩn — dùng để phân biệt "param là sku_id" với "param là mã SKU".
 * BE tự kiểm lại bằng regex của nó (`looksLikeUuid`); đây chỉ là nhánh rẽ ở FE
 * để không bắn một request chắc chắn trả 400 INVALID_PATH.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPvSkuId(value: string | undefined | null): boolean {
  return UUID_PATTERN.test((value ?? "").trim());
}
