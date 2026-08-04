import { http } from "@/shared/api/http";
import { WmsContractError } from "@/shared/api/wms-contract";
import type { ReportItem, XntReportRow } from "../types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

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

/**
 * `/reports/hub` remains a documented proposal, not a canonical endpoint.
 * This function intentionally fails before any HTTP request.
 */
export async function fetchReportsHub(): Promise<ReportItem[]> {
  return unapprovedReportContract(
    "Reports hub",
    API_ENDPOINTS.REPORTS_HUB,
  );
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
  return http.downloadBlob(API_ENDPOINTS.REPORTS_XNT_EXPORT_EXCEL, { params });
}

/**
 * `/reports/warranty-defects` is blocked until BE/BA publish a canonical
 * OpenAPI/Jira disposition. UI receives an explicit contract error.
 */
export async function fetchWarrantyDefectsReport(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  void params;
  return unapprovedReportContract(
    "Warranty defects report",
    API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
  );
}
