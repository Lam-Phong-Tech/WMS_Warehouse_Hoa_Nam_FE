import type { ApiMeta } from "@/shared/types/api-response";

// Tách khỏi MvpListPagination.tsx: file component chỉ được export component
// (react-refresh/only-export-components).
export const MVP_PAGE_SIZE_OPTIONS = [15, 20, 50, 100] as const;

export function resolveApiPagination(
  meta: ApiMeta | Record<string, unknown> | undefined,
  fallback: { page: number; pageSize: number; rowCount: number },
) {
  const current = Number(meta?.current_page ?? fallback.page);
  const pageSize = Number(meta?.per_page ?? fallback.pageSize);
  const total = Number(meta?.total ?? fallback.rowCount);
  const lastPage = Number(
    meta?.last_page ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
  );

  return {
    current: Number.isFinite(current) && current > 0 ? current : fallback.page,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0 ? pageSize : fallback.pageSize,
    total: Number.isFinite(total) && total >= 0 ? total : fallback.rowCount,
    lastPage: Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1,
  };
}
