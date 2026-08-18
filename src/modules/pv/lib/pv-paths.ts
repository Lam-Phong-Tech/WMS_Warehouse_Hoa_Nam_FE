import { ROUTES } from "@/shared/constants/routes";

/** WWHN-252 — dựng path chi tiết SCR-PV-02 từ một chỗ duy nhất. */
export function pvProductDetailPath(skuId: string): string {
  return ROUTES.PV_PRODUCT_DETAIL.replace(":skuId", skuId);
}
