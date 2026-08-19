/**
 * WWHN-252 / HN-PV-001 — hợp đồng dữ liệu App PV.
 *
 * Nguồn: SRS/FRD v1.12 Annex C (listPvProducts / getPvProduct /
 * listPvIndustries / listPvRecommendations / listPvAdminResources /
 * createPvAdminResource / updatePvAdminResource) và §15 OP-09.
 *
 * Các type ở đây cố ý KHÔNG có trường vận hành (item/container/movement/cost/
 * warehouse): mặt công khai không được biết tới chúng, và để type ở đây đúng
 * bằng hợp đồng thì mọi rò rỉ từ BE sẽ lộ ra ngay khi build.
 */

export type PvStockStatus = "IN_STOCK" | "OUT_OF_STOCK";

export interface PvIndustry {
  industry_id: string;
  industry_code: string;
  industry_name: string;
  sort_order: number;
}

export interface PvTagRef {
  tag_id: string;
  tag_code: string;
  tag_name: string;
}

export interface PvIndustryRef {
  industry_id: string;
  industry_code: string;
  industry_name: string;
}

export interface PvImage {
  url: string;
  alt_text: string | null;
  is_primary: boolean;
}

export interface PvProduct {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  display_name: string;
  description: string | null;
  unit: string | null;
  brand_id: string | null;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  power_source_id: string | null;
  power_source_name: string | null;
  model_name: string | null;
  /** REQ-SRS-018: tồn khả dụng kho tổng, chỉ đọc. */
  available_qty: number;
  stock_status: PvStockStatus;
  /** DEC-CATALOG-001: tồn 0 hiển thị "Chưa có hàng". */
  stock_label: string;
  last_inventory_sync_at: string | null;
  max_staleness_seconds: number;
  images: PvImage[];
  industries: PvIndustryRef[];
  tags: PvTagRef[];
  /** Chỉ có ở /pv/recommendations. */
  recommendation_priority?: number;
  /** Chỉ có ở /pv/products/{sku_id}. */
  specifications?: Record<string, unknown>;
}

/** NFR-SRS-016 + §13.7: meta độ tươi đi kèm mọi response PV. */
export interface PvFreshness {
  data_as_of?: string;
  max_staleness_seconds?: number;
  inventory_freshness?: string;
  /**
   * Do FE đóng dấu tại tầng transport (`publicHttp`), không phải BE trả về.
   * Xem lib/pv-freshness.ts để biết vì sao tuổi dữ liệu phải đo bằng mốc này.
   */
  received_at?: number;
}

export interface PvPageMeta extends PvFreshness {
  current_page?: number;
  per_page?: number;
  last_page?: number;
  total?: number;
  request_id?: string;
}

export interface PvPage<T> {
  data: T[];
  meta: PvPageMeta;
}

export interface PvProductQuery {
  keyword?: string;
  industry_id?: string;
  tag_id?: string;
  brand_id?: string;
  category_id?: string;
  power_source_id?: string;
  in_stock?: boolean;
  page?: number;
  per_page?: number;
}

// ---------------------------------------------------------------------------
// PV Admin (REQ-SRS-033) — SCR-PV-ADM-01
// ---------------------------------------------------------------------------

export const PV_ADMIN_RESOURCES = [
  "industries",
  "tags",
  "recommendation-rules",
  "product-profiles",
] as const;

export type PvAdminResourceType = (typeof PV_ADMIN_RESOURCES)[number];

export type PvMasterStatus = "ACTIVE" | "INACTIVE";

export interface PvAdminSimpleMaster {
  id: string;
  code: string;
  name: string;
  status: PvMasterStatus;
  sort_order: number;
  version: number;
  tag_type?: string | null;
}

export interface PvAdminRule {
  id: string;
  industry_id: string;
  industry_name: string | null;
  sku_id: string | null;
  category_id: string | null;
  tag_id: string | null;
  priority: number;
  status: PvMasterStatus;
  version: number;
}

export interface PvAdminProfile {
  id: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  sku_status: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  /**
   * CHỈ ĐỌC ở màn PV Admin. Bật/tắt publish là quyền `pv.publish` tại
   * PATCH /pv/products/{sku_id}/publish (SRS §3 tách khỏi pv.master.manage).
   */
  published: boolean;
  industry_ids: string[];
  tag_ids: string[];
  version: number;
}

export interface PvAdminSimpleMasterPayload {
  code: string;
  name: string;
  status: PvMasterStatus;
  sort_order: number;
  tag_type?: string | null;
}

export interface PvAdminRulePayload {
  industry_id: string;
  sku_id?: string | null;
  category_id?: string | null;
  tag_id?: string | null;
  priority: number;
  status: PvMasterStatus;
}

export interface PvAdminProfilePayload {
  sku_id?: string;
  display_name: string;
  description?: string | null;
  sort_order: number;
  industry_ids: string[];
  tag_ids: string[];
}

/**
 * FE252-P1-08 — kết quả `publishPvProduct`. `pv_profile_version` là version hồ
 * sơ App PV SAU thao tác: BE trả về để màn hình cập nhật precondition tại chỗ
 * thay vì phải đọc lại cả danh sách mới dám bấm công tắc lần hai.
 */
export interface PvPublishResult {
  published_to_app: boolean;
  pv_profile_version: number;
}
