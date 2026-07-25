import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  departmentsService,
  type DepartmentListParams,
} from '@/modules/departments/services/departments.service';
import { departmentsKeys } from '@/modules/departments/services/departments.keys';
import type { Department } from '@/modules/departments/types/departments.types';
import type { ApiMeta } from '@/shared/types/api-response';
import type { DepartmentFormValues } from '@/modules/departments/schemas/department.schema';

export function useDepartments() {
  return useQuery({
    queryKey: departmentsKeys.allLists(),
    queryFn: departmentsService.list,
  });
}

/**
 * Danh sách phòng ban có phân trang + filter server-side.
 * Dùng cho bảng chính DepartmentsPage; giữ data trang trước khi fetch trang mới.
 */
export function useDepartmentList(params: DepartmentListParams = {}) {
  return useQuery({
    queryKey: departmentsKeys.list(params),
    queryFn: () => departmentsService.listPaged(params),
    placeholderData: keepPreviousData,
  });
}

export function useDepartmentsTree() {
  return useQuery({
    queryKey: departmentsKeys.trees(),
    queryFn: departmentsService.getTree,
  });
}

export function useDepartment(id: number | null) {
  return useQuery({
    queryKey: departmentsKeys.detail(id as number),
    queryFn: () => departmentsService.getById(id as number),
    enabled: id != null,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: departmentsService.create,
    onSuccess: (newDepartment) => {
      // Prepend new department to all list queries for immediate UI feedback
      queryClient.setQueriesData<{ data: Department[]; meta?: ApiMeta }>(
        { queryKey: departmentsKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: [newDepartment, ...old.data],
            meta: old.meta
              ? { ...old.meta, total: (old.meta.total || 0) + 1 }
              : old.meta,
          };
        },
      );
      // Also invalidate to ensure data consistency with server
      queryClient.invalidateQueries({ queryKey: departmentsKeys.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number;
      values: DepartmentFormValues;
    }) => departmentsService.update(id, values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: departmentsKeys.all }),
  });
}

/**
 * Vô hiệu hóa phòng ban — PUT /departments/{id} với status=0 (không có
 * endpoint /inactive riêng). BE validate PUT như POST nên phải gửi kèm toàn
 * bộ dữ liệu phòng ban hiện có (org_unit_id/department_type/name...), không
 * chỉ mỗi field status — vì vậy cần truyền cả object Department.
 */
export function useInactiveDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dept: Department) => departmentsService.inactive(dept),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: departmentsKeys.all }),
  });
}

/** Kích hoạt lại phòng ban đang inactive — PUT /departments/{id} với status=1. */
export function useActivateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dept: Department) => departmentsService.activate(dept),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: departmentsKeys.all }),
  });
}

/** Xóa mềm phòng ban (vào thùng rác 14 ngày) — DELETE /departments/{id}/soft-delete. */
export function useSoftDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => departmentsService.softDelete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: departmentsKeys.all }),
  });
}

/** Khôi phục phòng ban đã xóa mềm — PATCH /departments/{id}/restore. */
export function useRestoreDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => departmentsService.restore(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: departmentsKeys.all }),
  });
}
