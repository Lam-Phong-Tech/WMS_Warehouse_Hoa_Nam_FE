import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelInboundDocument,
  createInboundDocument,
  fetchInboundDetail,
  fetchInboundDocuments,
  postInboundReceipt,
  registerInboundBox,
  scanInboundDocument,
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
    }: {
      id: string;
      code: string;
      lineId: string;
      ifMatch: number;
      includeCodeValue: boolean;
      quantity?: number;
      containerId?: string;
    }) =>
      scanInboundDocument(id, [code], {
        lineId,
        ifMatch,
        includeCodeValue,
        quantity,
        containerId,
      }),
  );
}
export function usePostInboundReceipt() {
  return useInvalidateInboundMutation((payload: PostReceiptRequest) =>
    postInboundReceipt(payload),
  );
}
