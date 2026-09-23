import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { fetchAllPages } from "@/shared/api/paginate-all";
import type { Raw } from "./report-format";

const MAX_REPORT_PAGES = 50;

/** A report needs every matching reversal, not only the first API list page. */
export async function fetchReversalReportSource(from: string, to: string) {
  const pages = await fetchAllPages(
    (page) =>
      http.getPage<Raw[]>(API_ENDPOINTS.REVERSAL_DOCUMENTS, {
        params: { from_date: from, to_date: to, per_page: 200, page },
      }),
    (first) => {
      const last = Number(first.meta?.last_page ?? 1);
      if (!Number.isInteger(last) || last < 1 || last > MAX_REPORT_PAGES) {
        throw new Error(
          "The reversal report source is incomplete: invalid or excessive pagination.",
        );
      }
      return last;
    },
    MAX_REPORT_PAGES,
  );
  const data = pages.flatMap((page) => {
    if (!Array.isArray(page.data))
      throw new Error("The reversal report source returned an invalid page.");
    return page.data;
  });
  const rawTotal = pages[0].meta?.total;
  if (rawTotal != null) {
    const total = Number(rawTotal);
    if (!Number.isInteger(total) || total < 0 || data.length !== total) {
      throw new Error(
        "The reversal report source changed or returned an incomplete dataset. Refresh the report.",
      );
    }
  }
  return { ...pages[0], data };
}
