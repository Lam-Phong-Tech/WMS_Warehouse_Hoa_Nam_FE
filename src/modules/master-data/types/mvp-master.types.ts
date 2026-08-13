export type MasterStatus = "ACTIVE" | "INACTIVE";
export type SkuType = "PRODUCT" | "COMPONENT";

export interface MasterListParams {
  keyword?: string;
  status?: MasterStatus | "";
  sku_type?: SkuType | "";
  page?: number;
  per_page?: number;
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
  power_or_voltage?: string | null;
  status: MasterStatus;
  published_to_app?: boolean;
  version: number;
}

export interface SkuPayload {
  code: string;
  name: string;
  sku_type: SkuType;
  unit?: string | null;
  brand_code?: string | null;
  category_code?: string | null;
  model_code?: string | null;
  power_source_code?: string | null;
  is_serial_tracked: boolean;
  status: MasterStatus;
  published_to_app?: boolean;
}

export interface AgencyRecord {
  agency_id: string;
  agency_code: string;
  agency_name: string;
  phone?: string | null;
  address?: string | null;
  status: MasterStatus;
}

export interface AgencyPayload {
  agency_code: string;
  agency_name: string;
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
}

export interface DefectPayload {
  defect_code: string;
  defect_name: string;
  description?: string | null;
  status: MasterStatus;
}
