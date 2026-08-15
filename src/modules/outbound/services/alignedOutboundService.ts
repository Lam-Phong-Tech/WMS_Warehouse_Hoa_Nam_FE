import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  assignRfidToItem,
  cancelOutboundDocument,
  fetchActiveRfidCodes,
  fetchOutboundDetail,
  fetchOutboundDocuments,
  fetchPrinterConfigs,
  postOutboundIssue,
  printLabelSnapshot,
  reprintLabelSnapshot,
  scanOutboundItem,
  unmatchOutboundItem,
  updateOutboundDocument,
  type IssueEvidence,
  type OutboundDetail,
  type OutboundDocumentRecord,
  type OutboundItemMatchRecord,
  type OutboundLineRecord,
  type OutboundListResult,
  type OutboundStatus,
  type PhysicalCodeRecord,
  type PrinterConfigRecord,
} from "@/modules/outbound/services/mvpOutboundService";

export {
  assignRfidToItem,
  cancelOutboundDocument,
  fetchActiveRfidCodes,
  fetchOutboundDetail,
  fetchOutboundDocuments,
  fetchPrinterConfigs,
  postOutboundIssue,
  printLabelSnapshot,
  reprintLabelSnapshot,
  scanOutboundItem,
  unmatchOutboundItem,
  updateOutboundDocument,
};

export type {
  IssueEvidence,
  OutboundDetail,
  OutboundDocumentRecord,
  OutboundItemMatchRecord,
  OutboundLineRecord,
  OutboundListResult,
  OutboundStatus,
  PhysicalCodeRecord,
  PrinterConfigRecord,
};

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = text(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function objectOf(value: unknown): RawRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RawRecord;
  }
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RawRecord)
      : {};
  } catch {
    return {};
  }
}

export interface PackingLabelSkuSummary {
  skuId: string;
  skuCode: string;
  skuName: string;
  quantity: number;
}

export interface PackingLabelRecord {
  id: string;
  documentId: string;
  labelCode: string;
  outboundNo: string;
  recipientName: string;
  recipientAddress: string;
  customerPhone: string;
  itemCount: number;
  skuCount: number;
  skuSummary: PackingLabelSkuSummary[];
  status: "PENDING_PRINT" | "PRINTED" | "PRINT_FAILED" | string;
  applied: boolean;
  appliedAt?: string | null;
  reprintCount: number;
  payload: RawRecord;
}

function normalizeSkuSummary(value: unknown): PackingLabelSkuSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is RawRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      skuId: text(row.sku_id),
      skuCode: text(row.sku_code ?? row.sku_id),
      skuName: text(row.sku_name),
      quantity: num(row.quantity),
    }));
}

function normalizePackingLabel(row: RawRecord): PackingLabelRecord {
  const payload = objectOf(row.label_payload ?? row.payload);
  return {
    id: text(row.id),
    documentId: text(row.outbound_document_id),
    labelCode: text(row.label_code ?? payload.label_code, text(row.id)),
    outboundNo: text(row.outbound_no ?? payload.outbound_no),
    recipientName: text(row.customer_name ?? payload.recipient_name),
    recipientAddress: text(row.customer_address ?? payload.recipient_address),
    customerPhone: text(row.customer_phone ?? payload.customer_phone),
    itemCount: num(row.item_count ?? payload.item_count),
    skuCount: num(row.sku_count ?? payload.sku_count),
    skuSummary: normalizeSkuSummary(row.sku_summary ?? payload.sku_summary),
    status: text(row.status, "PENDING_PRINT"),
    applied: bool(row.applied) || Boolean(row.applied_at),
    appliedAt: row.applied_at ? text(row.applied_at) : null,
    reprintCount: num(row.reprint_count),
    payload,
  };
}

/**
 * Canonical label read. We intentionally ignore legacy item-level snapshots
 * (outbound_document_id empty) because they are immutable history only.
 */
export async function fetchPackingLabels(): Promise<PackingLabelRecord[]> {
  const rows: RawRecord[] = [];
  let page = 1;
  for (;;) {
    const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
      API_ENDPOINTS.LABEL_SNAPSHOTS,
      { params: { page, per_page: 100 } },
    );
    const data = Array.isArray(result.data)
      ? result.data
      : Array.isArray((result.data as { data?: RawRecord[] })?.data)
        ? ((result.data as { data?: RawRecord[] }).data ?? [])
        : [];
    rows.push(...data);
    const lastPage = num(result.meta.last_page ?? 1) || 1;
    if (page >= lastPage || data.length === 0 || page >= 20) break;
    page += 1;
  }
  return rows
    .map(normalizePackingLabel)
    .filter((label) => Boolean(label.documentId));
}

export async function createPackingLabel(input: {
  documentId: string;
  customerPhone: string;
}): Promise<PackingLabelRecord> {
  const row = await http.post<RawRecord>(API_ENDPOINTS.LABEL_SNAPSHOTS, {
    outbound_document_id: input.documentId,
    customer_phone: input.customerPhone.trim(),
  });
  return normalizePackingLabel(row);
}

export async function applyPackingLabel(id: string): Promise<PackingLabelRecord> {
  const row = await http.post<RawRecord>(
    `${API_ENDPOINTS.LABEL_SNAPSHOTS}/${encodeURIComponent(id)}/apply`,
  );
  return normalizePackingLabel(row);
}
