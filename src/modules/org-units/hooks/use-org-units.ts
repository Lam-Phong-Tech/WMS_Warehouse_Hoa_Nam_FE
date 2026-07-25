import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  orgUnitsService,
  type InactiveOrgUnitPayload,
  type OrgUnitListParams,
} from '@/modules/org-units/services/org-units.service';
import { orgUnitsKeys } from '@/modules/org-units/services/org-units.keys';
import type {
  OrgUnit,
  OrgUnitTreeNode,
} from '@/modules/org-units/types/org-units.types';
import type { ApiMeta } from '@/shared/types/api-response';
import type { OrgUnitFormValues } from '@/modules/org-units/schemas/org-unit.schema';

export function useOrgUnitsTree(): UseQueryResult<OrgUnitTreeNode[], Error> {
  return useQuery({
    queryKey: orgUnitsKeys.trees(),
    queryFn: orgUnitsService.getTree,
  });
}

/**
 * BE loại đơn vị đã xóa mềm/lưu trữ khỏi cả `/org_units/tree` và `/org_units`
 * (soft-delete scope mặc định) — phải gọi riêng endpoint này để filter
 * "Đã xóa chờ khôi phục"/"Lưu trữ" ở FE có dữ liệu thật (xem
 * orgUnitsService.trashed).
 */
export function useOrgUnitsTrashed(): UseQueryResult<OrgUnit[], Error> {
  return useQuery({
    queryKey: orgUnitsKeys.trashed(),
    queryFn: orgUnitsService.trashed,
  });
}

export function useOrgUnits(
  options?: Omit<UseQueryOptions<OrgUnit[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: orgUnitsKeys.lists(),
    queryFn: orgUnitsService.list,
    ...options,
  });
}

export function useOrgUnitList(
  params: OrgUnitListParams = {},
): UseQueryResult<{ data: OrgUnit[]; meta: ApiMeta }, Error> {
  return useQuery({
    queryKey: [...orgUnitsKeys.lists(), 'paged', params],
    queryFn: () => orgUnitsService.listPaged(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrgUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: OrgUnitFormValues) => orgUnitsService.create(values),
    onSuccess: (newOrgUnit) => {
      // Prepend new org unit to all list queries for immediate UI feedback
      queryClient.setQueriesData<{ data: OrgUnit[]; meta?: ApiMeta }>(
        { queryKey: orgUnitsKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: [newOrgUnit, ...old.data],
            meta: old.meta
              ? { ...old.meta, total: (old.meta.total || 0) + 1 }
              : old.meta,
          };
        },
      );
      // Also invalidate to ensure data consistency with server
      queryClient.invalidateQueries({ queryKey: orgUnitsKeys.all });
    },
  });
}

export function useUpdateOrgUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: OrgUnitFormValues }) =>
      orgUnitsService.update(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orgUnitsKeys.all }),
  });
}

export function useInactiveOrgUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InactiveOrgUnitPayload) =>
      orgUnitsService.inactive(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orgUnitsKeys.all }),
  });
}

export function useRestoreOrgUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => orgUnitsService.restore(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orgUnitsKeys.all }),
  });
}

export function useArchiveOrgUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => orgUnitsService.archive(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orgUnitsKeys.all }),
  });
}

export function useGenerateTmpCode() {
  return useMutation({
    mutationFn: () => orgUnitsService.generateTmpCode(),
  });
}

export function useGenerateOrgUnitCode() {
  return useMutation({
    mutationFn: (unitType: string) => orgUnitsService.generateCode(unitType),
  });
}

export function useCheckTaxCode() {
  return useMutation({
    mutationFn: (taxCode: string) => orgUnitsService.checkTaxCode(taxCode),
  });
}

export function useUploadOrgUnitLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      orgUnitsService.uploadLogo(id, file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orgUnitsKeys.all }),
  });
}
