export type MasterStatus = "ACTIVE" | "INACTIVE";
export type SkuType = "PRODUCT" | "COMPONENT";

export interface MasterListParams {
  keyword?: string;
  status?: MasterStatus | "";
  sku_type?: SkuType | "";
  /** MST-01 toolbar "Hãng" — gửi kèm GET /products để lọc theo Brand. */
  brand_id?: string;
  page?: number;
  per_page?: number;
}

/** Master dùng để hiển thị tên thay cho *_id và để đổ vào select ở MST-02. */
export interface CatalogRefRecord {
  id: string;
  code: string;
  name: string;
}

export interface ProductCatalogRefs {
  brands: CatalogRefRecord[];
  categories: CatalogRefRecord[];
  models: CatalogRefRecord[];
  /** ERD bảng 16: skus.power_source_id -> power_sources.id. */
  powerSources: CatalogRefRecord[];
  /** ERD bảng 16: skus.package_variant_id -> package_variants.id. */
  packageVariants: CatalogRefRecord[];
}

export interface MasterPageResult<T> {
  data: T[];
  meta: Record<string, unknown>;
}

export interface SkuRecord {
  sku_id: string;
  id?: string;
  sku_code: string;
  code?: string;
  sku_name: string;
  name?: string;
  sku_type: SkuType;
  unit?: string | null;
  is_serial_tracked: boolean;
  brand_id?: string | null;
  category_id?: string | null;
  model_id?: string | null;
  power_source_id?: string | null;
  package_variant_id?: string | null;
  power_or_voltage?: string | null;
  package_variant?: string | null;
  /** Master "version" của SKU (REQ-SRS-029) — KHÁC với `version` optimistic lock. */
  version_code?: string | null;
  status: MasterStatus;
  published_to_app?: boolean;
  /** ERD bảng 16 skus.version — dùng cho If-Match. */
  version: number;
}

export interface SkuPayload {
  code: string;
  name: string;
  sku_type: SkuType;
  unit?: string | null;
  /** Gửi thẳng id master canonical (ERD bảng 16); "" nghĩa là gỡ liên kết. */
  brand_id?: string | null;
  category_id?: string | null;
  model_id?: string | null;
  power_source_id?: string | null;
  package_variant_id?: string | null;
  version_code?: string | null;
  is_serial_tracked: boolean;
  status: MasterStatus;
  published_to_app?: boolean;
}

export interface AgencyRecord {
  agency_id: string;
  agency_code: string;
  agency_name: string;
  contact_name?: string | null;
  phone?: string | null;
  address?: string | null;
  status: MasterStatus;
  /** ERD bảng 9 agencies.version — optimistic locking qua If-Match. */
  version?: number | null;
}

export interface AgencyPayload {
  agency_code: string;
  agency_name: string;
  contact_name?: string | null;
  phone?: string | null;
  address?: string | null;
  status: MasterStatus;
}

export interface DefectRecord {
  defect_id: string;
  defect_code: string;
  defect_name: string;
  description?: string | null;
  status: MasterStatus;
  /** ERD bảng 15 defect_catalog.version — optimistic locking qua If-Match. */
  version?: number | null;
}

export interface DefectPayload {
  defect_code: string;
  defect_name: string;
  description?: string | null;
  status: MasterStatus;
}
