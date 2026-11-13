import { describe, expect, it, vi } from "vitest";
import { fetchCompleteReportPage } from "./report-search-sources";

describe("complete scoped report lookup sources", () => {
  it("loads later pages with identical filters before local searching", async () => {
    const fetch = vi.fn(async (page: number) => ({
      data: [{ code: page === 1 ? "FIRST" : "SEARCH-TARGET" }],
      meta: { last_page: 2, total: 2 },
    }));
    const result = await fetchCompleteReportPage(fetch);
    expect(result.data.map((row) => row.code)).toEqual([
      "FIRST",
      "SEARCH-TARGET",
    ]);
    expect(fetch.mock.calls).toEqual([[1], [2]]);
  });

  it("rejects missing pages and oversized datasets instead of reporting false no matches", async () => {
    await expect(
      fetchCompleteReportPage(async () => ({
        data: [],
        meta: { last_page: 101 },
      })),
    ).rejects.toThrow();
    await expect(
      fetchCompleteReportPage(async () => ({
        data: [],
        meta: { last_page: 1, total: 2 },
      })),
    ).rejects.toThrow();
    await expect(
      fetchCompleteReportPage(async () => {
        throw new Error("Forbidden");
      }),
    ).rejects.toThrow("Forbidden");
  });
});
