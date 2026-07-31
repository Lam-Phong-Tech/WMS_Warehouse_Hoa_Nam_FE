export type MasterStatus = "ACTIVE" | "INACTIVE" | "DRAFT" | string;

export type SkuType = "PRODUCT" | "COMPONENT" | string;

export interface SkuRecord {
  id: number | string;
  code: string;
  name: string;
  unit: string;
  sku_type: SkuType;
  is_serial_tracked: boolean;
  status: MasterStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductCategoryRecord {
  id: number | string;
  parent_id?: number | string | null;
  code: string;
  name: string;
  depth?: number | null;
  sort_order?: number | null;
  status: 0 | 1 | number;
  children?: ProductCategoryRecord[];
  created_at?: string | null;
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
  name: string;
  code: string;
  unit: string;
  sku_type: SkuType;
  is_serial_tracked: boolean;
  status?: MasterStatus;
}

export interface ProductCategoryPayload {
  code: string;
  name: string;
  parent_id?: number | null;
  sort_order?: number;
  status?: 0 | 1;
}

export interface ReferenceOptionRecord {
  id: number | string;
  code?: string | null;
  name: string;
  status?: number | string | null;
}

export interface MasterListParams {
  page: number;
  per_page: number;
  search?: string;
  sort_by?: string;
  sort_direction?: "asc" | "desc";
  sku_type?: string;
  category?: string;
  category_id?: number | string;
  parent_id?: number | string;
  supplier_id?: number | string;
  tree?: 0 | 1;
  serial_tracking?: boolean;
  status?: string | number;
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
