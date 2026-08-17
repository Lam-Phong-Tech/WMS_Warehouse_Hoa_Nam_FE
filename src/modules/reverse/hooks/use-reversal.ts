import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchReversalDocuments,
  fetchReversalDocument,
  fetchReversalLines,
  fetchReversibleMovements,
  createReversalDocument,
  confirmReversalDocument,
  postReversalDocument,
  cancelReversalDocument,
  type PagedResult,
} from "../services/reversalService";
import type {
  CreateReversalRequest,
  ReversalCancelRequest,
  ReversalConfirmRequest,
  ReversalDocument,
  ReversalLookupParams,
  ReversalPostRequest,
} from "../types";

export const reversalKeys = {
  all: ["reversal"] as const,
  list: (params: Record<string, unknown>) =>
    [...reversalKeys.all, "list", params] as const,
  detail: (id: string) => [...reversalKeys.all, "detail", id] as const,
  lines: (id: string) => [...reversalKeys.all, "lines", id] as const,
  reversible: (params: ReversalLookupParams) =>
    [...reversalKeys.all, "reversible", params] as const,
};

export function useReversalDocuments(params: Record<string, unknown> = {}) {
  return useQuery<PagedResult<ReversalDocument>>({
    queryKey: reversalKeys.list(params),
    queryFn: () => fetchReversalDocuments(params),
  });
}

export function useReversalDocument(id: string | null | undefined) {
  return useQuery({
    queryKey: reversalKeys.detail(id ?? ""),
    queryFn: () => fetchReversalDocument(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useReversalLines(id: string | null | undefined) {
  return useQuery({
    queryKey: reversalKeys.lines(id ?? ""),
    queryFn: () => fetchReversalLines(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useReversibleMovements(
  params: ReversalLookupParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: reversalKeys.reversible(params),
    queryFn: () => fetchReversibleMovements(params),
    enabled,
  });
}

export function useCreateReversal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReversalRequest) =>
      createReversalDocument(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reversalKeys.all }),
  });
}

/**
 * SRS §6 lifecycle DRAFT → CONFIRMED → POSTED / CANCELLED. Mỗi mutation phải
 * invalidate cả list lẫn detail vì version đổi sau mỗi bước (BR-REV-02 If-Match).
 */
export function useConfirmReversal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReversalConfirmRequest) =>
      confirmReversalDocument(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reversalKeys.all }),
  });
}

export function usePostReversal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReversalPostRequest) =>
      postReversalDocument(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reversalKeys.all }),
  });
}

export function useCancelReversal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReversalCancelRequest) =>
      cancelReversalDocument(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reversalKeys.all }),
  });
}
