import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MasterListParams,
  SkuPayload,
} from "@/modules/master-data/types/master-data.types";
import {
  createSku,
  getItems,
  getPhysicalCodes,
  getSkus,
  importSkus,
  updateSkuStatus,
} from "@/modules/master-data/services/master-data.service";

export const masterDataKeys = {
  all: ["master-data"] as const,
  skus: (params: MasterListParams) =>
    [...masterDataKeys.all, "skus", params] as const,
  items: (params: MasterListParams) =>
    [...masterDataKeys.all, "items", params] as const,
  codes: (params: MasterListParams) =>
    [...masterDataKeys.all, "physical-codes", params] as const,
};

export function useSkus(params: MasterListParams) {
  return useQuery({
    queryKey: masterDataKeys.skus(params),
    queryFn: () => getSkus(params),
  });
}

export function useItems(params: MasterListParams) {
  return useQuery({
    queryKey: masterDataKeys.items(params),
    queryFn: () => getItems(params),
  });
}

export function usePhysicalCodes(params: MasterListParams) {
  return useQuery({
    queryKey: masterDataKeys.codes(params),
    queryFn: () => getPhysicalCodes(params),
  });
}

export function useCreateSku() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SkuPayload) => createSku(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.all }),
  });
}

export function useUpdateSkuStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number | string;
      status: "ACTIVE" | "INACTIVE";
    }) => updateSkuStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.all }),
  });
}

export function useImportSkus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importSkus(file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.all }),
  });
}
