import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import { WmsContractError } from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import type {
  ReportItem,
  XntReportRow,
  InventoryBalanceReport,
  InventoryBalanceRow,
  XntEnhancedReport,
  XntEnhancedRow,
  DocumentHistoryReport,
  DocumentHistoryRow,
  ImportMatchReport,
  ImportMatchRow,
  LabelLogReport,
  LabelLogRow,
  OutboundByAgencyReport,
  OutboundByAgencyRow,
  OutboundByAgencySummaryRow,
} from "../types";

type RawRecord = Record<string, unknown>;

export type XntReportParams = {
  from: string;
  to: string;
  warehouse_id?: number;
  scope?: "warehouse" | "system";
  sku?: string;
  category?: string;
  movement_type?: string;
};

function rowsOf<T>(value: T[] | { data?: T[]; rows?: T[]; items?: T[] }): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.rows)) return value.rows;
  if (Array.isArray(value.items)) return value.items;
  return [];
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function normalizeXnt(row: RawRecord): XntReportRow {
  const receipt = num(row.receipt ?? row.receipt_qty ?? row.in_qty);
  const issue = num(row.issue ?? row.issue_qty ?? row.out_qty);
  return {
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    category: text(row.category ?? row.category_name ?? row.product_category),
    movementType: text(row.movement_type ?? row.movementType),
    opening: num(row.opening ?? row.opening_qty),
    receipt,
    issue,
    adjustIn: num(row.adjust_in ?? row.adjustIn),
    adjustOut: num(row.adjust_out ?? row.adjustOut),
    reversalNet: num(row.reversal_net ?? row.reversalNet),
    closing: num(row.closing ?? row.closing_qty),
    partialRemaining: num(row.partial_remaining ?? row.remaining_qty),
    reconcile: text(
      row.reconcile ?? row.reconciliation_status,
      "PASS",
    ) as XntReportRow["reconcile"],
  };
}

function unapprovedReportContract(name: string, path: string): never {
  throw new WmsContractError(
    "WMS_FE_CONTRACT_NOT_APPROVED",
    `${name} is blocked because ${path} has no BE/BA canonical contract disposition. Use only after endpoint, payload, error, permission, and sample response are signed off.`,
  );
}

export async function fetchReportsHub(): Promise<ReportItem[]> {
  return unapprovedReportContract("Reports hub", API_ENDPOINTS.REPORTS_HUB);
}

export async function fetchXntReport(
  params: XntReportParams,
): Promise<XntReportRow[]> {
  const result = await http.get<
    | RawRecord[]
    | { data?: RawRecord[]; rows?: RawRecord[]; items?: RawRecord[] }
  >(API_ENDPOINTS.REPORTS_XNT, { params });
  return rowsOf(result).map(normalizeXnt);
}

export async function downloadXntReportExcel(
  params: XntReportParams,
): Promise<Blob> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
    "export XNT report",
  );
  return http.downloadBlob(API_ENDPOINTS.REPORTS_XNT_EXPORT_EXCEL, { params });
}

export type WarrantyReportParams = {
  from: string;
  to: string;
  status?: string;
  defect_id?: string;
  identification_status?: string;
};

export type WarrantyReportCaseRow = {
  id: string;
  caseNo: string;
  identification: string;
  model: string;
  defect: string;
  componentsIssued: string;
  status: string;
  receivedAt: string;
  updatedAt: string;
};

export type WarrantyReportDefectRow = {
  defect: string;
  total: number;
  processing: number;
  returned: number;
  cancelled: number;
  tempOnly: number;
};

export type WarrantyReportResult = {
  summary: {
    total: number;
    processing: number;
    returned: number;
    cancelled: number;
    tempOnly: number;
  };
  rows: WarrantyReportCaseRow[];
  byDefect: WarrantyReportDefectRow[];
};

function normalizeWarrantyCaseRow(
  row: RawRecord,
  index: number,
): WarrantyReportCaseRow {
  return {
    id: text(row.warranty_case_id ?? row.id, String(index)),
    caseNo: text(row.case_no ?? row.warranty_case_code),
    identification: text(row.identification_status, "IDENTIFIED"),
    model: text(row.model ?? row.sku_code, "UNKNOWN_MODEL"),
    defect: text(row.defect ?? row.defect_name, "Chưa phân loại"),
    componentsIssued: text(row.components_issued, "Chưa xuất"),
    status: text(row.status),
    receivedAt: text(row.received_at ?? row.created_at),
    updatedAt: text(row.updated_at ?? row.received_at),
  };
}

function normalizeWarrantyDefectRow(row: RawRecord): WarrantyReportDefectRow {
  return {
    defect: text(row.defect, "Chưa phân loại"),
    total: num(row.total),
    processing: num(row.processing),
    returned: num(row.returned),
    cancelled: num(row.cancelled),
    tempOnly: num(row.temp_only ?? row.tempOnly),
  };
}

/**
 * BP-WMS-12 · Báo cáo Bảo hành & linh kiện (case-level + tổng hợp theo bệnh/lỗi).
 * Response mặc định không chứa PII; export PII do BE kiểm soát bằng warranty.pii.export.
 */
export async function fetchWarrantyDefectsReport(
  params: WarrantyReportParams,
): Promise<WarrantyReportResult> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
    { params },
  );
  const summary = (result.summary ?? {}) as RawRecord;
  return {
    summary: {
      total: num(summary.total),
      processing: num(summary.processing),
      returned: num(summary.returned),
      cancelled: num(summary.cancelled),
      tempOnly: num(summary.temp_only),
    },
    rows: rowsOf(
      (result.rows ?? []) as RawRecord[] | { data?: RawRecord[] },
    ).map(normalizeWarrantyCaseRow),
    byDefect: rowsOf(
      (result.by_defect ?? []) as RawRecord[] | { data?: RawRecord[] },
    ).map(normalizeWarrantyDefectRow),
  };
}

export async function downloadWarrantyReportExcel(
  params: WarrantyReportParams,
): Promise<Blob> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
    "export warranty report",
  );
  return http.downloadBlob(
    API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS_EXPORT_EXCEL,
    {
      params,
    },
  );
}

// ── Tồn kho hiện tại ──

export type InventoryBalanceParams = {
  warehouse_id?: string;
  product_id?: string;
  stock_status?: string;
  keyword?: string;
};

function normalizeInventoryBalanceRow(row: RawRecord): InventoryBalanceRow {
  return {
    id: text(row.id),
    warehouseId: text(row.warehouse_id),
    warehouseCode: text(row.warehouse_code),
    productId: text(row.product_id),
    productCode: text(row.product_code),
    productName: text(row.product_name),
    stockStatus: text(row.stock_status, "AVAILABLE"),
    onHandQty: num(row.on_hand_qty),
    availableQty: num(row.available_qty),
    reservedQty: num(row.reserved_qty),
    ledgerQty: num(row.ledger_qty),
    variance: num(row.variance),
    reconciliationStatus: text(row.reconciliation_status, "MATCH") as "MATCH" | "MISMATCH",
    updatedAt: text(row.updated_at),
  };
}

export async function fetchInventoryBalanceReport(
  params: InventoryBalanceParams,
): Promise<InventoryBalanceReport> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.REPORTS_INVENTORY_BALANCE,
    { params },
  );
  const summary = (result.summary ?? {}) as RawRecord;
  return {
    dataAsOf: text(result.data_as_of),
    summary: {
      totalRows: num(summary.total_rows),
      totalOnHand: num(summary.total_on_hand),
      totalAvailable: num(summary.total_available),
      mismatchCount: num(summary.mismatch_count),
    },
    rows: rowsOf((result.rows ?? []) as RawRecord[]).map(normalizeInventoryBalanceRow),
  };
}

export async function downloadInventoryBalanceExcel(
  params: InventoryBalanceParams,
): Promise<Blob> {
  assertWmsActionPermission(WMS_ACTION_PERMISSIONS.EXPORT_REPORT, "export inventory balance");
  return http.downloadBlob(API_ENDPOINTS.REPORTS_INVENTORY_BALANCE_EXPORT_EXCEL, { params });
}

// ── XNT nâng cấp ──

export type XntEnhancedParams = {
  from_date: string;
  to_date: string;
  warehouse_id?: string;
  product_id?: string;
};

function normalizeXntEnhancedRow(row: RawRecord): XntEnhancedRow {
  return {
    warehouseCode: text(row.warehouse_code),
    productCode: text(row.product_code),
    productName: text(row.product_name),
    stockStatus: text(row.stock_status, "AVAILABLE"),
    opening: num(row.opening),
    receipt: num(row.receipt),
    issue: num(row.issue),
    componentIssue: num(row.component_issue),
    reversalNet: num(row.reversal_net),
    closing: num(row.closing),
  };
}

export async function fetchXntEnhancedReport(
  params: XntEnhancedParams,
): Promise<XntEnhancedReport> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.REPORTS_XNT_ENHANCED,
    { params },
  );
  return {
    fromDate: text(result.from_date),
    toDate: text(result.to_date),
    formula: text(result.formula),
    lines: rowsOf((result.lines ?? []) as RawRecord[]).map(normalizeXntEnhancedRow),
  };
}

export async function downloadXntEnhancedExcel(
  params: XntEnhancedParams,
): Promise<Blob> {
  assertWmsActionPermission(WMS_ACTION_PERMISSIONS.EXPORT_REPORT, "export XNT enhanced");
  return http.downloadBlob(API_ENDPOINTS.REPORTS_XNT_ENHANCED_EXPORT_EXCEL, { params });
}

// ── Lịch sử phiếu nhập/xuất ──

export type DocumentHistoryParams = {
  from_date?: string;
  to_date?: string;
  doc_type?: "inbound" | "outbound" | "all";
  status?: string;
  keyword?: string;
};

function normalizeDocumentHistoryRow(row: RawRecord): DocumentHistoryRow {
  return {
    id: text(row.id),
    documentNo: text(row.document_no),
    docType: text(row.doc_type) as "INBOUND" | "OUTBOUND",
    warehouseCode: text(row.warehouse_code),
    counterpart: text(row.counterpart),
    documentDate: text(row.document_date),
    status: text(row.status),
    postedAt: row.posted_at ? text(row.posted_at) : null,
    cancelledAt: row.cancelled_at ? text(row.cancelled_at) : null,
    createdByName: row.created_by_name ? text(row.created_by_name) : null,
    postedByName: row.posted_by_name ? text(row.posted_by_name) : null,
    note: row.note ? text(row.note) : null,
  };
}

export async function fetchDocumentHistoryReport(
  params: DocumentHistoryParams,
): Promise<DocumentHistoryReport> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY,
    { params },
  );
  const period = (result.period ?? {}) as RawRecord;
  const summary = (result.summary ?? {}) as RawRecord;
  return {
    period: { fromDate: text(period.from_date), toDate: text(period.to_date) },
    docTypeFilter: text(result.doc_type_filter, "all"),
    summary: {
      total: num(summary.total),
      draft: num(summary.draft),
      scanning: num(summary.scanning),
      posted: num(summary.posted),
      cancelled: num(summary.cancelled),
    },
    rows: rowsOf((result.rows ?? []) as RawRecord[]).map(normalizeDocumentHistoryRow),
  };
}

export async function downloadDocumentHistoryExcel(
  params: DocumentHistoryParams,
): Promise<Blob> {
  assertWmsActionPermission(WMS_ACTION_PERMISSIONS.EXPORT_REPORT, "export document history");
  return http.downloadBlob(API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY_EXPORT_EXCEL, { params });
}

// ── Đối soát toa (Excel Import/Match) ──

export type ImportMatchParams = {
  from_date?: string;
  to_date?: string;
  status?: string;
};

function normalizeImportMatchRow(row: RawRecord): ImportMatchRow {
  return {
    id: text(row.id),
    importNo: text(row.import_no),
    sourceFileName: text(row.source_file_name),
    status: text(row.status),
    totalRows: num(row.total_rows),
    validRows: num(row.valid_rows),
    errorRows: num(row.error_rows),
    passRate: num(row.pass_rate),
    matchedQty: num(row.matched_qty),
    uploadedAt: text(row.uploaded_at),
    uploadedByName: row.uploaded_by_name ? text(row.uploaded_by_name) : null,
    validatedAt: row.validated_at ? text(row.validated_at) : null,
    consumedAt: row.consumed_at ? text(row.consumed_at) : null,
    consumedByName: row.consumed_by_name ? text(row.consumed_by_name) : null,
  };
}

export async function fetchImportMatchReport(
  params: ImportMatchParams,
): Promise<ImportMatchReport> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.REPORTS_IMPORT_MATCH,
    { params },
  );
  const period = (result.period ?? {}) as RawRecord;
  const summary = (result.summary ?? {}) as RawRecord;
  return {
    period: { fromDate: text(period.from_date), toDate: text(period.to_date) },
    summary: {
      totalBatches: num(summary.total_batches),
      consumed: num(summary.consumed),
      rejected: num(summary.rejected),
      avgPassRate: num(summary.avg_pass_rate),
      totalMatchedQty: num(summary.total_matched_qty),
    },
    rows: rowsOf((result.rows ?? []) as RawRecord[]).map(normalizeImportMatchRow),
  };
}

export async function downloadImportMatchExcel(
  params: ImportMatchParams,
): Promise<Blob> {
  assertWmsActionPermission(WMS_ACTION_PERMISSIONS.EXPORT_REPORT, "export import match");
  return http.downloadBlob(API_ENDPOINTS.REPORTS_IMPORT_MATCH_EXPORT_EXCEL, { params });
}

// ── Nhật ký nhãn (Label/Print log) ──

export type LabelLogParams = {
  from_date?: string;
  to_date?: string;
  status?: string;
  printer_id?: string;
};

function normalizeLabelLogRow(row: RawRecord): LabelLogRow {
  return {
    id: text(row.id),
    labelCode: text(row.label_code),
    outboundNo: row.outbound_no ? text(row.outbound_no) : null,
    skuCode: text(row.sku_code),
    productName: text(row.product_name),
    itemCodeValue: text(row.item_code_value),
    status: text(row.status),
    reprintCount: num(row.reprint_count),
    totalAttempts: num(row.total_attempts),
    failedCount: num(row.failed_count),
    templateVersion: text(row.template_version),
    createdAt: text(row.created_at),
    createdByName: row.created_by_name ? text(row.created_by_name) : null,
  };
}

export async function fetchLabelLogReport(
  params: LabelLogParams,
): Promise<LabelLogReport> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.REPORTS_LABEL_LOG,
    { params },
  );
  const period = (result.period ?? {}) as RawRecord;
  const summary = (result.summary ?? {}) as RawRecord;
  return {
    period: { fromDate: text(period.from_date), toDate: text(period.to_date) },
    summary: {
      totalSnapshots: num(summary.total_snapshots),
      printed: num(summary.printed),
      pending: num(summary.pending),
      failed: num(summary.failed),
      reprinted: num(summary.reprinted),
      failureRate: num(summary.failure_rate),
      reprintRate: num(summary.reprint_rate),
    },
    rows: rowsOf((result.rows ?? []) as RawRecord[]).map(normalizeLabelLogRow),
  };
}

export async function downloadLabelLogExcel(
  params: LabelLogParams,
): Promise<Blob> {
  assertWmsActionPermission(WMS_ACTION_PERMISSIONS.EXPORT_REPORT, "export label log");
  return http.downloadBlob(API_ENDPOINTS.REPORTS_LABEL_LOG_EXPORT_EXCEL, { params });
}

// ── Xuất theo nơi nhận ──

export type OutboundByAgencyParams = {
  from_date?: string;
  to_date?: string;
  agency_id?: string;
  product_id?: string;
};

function normalizeOutboundByAgencyRow(row: RawRecord): OutboundByAgencyRow {
  return {
    agencyCode: text(row.agency_code),
    agencyName: text(row.agency_name),
    productCode: text(row.product_code),
    productName: text(row.product_name),
    outboundNo: text(row.outbound_no),
    documentDate: text(row.document_date),
    postedAt: text(row.posted_at),
    requiredQty: num(row.required_qty),
    scannedQty: num(row.scanned_qty),
  };
}

function normalizeOutboundByAgencySummaryRow(row: RawRecord): OutboundByAgencySummaryRow {
  return {
    agencyCode: text(row.agency_code),
    agencyName: text(row.agency_name),
    documentCount: num(row.document_count),
    totalIssuedQty: num(row.total_issued_qty),
    skuCount: num(row.sku_count),
  };
}

export async function fetchOutboundByAgencyReport(
  params: OutboundByAgencyParams,
): Promise<OutboundByAgencyReport> {
  const result = await http.get<RawRecord>(
    API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY,
    { params },
  );
  const period = (result.period ?? {}) as RawRecord;
  const summary = (result.summary ?? {}) as RawRecord;
  return {
    period: { fromDate: text(period.from_date), toDate: text(period.to_date) },
    summary: {
      totalAgencies: num(summary.total_agencies),
      totalDocuments: num(summary.total_documents),
      totalIssuedQty: num(summary.total_issued_qty),
    },
    byAgency: rowsOf((result.by_agency ?? []) as RawRecord[]).map(normalizeOutboundByAgencySummaryRow),
    rows: rowsOf((result.rows ?? []) as RawRecord[]).map(normalizeOutboundByAgencyRow),
  };
}

export async function downloadOutboundByAgencyExcel(
  params: OutboundByAgencyParams,
): Promise<Blob> {
  assertWmsActionPermission(WMS_ACTION_PERMISSIONS.EXPORT_REPORT, "export outbound by agency");
  return http.downloadBlob(API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY_EXPORT_EXCEL, { params });
}
