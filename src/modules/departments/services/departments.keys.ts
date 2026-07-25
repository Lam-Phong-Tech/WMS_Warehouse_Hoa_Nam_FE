import type { DepartmentListParams } from './departments.service';

export const departmentsKeys = {
  all: ['departments'] as const,
  allLists: () => [...departmentsKeys.all, 'list'] as const,
  lists: () => [...departmentsKeys.all, 'list-paged'] as const,
  list: (params: DepartmentListParams) =>
    [...departmentsKeys.lists(), params] as const,
  trees: () => [...departmentsKeys.all, 'tree'] as const,
  details: () => [...departmentsKeys.all, 'detail'] as const,
  detail: (id: number) => [...departmentsKeys.details(), id] as const,
};
