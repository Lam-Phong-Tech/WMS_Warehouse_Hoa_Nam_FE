import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelInboundDocument,
  createInboundDocument,
  fetchInboundDetail,
  fetchInboundDocuments,
  postInboundReceipt,
  scanInboundDocument,
  updateInboundDocument,
} from "@/modules/receiving/services/receivingService";
import type {
  CreateInboundPayload,
  PostReceiptRequest,
  UpdateInboundPayload,
} from "@/modules/receiving/types";

type InboundListParams = {
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
};

export const inboundKeys = {
  all: ["inbound"] as const,
  list: (params: InboundListParams) => [...inboundKeys.all, "list", params] as const,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboundKeys.all }),
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
    ({ id, reason, ifMatch }: { id: string; reason: string; ifMatch: number }) =>
      cancelInboundDocument(id, reason, ifMatch),
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
    }: {
      id: string;
      code: string;
      lineId: string;
      ifMatch: number;
      includeCodeValue: boolean;
    }) =>
      scanInboundDocument(id, [code], {
        lineId,
        ifMatch,
        includeCodeValue,
      }),
  );
}

export function usePostInboundReceipt() {
  return useInvalidateInboundMutation((payload: PostReceiptRequest) =>
    postInboundReceipt(payload),
  );
}
