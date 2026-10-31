import type { ApiMeta } from "@/shared/types/api-response";

export type NfcTagStatus = "ACTIVE" | "INACTIVE" | "LOST" | "DAMAGED";
export interface NfcTag {
  physical_code_id: string;
  hardware_uid: string | null;
  code_value: string;
  status: NfcTagStatus;
  status_label?: string | null;
  item_id?: string | null;
  serial_number?: string | null;
  item_status?: string | null;
  sku_code?: string | null;
  sku_name?: string | null;
  assigned_at?: string | null;
  linker?: { display_name?: string | null } | null;
  assigned_warehouse?: { code?: string | null; name?: string | null } | null;
}
export interface NfcItem {
  item_id: string;
  serial_number: string | null;
  item_status: string;
  sku: { sku_code: string; sku_name: string | null };
  nfc_status: "ASSIGNED" | "UNASSIGNED";
  nfc: NfcTag | null;
  nfc_details_available?: boolean;
}
export interface NfcEvent {
  id: string;
  action: string;
  result: string | null;
  reason: string | null;
  actor_name: string | null;
  created_at: string | null;
}
export interface NfcMeta extends ApiMeta {
  tab_totals?: { ALL: number; ASSIGNED: number; UNASSIGNED: number };
}
export interface NfcPage<T> {
  data: T[];
  meta: NfcMeta;
}
export interface NfcItemFilters {
  keyword?: string;
  nfc_status?: "ALL" | "ASSIGNED" | "UNASSIGNED";
  item_status?: string;
  page: number;
  per_page: number;
}
export interface NfcTagFilters {
  hardware_uid?: string;
  status?: NfcTagStatus;
  page: number;
  per_page: number;
}
