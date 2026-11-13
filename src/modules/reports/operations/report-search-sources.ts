import { fetchAllPages } from "@/shared/api/paginate-all";
import type { ApiMeta } from "@/shared/types/api-response";
import { tStatic } from "@/shared/i18n/useT";

export function completeReportLastPage(value: unknown, limit = 100): number {
  const last = Number(value ?? 1);
  if (!Number.isInteger(last) || last < 1 || last > limit) {
    throw new Error(tStatic("updatedUi.searchSourceIncomplete"));
  }
  return last;
}

/** Local report filters must see the entire authorized source, or fail visibly. */
export async function fetchCompleteReportPage<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; meta: ApiMeta }>,
) {
  const pages = await fetchAllPages(
    fetchPage,
    (first) => {
      return completeReportLastPage(first.meta?.last_page);
    },
    100,
  );
  const data = pages.flatMap((page) =>
    Array.isArray(page.data) ? page.data : [],
  );
  const total = pages[0]?.meta?.total;
  if (total !== undefined && data.length !== Number(total)) {
    throw new Error(tStatic("updatedUi.searchSourceIncomplete"));
  }
  return { ...pages[0], data };
}
