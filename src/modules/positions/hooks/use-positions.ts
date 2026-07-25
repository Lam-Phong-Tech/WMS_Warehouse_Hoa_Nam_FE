import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  positionsService,
  type PositionListParams,
} from '@/modules/positions/services/positions.service';
import { positionsKeys } from '@/modules/positions/services/positions.keys';
import type { Position } from '@/modules/positions/types/positions.types';
import type { ApiMeta } from '@/shared/types/api-response';
import type { PositionFormValues } from '@/modules/positions/schemas/position.schema';

export function usePositions() {
  return useQuery({
    queryKey: positionsKeys.lists(),
    queryFn: positionsService.list,
  });
}

export function usePositionsPaged(params: PositionListParams, enabled = true) {
  return useQuery({
    queryKey: positionsKeys.listPaged(params),
    queryFn: () => positionsService.listPaged(params),
    enabled,
  });
}

/** Danh sách chức vụ đã xóa mềm (dùng cho filter "Vô hiệu" + khôi phục). */
export function usePositionsTrashedPaged(
  params: PositionListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: positionsKeys.trashed(params),
    queryFn: () => positionsService.listTrashed(params),
    enabled,
  });
}

export function usePositionById(id: number) {
  return useQuery({
    queryKey: positionsKeys.detail(id),
    queryFn: () => positionsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreatePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: PositionFormValues) => positionsService.create(values),
    onSuccess: (newPosition) => {
      // Prepend new position to all list queries for immediate UI feedback
      queryClient.setQueriesData<{ data: Position[]; meta?: ApiMeta }>(
        { queryKey: positionsKeys.lists() },
        (old) => {
          // `lists()` cũng khớp cache của usePositions() (dạng Position[] thô,
          // không có field `data`) — bỏ qua các cache không đúng shape { data, meta }.
          if (!old || !Array.isArray(old.data)) return old;
          return {
            ...old,
            data: [newPosition, ...old.data],
            meta: old.meta
              ? { ...old.meta, total: (old.meta.total || 0) + 1 }
              : old.meta,
          };
        },
      );
      // Also invalidate to ensure data consistency with server
      queryClient.invalidateQueries({ queryKey: positionsKeys.all });
    },
  });
}

export function useUpdatePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: PositionFormValues }) =>
      positionsService.update(id, values),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: positionsKeys.all });
      queryClient.invalidateQueries({ queryKey: positionsKeys.detail(id) });
    },
  });
}

/** Vô hiệu hóa chức vụ (soft delete). */
export function useInactivePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => positionsService.inactive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: positionsKeys.all });
    },
  });
}

/** Khôi phục chức vụ đã xóa mềm. */
export function useRestorePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => positionsService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: positionsKeys.all });
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => positionsService.inactive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: positionsKeys.all });
    },
  });
}
