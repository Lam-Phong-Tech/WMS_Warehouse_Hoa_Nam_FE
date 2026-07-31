import { http } from "@/shared/api/http";
import type { ReportItem, XntReportRow } from "../types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

type RawRecord = Record<string, unknown>;

export type XntReportParams = {
  from: string;
  to: string;
  warehouse_id?: number;
  scope?: "warehouse" | "system";
};

const reportHub: ReportItem[] = [
  {
    id: "inventory",
    code: "RPT-INV-01",
    title: "Tồn hiện tại",
    description: "Nguồn API: /inventory/balances.",
  },
  {
    id: "xnt",
    code: "RPT-XNT-01",
    title: "Xuất nhập tồn",
    description: "Nguồn API: /reports/inventory-xnt.",
  },
  {
    id: "movement",
    code: "RPT-MOV-01",
    title: "Movement History",
    description: "Nguồn API: /stock-movements.",
  },
];

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
    opening: num(row.opening ?? row.opening_qty),
    receipt,
    issue,
    adjustIn: num(row.adjust_in ?? row.adjustIn),
    adjustOut: num(row.adjust_out ?? row.adjustOut),
    reversalNet: num(row.reversal_net ?? row.reversalNet),
    closing: num(row.closing ?? row.closing_qty),
    partialRemaining: num(row.partial_remaining ?? row.remaining_qty),
    reconcile: text(row.reconcile ?? row.reconciliation_status, "PASS") as XntReportRow["reconcile"],
  };
}

export async function fetchReports(): Promise<ReportItem[]> {
  return reportHub;
}

export async function fetchXntReport(
  params: XntReportParams,
): Promise<XntReportRow[]> {
  const result = await http.get<RawRecord[] | { data?: RawRecord[]; rows?: RawRecord[]; items?: RawRecord[] }>(
    API_ENDPOINTS.REPORTS_XNT,
    { params },
  );
  return rowsOf(result).map(normalizeXnt);
}

export async function downloadXntReportExcel(
  params: XntReportParams,
): Promise<Blob> {
  return http.downloadBlob(API_ENDPOINTS.REPORTS_XNT_EXPORT_EXCEL, { params });
}

export async function fetchDashboardQuick(): Promise<RawRecord> {
  return http.get<RawRecord>(API_ENDPOINTS.REPORTS);
}

export async function fetchDocumentStatusHistory(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.DOCUMENT_STATUS_HISTORY,
    { params },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}
