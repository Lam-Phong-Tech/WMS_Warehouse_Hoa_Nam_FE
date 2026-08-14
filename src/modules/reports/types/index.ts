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

export interface InventoryBalanceRow {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  productId: string;
  productCode: string;
  productName: string;
  stockStatus: string;
  onHandQty: number;
  availableQty: number;
  reservedQty: number;
  ledgerQty: number;
  variance: number;
  reconciliationStatus: "MATCH" | "MISMATCH";
  updatedAt: string;
}

export interface InventoryBalanceReport {
  dataAsOf: string;
  summary: {
    totalRows: number;
    totalOnHand: number;
    totalAvailable: number;
    mismatchCount: number;
  };
  rows: InventoryBalanceRow[];
}

export interface XntEnhancedRow {
  warehouseCode: string;
  productCode: string;
  productName: string;
  stockStatus: string;
  opening: number;
  receipt: number;
  issue: number;
  componentIssue: number;
  reversalNet: number;
  closing: number;
}

export interface XntEnhancedReport {
  fromDate: string;
  toDate: string;
  formula: string;
  lines: XntEnhancedRow[];
}

export interface DocumentHistoryRow {
  id: string;
  documentNo: string;
  docType: "INBOUND" | "OUTBOUND";
  warehouseCode: string;
  counterpart: string;
  documentDate: string;
  status: string;
  postedAt: string | null;
  cancelledAt: string | null;
  createdByName: string | null;
  postedByName: string | null;
  note: string | null;
}

export interface DocumentHistoryReport {
  period: { fromDate: string; toDate: string };
  docTypeFilter: string;
  summary: {
    total: number;
    draft: number;
    scanning: number;
    posted: number;
    cancelled: number;
  };
  rows: DocumentHistoryRow[];
}

export interface ImportMatchRow {
  id: string;
  importNo: string;
  sourceFileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  passRate: number;
  matchedQty: number;
  uploadedAt: string;
  uploadedByName: string | null;
  validatedAt: string | null;
  consumedAt: string | null;
  consumedByName: string | null;
}

export interface ImportMatchReport {
  period: { fromDate: string; toDate: string };
  summary: {
    totalBatches: number;
    consumed: number;
    rejected: number;
    avgPassRate: number;
    totalMatchedQty: number;
  };
  rows: ImportMatchRow[];
}

export interface LabelLogRow {
  id: string;
  outboundNo: string | null;
  outboundDate: string | null;
  recipient: string | null;
  labelCount: number;
  itemCount: number;
  skuCount: number;
  skuSummary: string;
  status: string;
  totalAttempts: number;
  failedCount: number;
  reprintCount: number;
  createdAt: string;
}

export interface LabelLogReport {
  period: { fromDate: string; toDate: string };
  summary: {
    totalLabels: number;
    printed: number;
    pending: number;
    failed: number;
    reprinted: number;
    failureRate: number;
    reprintRate: number;
  };
  rows: LabelLogRow[];
}

// ── Movement / Trace ──

export interface MovementTraceRow {
  id: string;
  occurredAt: string;
  movementType: "OPENING" | "RECEIPT" | "ISSUE" | "COMPONENT_ISSUE" | "REVERSAL";
  warehouseId: string;
  warehouseCode: string;
  productId: string;
  productCode: string;
  productName: string;
  stockStatus: string;
  qtyDelta: number;
  itemId: string | null;
  containerId: string | null;
  physicalCode: string;
  sourceType: string;
  sourceId: string | null;
  originalMovementId: string | null;
  correctionChainId: string | null;
}

export interface MovementTraceReport {
  period: { fromDate: string; toDate: string };
  formula: string;
  summary: {
    totalMovements: number;
    netEffect: number;
    reversalCount: number;
  };
  rows: MovementTraceRow[];
}

export interface OutboundByAgencyRow {
  agencyCode: string;
  agencyName: string;
  productCode: string;
  productName: string;
  outboundNo: string;
  documentDate: string;
  postedAt: string;
  requiredQty: number;
  scannedQty: number;
}

export interface OutboundByAgencySummaryRow {
  agencyCode: string;
  agencyName: string;
  documentCount: number;
  totalIssuedQty: number;
  skuCount: number;
}

export interface OutboundByAgencyReport {
  period: { fromDate: string; toDate: string };
  summary: {
    totalAgencies: number;
    totalDocuments: number;
    totalIssuedQty: number;
  };
  byAgency: OutboundByAgencySummaryRow[];
  rows: OutboundByAgencyRow[];
}
