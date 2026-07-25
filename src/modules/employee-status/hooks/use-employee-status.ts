import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { employeesService } from '@/modules/employees/services/employees.service';

export function useEmployeeStatusHistories(
  params: {
    page?: number;
    limit?: number;
    employee_id?: number;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['employee-status-histories', params],
    queryFn: () => employeesService.listStatusHistories(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}

export function useStatusHistoryDetail(id: number | null | undefined) {
  return useQuery({
    queryKey: ['employee-status-histories', id],
    queryFn: () => employeesService.getStatusHistoryById(id as number),
    enabled: id != null && id > 0,
  });
}
