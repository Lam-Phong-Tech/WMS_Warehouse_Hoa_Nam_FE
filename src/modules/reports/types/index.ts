export interface ReportItem {
  id: string;
  code: string;
  title: string;
  description: string;
}

export interface XntReportRow {
  sku: string;
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
