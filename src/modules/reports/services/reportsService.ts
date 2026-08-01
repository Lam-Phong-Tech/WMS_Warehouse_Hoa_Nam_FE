import { http } from "@/shared/api/http";
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

/**
 * GET /reports/hub
 * Fetch reports hub list from backend.
 * This replaces the old hardcoded mock data.
 */
export async function fetchReportsHub(): Promise<ReportItem[]> {
  const result = await http.get<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.REPORTS_HUB,
  );
  const rows = rowsOf(result);
  return rows.map((row) => ({
    id: text(row.id ?? row.code),
    code: text(row.code),
    title: text(row.title ?? row.name),
    description: text(row.description),
    status: text(row.status ?? row.availability, ""),
    available:
      typeof row.available === "boolean"
        ? row.available
        : row.enabled === undefined
          ? undefined
          : Boolean(row.enabled),
  }));
}

/**
 * GET /reports/inventory-xnt
 * Fetch XNT (Xuất-Nhập-Tồn) report data.
 */
export async function fetchXntReport(
  params: XntReportParams,
): Promise<XntReportRow[]> {
  const result = await http.get<
    | RawRecord[]
    | { data?: RawRecord[]; rows?: RawRecord[]; items?: RawRecord[] }
  >(API_ENDPOINTS.REPORTS_XNT, { params });
  return rowsOf(result).map(normalizeXnt);
}

/**
 * GET /reports/inventory-xnt/export-excel
 * Download XNT report as Excel file (blob).
 */
export async function downloadXntReportExcel(
  params: XntReportParams,
): Promise<Blob> {
  return http.downloadBlob(API_ENDPOINTS.REPORTS_XNT_EXPORT_EXCEL, { params });
}

/**
 * GET /reports/warranty-defects
 * Fetch warranty defects report.
 */
export async function fetchWarrantyDefectsReport(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
    { params },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}
