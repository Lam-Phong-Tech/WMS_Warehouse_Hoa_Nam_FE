/**
 * Scan module types for WMS Hoa Nam.
 * Canonical read-only classify contract:
 * POST /api/v1/scan/classify — WWHN-150.1.1.0.
 */

export type ScanCodeState = "waiting" | "scanned" | "success" | "error";

/**
 * SRS §5.3 camera/scan context: inbound, outbound, inventory trace/search và
 * warranty receive/search. Không có context kiểm kê (REQ-SRS-037).
 * Khớp enum BE tại POST /api/v1/scan/classify.
 */
export type ScanContext =
  | "INBOUND"
  | "OUTBOUND"
  | "INVENTORY"
  | "TRACE"
  | "WARRANTY_RECEIVE"
  | "WARRANTY_TEMP_ONLY";

export type ScanClassification = "ITEM" | "CONTAINER" | "SKU";

/** ERD bảng 22: containers.container_type. */
export type ScanContainerType = "CARTON" | "BOX" | "TRAY";

export type ScanResolvedSource =
  | "physical_code"
  | "inventory_serials.serial_no"
  | "container.container_code"
  | "products.code";

export interface ScanClassifyRequest {
  raw_code: string;
  context: ScanContext;
  warehouse_id: string;
}

export interface ScanCurrentLocation {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
}

export interface ScanClassifyResponse {
  raw_code: string;
  context: ScanContext;
  classification: ScanClassification;
  item_id: string | null;
  sku_id: string | null;
  product_id: string | null;
  stock_status: string;
  object_status?: string;
  /**
   * Inbound Carton Scan v1.0 §3.1: identity của container khi
   * classification=CONTAINER (container_id non-null trong trường hợp đó) —
   * FE dùng để đặt CARTON làm "Thùng đang quét"; null cho ITEM/SKU.
   */
  container_id?: string | null;
  container_code?: string | null;
  container_type?: ScanContainerType | null;
  resolved_source: ScanResolvedSource;
  contract_version: "WWHN-150.1.1.0";
  stock_effect: "NONE";
  movement_created: false;
  posting_event_created: false;
  idempotency_cache_written: false;
  current_location: ScanCurrentLocation;
  /**
   * Change Pack QR/SKU 20/08/2026 (DEC-QR-001): chỉ có khi raw_code là composite
   * PRODUCT QR (HN1|SKU=...|ITEM=...). BE parse authoritative — FE chỉ hiển thị.
   */
  payload_format?: "COMPOSITE_V1";
  payload_version?: number;
  sku_code?: string;
  item_unique?: string;
  serial_number?: string;
  normalized_code_value?: string;
  resolution_status?: "EXISTING_ITEM";
}

export interface ScanBatch {
  id: string;
  batch_no: string;
  source_type: string;
  source_id?: string;
  warehouse_id?: number;
  status: "OPEN" | "CLASSIFIED" | "PARTIALLY_POSTED" | "CLOSED" | "CANCELLED";
  total_codes: number;
  valid_count: number;
  duplicate_count: number;
  unknown_count: number;
  invalid_count: number;
  created_at: string;
  created_by: string;
}

export interface ScanEvent {
  id: string;
  batch_id: string;
  code_value: string;
  code_type: string;
  status: "VALID" | "DUPLICATE" | "UNKNOWN" | "INVALID";
  message?: string;
  scanned_at: string;
  scanned_by: string;
}

/**
 * POST /api/v1/skus/{id}/items (Modules\Warehouse\Http\Controllers\
 * CurrentBaselineItemIdentityController::issue) — tạo Item_Instance mới kèm
 * Physical_Code mới, stock-neutral (item_status=NEW). Chỉ SKU sku_type=PRODUCT
 * và is_serial_tracked=true mới hợp lệ.
 */
export type IssuePhysicalCodeCarrierType = "QR" | "BARCODE";

export interface IssueItemPhysicalCodeRequest {
  skuId: string;
  carrier_type?: IssuePhysicalCodeCarrierType;
  code_value?: string;
  serial_number?: string;
  idempotencyKey?: string;
}

export interface IssueItemPhysicalCodeResult {
  item_id: string;
  sku_id: string;
  serial_number: string;
  item_status: string;
  item_condition: string;
  physical_code_id: string;
  code_value: string;
  carrier_type: IssuePhysicalCodeCarrierType;
  is_primary: boolean;
  status: string;
  version: number;
  stock_effect: "NONE";
}

export interface PhysicalCode {
  id: string;
  code_value: string;
  code_type: string;
  carrier_type: string;
  target_type: string;
  sku_code?: string;
  container_code?: string;
  status: string;
  location_hint?: string;
  created_at: string;
  updated_at: string;
}
