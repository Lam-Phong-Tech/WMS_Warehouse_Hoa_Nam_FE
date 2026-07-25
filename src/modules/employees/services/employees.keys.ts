import type { EmployeeListParams } from './employees.service';

export const employeesKeys = {
  // For Employees
  all: ['employees'] as const,
  allLists: () => [...employeesKeys.all, 'list'] as const,
  lists: () => [...employeesKeys.all, 'list-paged'] as const,
  list: (params: EmployeeListParams) =>
    [...employeesKeys.lists(), params] as const,
  details: () => [...employeesKeys.all, 'detail'] as const,
  detail: (id: number) => [...employeesKeys.details(), id] as const,

  // For Employee Assignments
  allAssignments: ['employee-assignments'] as const,
  assignments: () => [...employeesKeys.allAssignments, 'list'] as const,
};
