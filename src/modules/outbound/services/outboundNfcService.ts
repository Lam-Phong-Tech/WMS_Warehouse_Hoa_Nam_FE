import { http } from "@/shared/api/http";
import type { ApiMeta } from "@/shared/types/api-response";

export type OutboundNfcStatus = "ASSIGNED" | "UNASSIGNED";

export interface OutboundNfcItem {
  document_id: string;
  document_no: string;
  document_status: "DRAFT" | "SCANNING" | "POSTED";
  item_id: string;
  item_code: string | null;
  serial_number: string | null;
  sku_code: string;
  sku_name: string | null;
  nfc_status: OutboundNfcStatus;
  nfc: {
    physical_code_id: string;
    hardware_uid: string | null;
    assigned_at: string | null;
    actor_name: string | null;
  } | null;
}

export interface OutboundNfcEvent {
  id: string;
  action: "ASSIGN_ITEM_NFC" | "REVOKE_ITEM_NFC";
  result: string | null;
  reason: string | null;
  actor_name: string | null;
  hardware_uid: string | null;
  created_at: string | null;
}

export interface OutboundNfcPage<T> {
  data: T[];
  meta: ApiMeta & {
    tab_totals?: { ALL: number; ASSIGNED: number; UNASSIGNED: number };
  };
}

export interface OutboundNfcFilters {
  documentId?: string;
  keyword?: string;
  nfcStatus?: "ALL" | OutboundNfcStatus;
  page: number;
  perPage: number;
}

export function fetchOutboundNfcItems(
  filters: OutboundNfcFilters,
  signal?: AbortSignal,
): Promise<OutboundNfcPage<OutboundNfcItem>> {
  return http.getPage<OutboundNfcItem[]>("/outbound-documents/nfc-items", {
    params: {
      ...(filters.documentId ? { document_id: filters.documentId } : {}),
      ...(filters.keyword ? { keyword: filters.keyword } : {}),
      ...(filters.nfcStatus ? { nfc_status: filters.nfcStatus } : {}),
      page: filters.page,
      per_page: filters.perPage,
    },
    signal,
  });
}

export function fetchOutboundItemNfcHistory(
  documentId: string,
  itemId: string,
  page: number,
  signal?: AbortSignal,
): Promise<OutboundNfcPage<OutboundNfcEvent>> {
  return http.getPage<OutboundNfcEvent[]>(
    `/outbound-documents/${encodeURIComponent(documentId)}/items/${encodeURIComponent(itemId)}/nfc-history`,
    { params: { page, per_page: 10 }, signal },
  );
}
