import { describe, expect, it, vi } from "vitest";
import { readAllApiPages } from "./read-all-pages";

const identity = (row: { id: string }) => row.id;
describe("readAllApiPages", () => {
  it("reads every page using server pagination instead of assuming the requested limit", async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      data: [{ id: String(page) }],
      meta: { pagination: { current_page: page, last_page: 3, per_page: 1, total: 3 } },
    }));
    expect(await readAllApiPages(fetchPage, identity)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(fetchPage.mock.calls.map(call => call[0])).toEqual([1, 2, 3]);
  });
  it("accepts a confirmed empty result", async () => {
    expect(await readAllApiPages(async () => ({ data: [], meta: { total: 0 } }), identity)).toEqual([]);
  });
  it("does not turn a failed later page into a partial successful list", async () => {
    const failure = new Error("offline");
    await expect(readAllApiPages(async page => {
      if (page === 2) throw failure;
      return { data: [{ id: "first" }], meta: { current_page: 1, total: 2, last_page: 2 } };
    }, identity)).rejects.toBe(failure);
  });
  it("rejects malformed list payloads", async () => {
    await expect(readAllApiPages(async () => ({ data: {}, meta: { total: 0 } }), identity)).rejects.toMatchObject({ code: "WMS_FE_MISSING_API_VALUE" });
  });
  it("rejects an incomplete last page", async () => {
    await expect(readAllApiPages(async () => ({ data: [{ id: "a" }], meta: { total: 3, last_page: 1 } }), identity)).rejects.toMatchObject({ code: "WMS_FE_INCOMPLETE_API_PAGINATION" });
  });
  it("rejects duplicate identities across pages", async () => {
    await expect(readAllApiPages(async page => ({ data: [{ id: "a" }], meta: { current_page: page, last_page: 2, total: 2 } }), identity)).rejects.toMatchObject({ code: "WMS_FE_INCOMPLETE_API_PAGINATION" });
  });
  it("rejects totals or snapshots that change during pagination", async () => {
    await expect(readAllApiPages(async page => ({ data: [{ id: String(page) }], meta: { snapshot_id: String(page), current_page: page, last_page: 2, total: 2 } }), identity)).rejects.toMatchObject({ code: "WMS_FE_INCOMPLETE_API_PAGINATION" });
  });
  it("does not certify a nonempty unpaginated fragment as the whole catalogue", async () => {
    await expect(readAllApiPages(async () => ({ data: [{ id: "a" }], meta: {} }), identity)).rejects.toMatchObject({ code: "WMS_FE_INCOMPLETE_API_PAGINATION" });
  });
  it("uses an explicit server terminal flag", async () => {
    expect(await readAllApiPages(async () => ({ data: [{ id: "a" }], meta: { has_more: false } }), identity)).toEqual([{ id: "a" }]);
  });
});
