import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  employeesService,
  type EmployeeListParams,
} from '@/modules/employees/services/employees.service';
import { employeesKeys } from '@/modules/employees/services/employees.keys';
import type { Employee } from '@/modules/employees/types/employees.types';
import type { ApiMeta } from '@/shared/types/api-response';
import type {
  EmployeePayload,
  EmployeeStatusChangePayload,
} from '@/modules/employees/types/employees.types';

export function useEmployees(params?: { include_assignments?: boolean }) {
  return useQuery({
    queryKey: [...employeesKeys.allLists(), params],
    queryFn: () => employeesService.list(params),
  });
}

/**
 * Danh sách nhân sự có phân trang + filter server-side.
 * Dùng cho bảng chính EmployeesPage; giữ data trang trước khi fetch trang mới.
 * Params thay đổi → query key thay đổi → React Query tự refetch.
 */
export function useEmployeeList(params: EmployeeListParams = {}) {
  return useQuery({
    queryKey: employeesKeys.list(params),
    queryFn: () =>
      employeesService.listPaged({ ...params, include_assignments: true }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Danh sách nhân sự đã xóa mềm (deleted_at != null).
 * Dùng cho trash view trong EmployeesPage.
 */
export function useEmployeeTrashedList(params: EmployeeListParams = {}) {
  return useQuery({
    queryKey: [...employeesKeys.lists(), 'trashed', params],
    queryFn: () =>
      employeesService.listTrashed({ ...params, include_assignments: true }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeePayload) => employeesService.create(payload),
    onSuccess: (newEmployee) => {
      // Prepend new employee to all list queries for immediate UI feedback
      queryClient.setQueriesData<{ data: Employee[]; meta?: ApiMeta }>(
        { queryKey: employeesKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: [newEmployee, ...old.data],
            meta: old.meta
              ? { ...old.meta, total: (old.meta.total || 0) + 1 }
              : old.meta,
          };
        },
      );
      // Also invalidate to ensure data consistency with server
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: EmployeePayload }) =>
      employeesService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

/**
 * Hook để thay đổi trạng thái của nhân viên (đang làm, tạm nghỉ, đã nghỉ).
 */
export function useChangeEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: number } & EmployeeStatusChangePayload) =>
      employeesService.changeStatus(id, payload),
    onSuccess: () => {
      // Làm mới lại danh sách nhân viên để cập nhật trạng thái mới.
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

export function useRestoreEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => employeesService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

export function useArchiveEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => employeesService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

export function useCreateEmployeeAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password?: string }) =>
      employeesService.createAccount(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

export function useReissueTemporaryCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => employeesService.reissueTemporaryCredential(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

export function useListAssignableEmployees() {
  return useQuery({
    queryKey: ['assignable-employees'],
    queryFn: () =>
      employeesService.listAssignableEmployees({
        assignment_type: 'org_unit_manager',
        org_unit_id: 0,
      }),
    enabled: false,
  });
}

export function useImportEmployeesExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => employeesService.importExcel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => employeesService.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.all });
    },
  });
}
