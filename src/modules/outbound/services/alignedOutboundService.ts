import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  cancelOutboundDocument,
  fetchActiveRfidCodes,
  fetchAvailableQtyBySku,
  fetchOutboundDetail,
  fetchOutboundDocuments,
  fetchPrinterConfigs,
  postOutboundIssue,
  printLabelSnapshot,
  reprintLabelSnapshot,
  scanOutboundItem,
  unmatchOutboundItem,
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
  cancelOutboundDocument,
  fetchActiveRfidCodes,
  fetchAvailableQtyBySku,
  fetchOutboundDetail,
  fetchOutboundDocuments,
  fetchPrinterConfigs,
  postOutboundIssue,
  printLabelSnapshot,
  reprintLabelSnapshot,
  scanOutboundItem,
  unmatchOutboundItem,
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
  /** Optimistic version dùng cho If-Match của preview/ready/print/reprint. */
  version: number;
  documentId: string;
  labelCode: string;
  outboundNo: string;
  /** Mã toa nguồn snapshot trên nhãn (Annex A Packing_Label_Snapshot). */
  sourceRequestNo: string;
  recipientName: string;
  recipientAddress: string;
  customerPhone: string;
  itemCount: number;
  skuCount: number;
  skuSummary: PackingLabelSkuSummary[];
  /** §6: DRAFT → PREVIEWED → READY_TO_PRINT → PRINTED (PRINT_FAILED khi in lỗi). */
  status:
    | "DRAFT"
    | "PREVIEWED"
    | "READY_TO_PRINT"
    | "PRINTED"
    | "PRINT_FAILED"
    | "PENDING_PRINT"
    | string;
  applied: boolean;
  appliedAt?: string | null;
  reprintCount: number;
  payload: RawRecord;
}

function normalizeSkuSummary(value: unknown): PackingLabelSkuSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is RawRecord =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    )
    .map((row) => ({
      skuId: text(row.sku_id),
      // KHÔNG fallback `?? row.sku_id`: field tên "skuCode" mà chứa UUID thì
      // mọi nơi render nó (kể cả NHÃN IN) sẽ in chuỗi thô. Thiếu thì để rỗng.
      skuCode: text(row.sku_code),
      skuName: text(row.sku_name),
      quantity: num(row.quantity),
    }));
}

function normalizePackingLabel(row: RawRecord): PackingLabelRecord {
  const payload = objectOf(row.label_payload ?? row.payload);
  return {
    id: text(row.id),
    version: num(row.version),
    documentId: text(row.outbound_document_id),
    labelCode: text(row.label_code ?? payload.label_code, text(row.id)),
    outboundNo: text(row.outbound_no ?? payload.outbound_no),
    sourceRequestNo: text(row.source_request_no ?? payload.source_request_no),
    recipientName: text(row.customer_name ?? payload.recipient_name),
    recipientAddress: text(row.customer_address ?? payload.recipient_address),
    customerPhone: text(row.customer_phone ?? payload.customer_phone),
    itemCount: num(row.item_count ?? payload.item_count),
    skuCount: num(row.sku_count ?? payload.sku_count),
    skuSummary: normalizeSkuSummary(row.sku_summary ?? payload.sku_summary),
    status: text(row.status, "DRAFT"),
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
  const phone = input.customerPhone.trim();
  const row = await http.post<RawRecord>(API_ENDPOINTS.LABEL_SNAPSHOTS, {
    outbound_document_id: input.documentId,
    // SĐT optional theo SRS §15; gửi null thay vì chuỗi rỗng để nhãn render blank.
    customer_phone: phone === "" ? null : phone,
  });
  return normalizePackingLabel(row);
}

/**
 * Annex C previewPackingLabel (If-Match) — SRS §6: DRAFT → PREVIEWED.
 * Stock-neutral, chỉ chạy khi phiếu xuất chưa hoàn tất.
 */
export async function previewPackingLabel(input: {
  documentId: string;
  labelId: string;
  ifMatch: number;
}): Promise<PackingLabelRecord> {
  const row = await http.post<RawRecord>(
    labelPath(API_ENDPOINTS.OUTBOUND_PACKING_LABEL_PREVIEW, input),
    undefined,
    { headers: { "If-Match": String(input.ifMatch) } },
  );
  return normalizePackingLabel(row);
}

/**
 * Annex C readyPackingLabel (Idempotency-Key + If-Match) — SRS §6:
 * PREVIEWED → READY_TO_PRINT, đóng băng immutable Packing_Label_Snapshot.
 */
export async function readyPackingLabel(input: {
  documentId: string;
  labelId: string;
  ifMatch: number;
  idempotencyKey: string;
}): Promise<PackingLabelRecord> {
  const row = await http.post<RawRecord>(
    labelPath(API_ENDPOINTS.OUTBOUND_PACKING_LABEL_READY, input),
    undefined,
    {
      headers: {
        "If-Match": String(input.ifMatch),
        "Idempotency-Key": input.idempotencyKey,
      },
    },
  );
  return normalizePackingLabel(row);
}

export async function applyPackingLabel(
  id: string,
  ifMatch?: number,
): Promise<PackingLabelRecord> {
  const row = await http.post<RawRecord>(
    API_ENDPOINTS.LABEL_SNAPSHOT_APPLY.replace(":id", encodeURIComponent(id)),
    undefined,
    ifMatch === undefined
      ? undefined
      : { headers: { "If-Match": String(ifMatch) } },
  );
  return normalizePackingLabel(row);
}

function labelPath(
  template: string,
  input: { documentId: string; labelId: string },
): string {
  return template
    .replace(":id", encodeURIComponent(input.documentId))
    .replace(":labelId", encodeURIComponent(input.labelId));
}
