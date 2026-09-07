/**
 * WWHN-252 — path CANONICAL của App PV theo Annex C (OpenAPI 1.7.0-ba).
 *
 * Giữ tách khỏi `shared/api/endpoints.ts` vì đây là hai mặt hợp đồng khác nhau:
 * nhóm dưới đây có `security: []` (ẩn danh), còn `API_ENDPOINTS` là bề mặt đã
 * xác thực. Trộn chung là cách nhanh nhất để một ngày nào đó có người gắn
 * interceptor auth vào endpoint public.
 *
 * `/pv/catalog` là path lịch sử của BE, KHÔNG dùng ở FE: nó và `/pv/products`
 * cùng trỏ về một read model, nhưng chỉ `/pv/products` là path được Annex C
 * khai (operationId listPvProducts).
 */
export const PV_API_ENDPOINTS = {
  PRODUCTS: "/pv/products",
  PRODUCT_DETAIL: (skuId: string) => `/pv/products/${skuId}`,
  INDUSTRIES: "/pv/industries",
  RECOMMENDATIONS: "/pv/recommendations",

  /** REQ-SRS-033 — PV Admin, permission pv.master.manage. */
  ADMIN_RESOURCES: (resourceType: string) =>
    `/pv-admin/resources/${resourceType}`,
  ADMIN_RESOURCE: (resourceType: string, id: string) =>
    `/pv-admin/resources/${resourceType}/${id}`,

  /** REQ-SRS-020 — publish, permission RIÊNG pv.publish. */
  PRODUCT_PUBLISH: (skuId: string) => `/pv/products/${skuId}/publish`,

  /**
   * MST-PV-01 — upload ảnh sản phẩm lên object storage của hệ thống (MinIO ở
   * dev, Cloudflare R2 ở deploy). Gate bằng `pv.master.manage`; trả về URL công
   * khai để gắn vào `images[]` của product-profiles.
   */
  ADMIN_PRODUCT_IMAGES: "/pv-admin/product-images",
} as const;
