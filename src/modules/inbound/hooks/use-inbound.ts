import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelInboundDocument,
  completeInboundCartonScan,
  createInboundDocument,
  fetchInboundDetail,
  fetchInboundDocuments,
  fetchInboundScanEntries,
  postInboundReceipt,
  registerInboundBox,
  scanInboundDocument,
  unscanInboundEntry,
  updateInboundDocument,
} from "@/modules/inbound/services/inboundService";
import type {
  CreateInboundPayload,
  PostReceiptRequest,
  UpdateInboundPayload,
} from "@/modules/inbound/types";

type InboundListParams = {
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
};
export const inboundKeys = {
  all: ["inbound"] as const,
  list: (params: InboundListParams) =>
    [...inboundKeys.all, "list", params] as const,
  detail: (id: string) => [...inboundKeys.all, "detail", id] as const,
  scanEntries: (id: string, status: "ACTIVE" | "ALL") =>
    [...inboundKeys.all, "scan-entries", id, status] as const,
};
export function useInboundDocuments(params: InboundListParams) {
  return useQuery({
    queryKey: inboundKeys.list(params),
    queryFn: () => fetchInboundDocuments(params),
  });
}
export function useInboundDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: inboundKeys.detail(id ?? ""),
    queryFn: () => fetchInboundDetail(id ?? ""),
    enabled: Boolean(id),
  });
}
/**
 * Annex D SCR-IN-01: bảng mã đã quét phải đọc lại được sau khi tải lại trang, nên
 * nó là query server chứ không phải state trong phiên thao tác.
 */
export function useInboundScanEntries(
  id: string | null | undefined,
  status: "ACTIVE" | "ALL" = "ACTIVE",
) {
  return useQuery({
    queryKey: inboundKeys.scanEntries(id ?? "", status),
    queryFn: () => fetchInboundScanEntries(id ?? "", status),
    enabled: Boolean(id),
  });
}

function useInvalidateInboundMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inboundKeys.all }),
  });
}
export function useCreateInbound() {
  return useInvalidateInboundMutation((payload: CreateInboundPayload) =>
    createInboundDocument(payload),
  );
}
export function useUpdateInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      payload,
      ifMatch,
    }: {
      id: string;
      payload: UpdateInboundPayload;
      ifMatch: number;
    }) => updateInboundDocument(id, payload, ifMatch),
  );
}
export function useCancelInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      reason,
      ifMatch,
    }: {
      id: string;
      reason: string;
      ifMatch: number;
    }) => cancelInboundDocument(id, reason, ifMatch),
  );
}
export function useRegisterInboundBox() {
  return useInvalidateInboundMutation(
    ({
      id,
      lineId,
      boxCode,
    }: {
      id: string;
      lineId: string;
      boxCode: string;
    }) => registerInboundBox(id, lineId, boxCode),
  );
}
export function useScanInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      code,
      lineId,
      ifMatch,
      includeCodeValue,
      quantity,
      containerId,
      idempotencyKey,
    }: {
      id: string;
      code: string;
      /**
       * Change Pack QR/SKU (DEC-QR-001): bỏ trống với scan PRODUCT — server tự
       * match dòng theo SKU embedded trong QR composite.
       */
      lineId?: string;
      ifMatch: number;
      includeCodeValue: boolean;
      quantity?: number;
      containerId?: string;
      /**
       * WWHN-187 (DEV187-P1-07): caller giữ key của hành động quét và truyền lại
       * đúng key đó khi gửi lại, để BE replay thay vì cộng đôi `scanned_qty`.
       */
      idempotencyKey?: string;
    }) =>
      scanInboundDocument(id, [code], {
        lineId,
        ifMatch,
        includeCodeValue,
        quantity,
        containerId,
        idempotencyKey,
      }),
  );
}
/**
 * Inbound Carton Scan v1.0 §3.3/§4.5: mốc "Đã quét xong thùng" — audit-only,
 * stock-neutral. Invalidate inbound queries để count theo carton luôn đúng.
 */
export function useCompleteInboundCartonScan() {
  return useInvalidateInboundMutation(
    ({ id, containerId }: { id: string; containerId: string }) =>
      completeInboundCartonScan(id, containerId),
  );
}
export function useUnscanInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      entryId,
      ifMatch,
      reason,
    }: {
      id: string;
      entryId: string;
      ifMatch: number;
      reason?: string;
    }) => unscanInboundEntry(id, entryId, ifMatch, reason),
  );
}

export function usePostInboundReceipt() {
  return useInvalidateInboundMutation((payload: PostReceiptRequest) =>
    postInboundReceipt(payload),
  );
}
