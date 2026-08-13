import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import { WmsContractError } from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import type { ReportItem, XntReportRow } from "../types";

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
