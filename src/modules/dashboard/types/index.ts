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

export interface DashboardKPI {
  period: DashboardPeriod;
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
  /** Các dòng reconciliation_status=MISMATCH tại thời điểm gọi. */
  reconciliation_warnings: ReconciliationWarning[];
}
