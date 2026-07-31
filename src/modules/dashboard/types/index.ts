export interface DashboardKPI {
  activeSku: number;
  productCount: number;
  componentCount: number;
  availableStock: number;
  pendingPutaway: number;
  openStocktake: number;
  stocktakeLines: number;
  warrantyActive: number;
  warrantyTempOnly: number;
}

export interface RecentDocument {
  id: string;
  code: string;
  type: "INBOUND" | "OUTBOUND" | "STOCKTAKE";
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
