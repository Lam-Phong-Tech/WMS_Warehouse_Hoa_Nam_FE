// WWHN-328: field set khoá theo GET /reports/dashboard-quick thực tế (BE
// OperationalReportController::dashboardQuick) — không phải KPI set suy đoán.
export interface DashboardKPI {
  period: { from_date: string; to_date: string };
  available_qty: number;
  receipt_qty: number;
  issue_qty: number;
  component_issue_qty: number;
  reversal_net: number;
  warranty_cases_by_status: Record<string, number>;
  reconciliation_warnings: Array<Record<string, unknown>>;
}

export interface RecentDocument {
  id: string;
  code: string;
  type: "INBOUND" | "OUTBOUND" | "COMPONENT_ISSUE" | "REVERSAL";
  partner: string;
  progress: number;
  posted: number;
  total: number;
  status: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ReconcileHealth {
  ledgerBalance: "PASS" | "WARN" | "FAIL";
  ledgerSkuCount: number;
  subledger: "PASS" | "WARN" | "FAIL";
  subledgerMessage: string;
}

export interface AlertItem {
  message: string;
  severity: "warning" | "danger" | "info";
}
