export const orgUnitsKeys = {
  all: ['org-units'] as const,
  trees: () => [...orgUnitsKeys.all, 'tree'] as const,
  lists: () => [...orgUnitsKeys.all, 'list'] as const,
  trashed: () => [...orgUnitsKeys.all, 'trashed'] as const,
  details: () => [...orgUnitsKeys.all, 'detail'] as const,
  detail: (id: number) => [...orgUnitsKeys.details(), id] as const,
};
