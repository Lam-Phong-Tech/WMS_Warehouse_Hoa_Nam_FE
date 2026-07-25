import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

export interface EmployeeAssignment {
  id: number;
  employee_id: number;
  org_unit_id: number;
  department_id: number;
  position_id: number;
  is_primary: boolean;
  start_date: string;
  end_date?: string | null;
  status: boolean;
  is_current?: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  employee?: {
    id: number;
    code: string;
    full_name: string;
  };
  org_unit?: {
    id: number;
    name: string;
  };
  department?: {
    id: number;
    name: string;
  };
  position?: {
    id: number;
    name: string;
  };
}

export interface AssignmentListParams {
  page?: number;
  limit?: number;
  keyword?: string;
  org_unit_id?: number;
  employee_id?: number;
  status?: string;
}

export interface AssignmentPayload {
  employee_id: number;
  org_unit_id: number;
  department_id: number;
  position_id: number;
  is_primary: boolean;
  start_date: string;
  end_date?: string | null;
  status: boolean;
}

function buildQuery(params: AssignmentListParams) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.keyword) searchParams.set('keyword', params.keyword);
  if (params.status) searchParams.set('status', params.status);
  if (params.org_unit_id)
    searchParams.set('org_unit_id', String(params.org_unit_id));
  if (params.employee_id)
    searchParams.set('employee_id', String(params.employee_id));
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export function useEmployeeAssignments(
  params: AssignmentListParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['employee-assignments', params],
    queryFn: () =>
      http.getPage<EmployeeAssignment[]>(
        `/employee-assignments${buildQuery(params)}`,
      ),
    enabled: options?.enabled,
  });
}

export function useEmployeeAssignment(id: number | null) {
  return useQuery({
    queryKey: ['employee-assignments', id],
    queryFn: () => http.get<EmployeeAssignment>(`/employee-assignments/${id}`),
    enabled: id != null,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignmentPayload) =>
      http.post<EmployeeAssignment>('/employee-assignments', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-assignments'] });
    },
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AssignmentPayload }) =>
      http.put<EmployeeAssignment>(`/employee-assignments/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-assignments'] });
    },
  });
}

export function useSoftDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.delete<EmployeeAssignment>(
        `/employee-assignments/${id}/soft-delete`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-assignments'] });
    },
  });
}
