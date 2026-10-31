import { http } from "@/shared/api/http";
import type {
  NfcEvent,
  NfcItem,
  NfcItemFilters,
  NfcPage,
  NfcTag,
  NfcTagFilters,
} from "../types";

// Web NFC is read-only. Prepare/confirm/deactivate belong to the phone app.
export const nfcService = {
  listItems: (
    params: NfcItemFilters,
    signal?: AbortSignal,
  ): Promise<NfcPage<NfcItem>> =>
    http.getPage<NfcItem[]>("/mini-app/items", { params, signal }),
  listTags: (
    params: NfcTagFilters,
    signal?: AbortSignal,
  ): Promise<NfcPage<NfcTag>> =>
    http.getPage<NfcTag[]>("/mini-app/nfc-tags", { params, signal }),
  getTag: (id: string, signal?: AbortSignal) =>
    http.get<NfcTag>(`/mini-app/nfc-tags/${encodeURIComponent(id)}`, {
      signal,
    }),
  listEvents: (
    id: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<NfcPage<NfcEvent>> =>
    http.getPage<NfcEvent[]>(
      `/mini-app/nfc-tags/${encodeURIComponent(id)}/events`,
      {
        params: { page, per_page: 10 },
        signal,
      },
    ),
};
