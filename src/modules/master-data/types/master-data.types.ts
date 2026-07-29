export type MasterStatus = "ACTIVE" | "INACTIVE" | "DRAFT" | string;

export type SkuType = "PRODUCT" | "COMPONENT" | string;

export interface SkuRecord {
  id: number | string;
  sku_code: string;
  sku_name: string;
  sku_type: SkuType;
  brand?: string | null;
  category?: string | null;
  model?: string | null;
  unit?: string | null;
  serial_tracking?: boolean;
  default_container_type?: string | null;
  warranty_enabled?: boolean;
  status: MasterStatus;
  updated_at?: string | null;
}

export interface ItemRecord {
  id: number | string;
  item_code: string;
  sku_code?: string | null;
  sku_name?: string | null;
  serial_no?: string | null;
  lot_no?: string | null;
  status: MasterStatus;
  warehouse_name?: string | null;
  updated_at?: string | null;
}

export interface PhysicalCodeRecord {
  id: number | string;
  code_value: string;
  code_type: string;
  carrier?: string | null;
  sku_code?: string | null;
  item_code?: string | null;
  status: MasterStatus;
  duplicate_flag?: boolean;
  last_scanned_at?: string | null;
  updated_at?: string | null;
}

export interface SkuPayload {
  sku_type: string;
  sku_code: string;
  sku_name: string;
  brand?: string;
  category?: string;
  model?: string;
  unit: string;
  serial_tracking: boolean;
  default_container_type: string;
  warranty_enabled: boolean;
  status: MasterStatus;
}

export interface MasterListParams {
  page: number;
  per_page: number;
  search?: string;
  sort_by?: string;
  sort_direction?: "asc" | "desc";
  sku_type?: string;
  category?: string;
  serial_tracking?: boolean;
  status?: string;
  code_type?: string;
  duplicate_flag?: boolean;
  warehouse_id?: number | string;
}

export interface MasterPageResult<T> {
  data: T[];
  meta: {
    total?: number;
    current_page?: number;
    per_page?: number;
    last_page?: number;
    request_id?: string;
    [key: string]: unknown;
  };
}

export interface ImportRowError {
  row: number;
  field?: string;
  code?: string;
  message: string;
  value?: string | number | boolean | null;
}

export interface ImportResult {
  message?: string;
  import_id?: string | number;
  total_rows?: number;
  valid_rows?: number;
  error_rows?: number;
  inserted_rows?: number;
  updated_rows?: number;
  skipped_rows?: number;
  partial_write?: boolean;
  row_errors?: ImportRowError[];
  errors?: ImportRowError[];
}
