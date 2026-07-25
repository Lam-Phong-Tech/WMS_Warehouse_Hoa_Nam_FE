export const positionsKeys = {
  all: ['positions'] as const,
  lists: () => [...positionsKeys.all, 'list'] as const,
  listPaged: (params: unknown) =>
    [...positionsKeys.lists(), 'paged', params] as const,
  trashed: (params: unknown) =>
    [...positionsKeys.all, 'trashed', params] as const,
  details: () => [...positionsKeys.all, 'detail'] as const,
  detail: (id: number) => [...positionsKeys.details(), id] as const,
};
