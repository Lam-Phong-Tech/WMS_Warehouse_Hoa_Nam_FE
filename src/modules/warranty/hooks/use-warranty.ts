import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWarrantyCase,
  deleteWarrantyAttachment,
  fetchWarrantyAttachments,
  fetchWarrantyCase,
  fetchWarrantyCaseEvents,
  fetchWarrantyCases,
  updateWarrantyCase,
  uploadWarrantyAttachment,
} from "@/modules/warranty/services/warrantyService";
import {
  cancelComponentIssue,
  createComponentIssue,
  fetchComponentIssueDocument,
  fetchComponentIssueDocuments,
  postComponentIssue,
  scanComponentIssue,
  type ComponentIssueCreateRequest,
  type ComponentIssueListParams,
} from "@/modules/warranty/services/componentIssueService";
import type {
  CreateWarrantyCaseRequest,
  UpdateWarrantyCaseRequest,
  WarrantyAttachmentType,
  WarrantyListParams,
} from "@/modules/warranty/types";

export const warrantyKeys = {
  all: ["warranty"] as const,
  list: (params: WarrantyListParams) =>
    [...warrantyKeys.all, "list", params] as const,
  detail: (id: string) => [...warrantyKeys.all, "detail", id] as const,
  events: (id: string) => [...warrantyKeys.all, "events", id] as const,
  attachments: (id: string) =>
    [...warrantyKeys.all, "attachments", id] as const,
  componentIssues: (params: ComponentIssueListParams) =>
    [...warrantyKeys.all, "component-issues", params] as const,
  componentIssueDetail: (id: string) =>
    [...warrantyKeys.all, "component-issue", id] as const,
};

export function useWarrantyCases(params: WarrantyListParams) {
  return useQuery({
    queryKey: warrantyKeys.list(params),
    queryFn: () => fetchWarrantyCases(params),
  });
}

export function useWarrantyCase(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.detail(id ?? ""),
    queryFn: () => fetchWarrantyCase(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useWarrantyEvents(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.events(id ?? ""),
    queryFn: () => fetchWarrantyCaseEvents(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useWarrantyAttachments(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.attachments(id ?? ""),
    queryFn: () => fetchWarrantyAttachments(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useComponentIssues(
  params: ComponentIssueListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: warrantyKeys.componentIssues(params),
    queryFn: () => fetchComponentIssueDocuments(params),
    enabled,
  });
}

export function useComponentIssueDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.componentIssueDetail(id ?? ""),
    queryFn: () => fetchComponentIssueDocument(id ?? ""),
    enabled: Boolean(id),
  });
}

function useInvalidateWarrantyMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: warrantyKeys.all }),
  });
}

export function useCreateWarrantyCase() {
  return useInvalidateWarrantyMutation((payload: CreateWarrantyCaseRequest) =>
    createWarrantyCase(payload),
  );
}

export function useUpdateWarrantyCase() {
  return useInvalidateWarrantyMutation(
    ({ id, request }: { id: string; request: UpdateWarrantyCaseRequest }) =>
      updateWarrantyCase(id, request),
  );
}

export function useUploadWarrantyAttachment() {
  return useInvalidateWarrantyMutation(
    (input: {
      caseId: string;
      file: File;
      attachmentType?: WarrantyAttachmentType;
    }) => uploadWarrantyAttachment(input),
  );
}

export function useDeleteWarrantyAttachment() {
  return useInvalidateWarrantyMutation((attachmentId: string) =>
    deleteWarrantyAttachment(attachmentId),
  );
}

export function useCreateComponentIssue() {
  return useInvalidateWarrantyMutation((payload: ComponentIssueCreateRequest) =>
    createComponentIssue(payload),
  );
}

export function useScanComponentIssue() {
  return useInvalidateWarrantyMutation(
    (input: {
      documentId: string;
      lineId: string;
      codeValue: string;
      quantity: number;
      ifMatch: number;
    }) => scanComponentIssue(input),
  );
}

export function useCancelComponentIssue() {
  return useInvalidateWarrantyMutation(
    (input: { documentId: string; reason: string; ifMatch: number }) =>
      cancelComponentIssue(input),
  );
}

export function usePostComponentIssue() {
  return useInvalidateWarrantyMutation(
    (input: { documentId: string; ifMatch: number; idempotencyKey: string }) =>
      postComponentIssue(input),
  );
}
