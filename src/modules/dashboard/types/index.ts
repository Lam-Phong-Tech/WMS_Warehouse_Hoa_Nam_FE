// Hợp đồng hiện hành của GET /reports/dashboard-overview.
// Không mở rộng field ngoài OpenAPI/OperationalReportController để tránh KPI suy đoán.

export interface DashboardQuery {
  from_date?: string;
  to_date?: string;
  warehouse_id?: string;
}

export interface DashboardPeriod {
  from_date: string;
  to_date: string;
}

/**
 * GLOBAL = không giới hạn kho; WAREHOUSE_SCOPED = số liệu đã bị BE cắt về
 * scope_warehouse_ids.
 */
export type DashboardDataScope = "GLOBAL" | "WAREHOUSE_SCOPED";

/** Chiều "Sản phẩm | Linh kiện | cả hai" mà người dùng chọn trên KPI card. */
export type SkuTypeFilter = "PRODUCT" | "COMPONENT" | "ALL";

/** `total` luôn bằng `product + component` — BE đảm bảo, FE không tự cộng lại. */
export interface DashboardSkuSplit {
  product: number;
  component: number;
  total: number;
}

export type InventoryStockStatus =
  | "AVAILABLE"
  | "NON_SELLABLE"
  | "DEFECTIVE"
  | "QUARANTINE";

export type DashboardStockStatusSplit = Record<InventoryStockStatus, number>;

export interface DashboardTopSku {
  sku_code: string;
  sku_name: string;
  issue_qty: number;
}

export interface DashboardFlowPoint {
  date: string;
  receipt_product: number;
  receipt_component: number;
  /** movement_type = ISSUE */
  issue_product: number;
  /** movement_type = COMPONENT_ISSUE — "xuất linh kiện bảo hành" */
  issue_component: number;
}

export interface DashboardStockTrendPoint {
  date: string;
  closing_qty: number;
}

export interface DashboardOverdueCase {
  warranty_case_code: string;
  customer_name: string | null;
  status: string;
  estimated_completion_date: string;
  days_overdue: number;
}

export interface DashboardOverview {
  period: DashboardPeriod;
  data_scope: DashboardDataScope;
  scope_warehouse_ids: string[] | null;
  kpi: {
    /** Snapshot tồn khả dụng hiện tại — KHÔNG lọc theo period. */
    on_hand: DashboardSkuSplit;
    receipt_today: DashboardSkuSplit;
    issue_today: DashboardSkuSplit;
    receipt_month: DashboardSkuSplit;
    issue_month: DashboardSkuSplit;
  };
  /** Số ca bảo hành tiếp nhận. GLOBAL — ERD warranty_case không có warehouse_id. */
  warranty_received: { today: number; week: number; month: number };
  top_sku: {
    best: DashboardTopSku | null;
    worst: DashboardTopSku | null;
  };
  flow_daily: DashboardFlowPoint[];
  stock_trend: DashboardStockTrendPoint[];
  stock_structure: Record<"PRODUCT" | "COMPONENT", DashboardStockStatusSplit>;
  warranty: {
    by_status: Record<string, number>;
    /** Tổng THẬT. `overdue_sample` có trần 50 nên `.length` KHÔNG phải tổng. */
    overdue_count: number;
    overdue_sample: DashboardOverdueCase[];
  };
  issues: {
    inventory_mismatch: number;
    import_error: number;
    warranty_overdue: number;
    print_failed: number;
  };
  /**
   * Số SKU đang dưới / vượt định mức tồn (min_stock/max_stock đã đặt ở SKU
   * master). OPTIONAL: chờ BE bổ sung vào GET /reports/dashboard-overview —
   * FE dựng sẵn UI và chỉ hiển thị số khi field có mặt, không suy đoán phía
   * client. Yêu cầu vận hành mục 1 ("tồn dưới định mức / tồn vượt định mức").
   */
  stock_threshold?: {
    /** Số SKU có tồn khả dụng < min_stock. */
    below_min: number;
    /** Số SKU có tồn khả dụng > max_stock. */
    above_max: number;
    /** Số SKU đã đặt định mức (mẫu số để đọc tỉ lệ). Optional. */
    configured?: number;
  };
}
