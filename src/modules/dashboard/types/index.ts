// WWHN-327/WWHN-328: contract hiện hành của GET /reports/dashboard-quick.
// Không mở rộng field ngoài OpenAPI/OperationalReportController để tránh KPI suy đoán.
export interface DashboardQuery {
  from_date?: string;
  to_date?: string;
}

export interface DashboardPeriod {
  from_date: string;
  to_date: string;
}

export interface ReconciliationWarning {
  [key: string]: unknown;
}

/**
 * WWHN-328: dashboard chịu đúng warehouse data-scope của người gọi. GLOBAL = không
 * giới hạn kho; WAREHOUSE_SCOPED = số liệu đã bị BE cắt về scope_warehouse_ids.
 */
export type DashboardDataScope = "GLOBAL" | "WAREHOUSE_SCOPED";

export interface DashboardKPI {
  /**
   * Kỳ thống kê BE áp dụng. Contract chuẩn LUÔN có; để optional vì
   * normalizeDashboardKPI (Part 4) fail-soft khi payload thiếu field —
   * UI ẩn dòng "Kỳ thống kê" thay vì crash trắng trang.
   */
  period?: DashboardPeriod;
  /** Phạm vi dữ liệu BE đã áp dụng cho toàn bộ KPI bên dưới. */
  data_scope: DashboardDataScope;
  /** null khi GLOBAL; danh sách kho đã áp dụng khi WAREHOUSE_SCOPED. */
  scope_warehouse_ids: string[] | null;
  /** Snapshot AVAILABLE hiện tại; không lọc theo period. */
  available_qty: number;
  /** Tổng RECEIPT theo stock_movements.occurred_at trong period. */
  receipt_qty: number;
  /** Tổng ISSUE tuyệt đối theo stock_movements.occurred_at trong period. */
  issue_qty: number;
  /** Tổng COMPONENT_ISSUE tuyệt đối theo occurred_at trong period. */
  component_issue_qty: number;
  /** Net REVERSAL trong period; có thể âm. */
  reversal_net: number;
  /** Toàn bộ warranty case theo status; không lọc theo period. */
  warranty_cases_by_status: Record<string, number>;
  /**
   * WWHN-328: tổng số dòng MISMATCH trong data-scope. Đây mới là con số để hiển thị —
   * mảng bên dưới đã bị BE cắt trần (50 dòng) nên .length không còn là tổng.
   */
  reconciliation_warning_count: number;
  /** Mẫu tối đa 50 dòng reconciliation_status=MISMATCH tại thời điểm gọi. */
  reconciliation_warnings: ReconciliationWarning[];
  /**
   * GĐ1 (2026-08-27): "tồn dưới định mức" — SKU có min_stock đã đặt và tổng
   * available_qty (CỘNG DỒN MỌI KHO, không theo warehouse data-scope vì định
   * mức là theo SKU toàn hệ thống) < min_stock. SKU chưa đặt min_stock không tính.
   */
  below_min_stock_count: number;
  below_min_stock_skus: DashboardStockThresholdSku[];
  /** "Tồn vượt định mức" — cùng quy ước trên, theo max_stock. */
  above_max_stock_count: number;
  above_max_stock_skus: DashboardStockThresholdSku[];
  /**
   * GĐ1 (2026-08-27): chuỗi theo ngày trong [period.from_date, period.to_date],
   * cùng data_scope/warehouse filter như các KPI trên. warranty_received_count
   * KHÔNG lọc theo kho (cùng lý do warranty_cases_by_status ở trên).
   */
  daily: DashboardDailyPoint[];
}

export interface DashboardDailyPoint {
  date: string;
  receipt_qty: number;
  issue_qty: number;
  warranty_received_count: number;
}

export interface DashboardStockThresholdSku {
  sku_code: string;
  sku_name: string;
  available_qty: number;
  min_stock?: number;
  max_stock?: number;
}
