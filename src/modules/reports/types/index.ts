export interface ReportItem {
  id: string;
  code: string;
  title: string;
  description: string;
  status?: string;
  available?: boolean;
}

export interface XntReportRow {
  sku: string;
  category?: string;
  movementType?: string;
  opening: number;
  receipt: number;
  issue: number;
  adjustIn: number;
  adjustOut: number;
  reversalNet: number;
  closing: number;
  partialRemaining: number | string;
  reconcile: "PASS" | "WARN" | "WARNING" | "FAIL" | string;
}
