import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMvpAgency,
  createMvpDefect,
  createMvpSku,
  getMvpAgencies,
  getMvpDefects,
  getMvpSkus,
  hasMvpSkuStock,
  setMvpSkuPublished,
  updateMvpAgency,
  updateMvpDefect,
  updateMvpSku,
} from "@/modules/master-data/services/mvp-master.service";
import type {
  AgencyPayload,
  DefectPayload,
  MasterListParams,
  SkuPayload,
} from "@/modules/master-data/types/mvp-master.types";

export const mvpMasterKeys = {
  all: ["mvp-master"] as const,
  skus: (params: MasterListParams) => [...mvpMasterKeys.all, "skus", params] as const,
  agencies: (params: MasterListParams) =>
    [...mvpMasterKeys.all, "agencies", params] as const,
  defects: (params: MasterListParams) =>
    [...mvpMasterKeys.all, "defects", params] as const,
};

export function useMvpSkus(params: MasterListParams) {
  return useQuery({ queryKey: mvpMasterKeys.skus(params), queryFn: () => getMvpSkus(params) });
}

export function useMvpAgencies(params: MasterListParams) {
  return useQuery({
    queryKey: mvpMasterKeys.agencies(params),
    queryFn: () => getMvpAgencies(params),
  });
}

export function useMvpDefects(params: MasterListParams) {
  return useQuery({
    queryKey: mvpMasterKeys.defects(params),
    queryFn: () => getMvpDefects(params),
  });
}

export function useMvpSkuHasStock(skuId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...mvpMasterKeys.all, "sku-has-stock", skuId],
    queryFn: () => hasMvpSkuStock(skuId),
    enabled: enabled && Boolean(skuId),
    staleTime: 30_000,
  });
}

function useInvalidateMasterMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mvpMasterKeys.all }),
  });
}

export function useCreateMvpSku() {
  return useInvalidateMasterMutation((payload: SkuPayload) => createMvpSku(payload));
}

export function useUpdateMvpSku() {
  return useInvalidateMasterMutation(
    ({ id, version, payload }: { id: string; version: number; payload: SkuPayload }) =>
      updateMvpSku(id, version, payload),
  );
}

export function useSetMvpSkuPublished() {
  return useInvalidateMasterMutation(
    ({ id, version, publishedToApp }: { id: string; version: number; publishedToApp: boolean }) =>
      setMvpSkuPublished(id, version, publishedToApp),
  );
}

export function useCreateMvpAgency() {
  return useInvalidateMasterMutation((payload: AgencyPayload) => createMvpAgency(payload));
}

export function useUpdateMvpAgency() {
  return useInvalidateMasterMutation(
    ({ id, payload }: { id: string; payload: AgencyPayload }) => updateMvpAgency(id, payload),
  );
}

export function useCreateMvpDefect() {
  return useInvalidateMasterMutation((payload: DefectPayload) => createMvpDefect(payload));
}

export function useUpdateMvpDefect() {
  return useInvalidateMasterMutation(
    ({ id, payload }: { id: string; payload: DefectPayload }) => updateMvpDefect(id, payload),
  );
}
