import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OutboundDocumentRecord,
  OutboundListResult,
} from "@/modules/outbound/services/alignedOutboundService";
import {
  fetchOutboundRecipientIndex,
  fetchOutboundRowsForRecipient,
  filterOutboundRecipientRows,
} from "./outbound-list-data";

const { fetchOutboundDocuments } = vi.hoisted(() => ({
  fetchOutboundDocuments: vi.fn(),
}));

vi.mock("@/modules/outbound/services/alignedOutboundService", () => ({
  fetchOutboundDocuments,
}));

function record(
  id: string,
  recipientName = "Đại lý A",
): OutboundDocumentRecord {
  return {
    id,
    code: `PX-${id}`,
    date: "2026-09-23",
    warehouseId: "warehouse-1",
    recipientName,
    recipientAddress: "",
    expected: 1,
    scanned: 0,
    status: "DRAFT",
    version: 1,
    createdBy: "user-1",
  };
}

function response(
  data: OutboundDocumentRecord[],
  page: number,
  total: number,
  perPage = 2,
): OutboundListResult {
  return {
    data,
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}

describe("OUT-01 recipient filtering across API pages", () => {
  beforeEach(() => fetchOutboundDocuments.mockReset());

  it("matches the exact recipient and keeps original records unchanged", () => {
    const exact = Object.freeze(record("1"));
    const rows = Object.freeze([
      exact,
      record("2", "Đại lý A1"),
      record("3", "đại lý A"),
      record("4", "Đại lý A "),
    ]);

    expect(filterOutboundRecipientRows(rows, "Đại lý A")).toEqual([exact]);
    expect(filterOutboundRecipientRows(rows, "Đại lý A")[0]).toBe(exact);
    expect(filterOutboundRecipientRows(rows, "missing")).toEqual([]);
    expect(rows).toHaveLength(4);
  });

  it("loads every index page using the server page size and derives missing last_page", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => record(`${index}`));
    const secondPage = response(rows.slice(2, 4), 2, 5);
    delete secondPage.meta.last_page;
    fetchOutboundDocuments
      .mockResolvedValueOnce(response(rows.slice(0, 2), 1, 5))
      .mockResolvedValueOnce(secondPage)
      .mockResolvedValueOnce(response(rows.slice(4), 3, 5));

    expect(await fetchOutboundRecipientIndex()).toEqual(rows);
    expect(fetchOutboundDocuments.mock.calls).toEqual([
      [{ page: 1, per_page: 100 }],
      [{ page: 2, per_page: 100 }],
      [{ page: 3, per_page: 100 }],
    ]);
  });

  it("accepts a complete empty index without requesting another page", async () => {
    fetchOutboundDocuments.mockResolvedValue(response([], 1, 0, 100));
    expect(await fetchOutboundRecipientIndex()).toEqual([]);
    expect(fetchOutboundDocuments).toHaveBeenCalledTimes(1);
  });

  it("forwards search, status and sort for every page before exact filtering and pagination", async () => {
    const rows = [
      record("6"),
      record("5", "Đại lý A1"),
      record("4", "Đại lý B"),
      record("3"),
      record("2"),
    ];
    fetchOutboundDocuments
      .mockResolvedValueOnce(response(rows.slice(0, 2), 1, 5))
      .mockResolvedValueOnce(response(rows.slice(2, 4), 2, 5))
      .mockResolvedValueOnce(response(rows.slice(4), 3, 5));

    const result = await fetchOutboundRowsForRecipient({
      recipientName: "Đại lý A",
      search: "PX-",
      status: "DRAFT",
      sortOrder: "desc",
      page: 2,
      per_page: 1,
    });

    expect(result).toEqual({
      data: [rows[3]],
      meta: {
        current_page: 2,
        per_page: 1,
        total: 3,
        last_page: 3,
        from: 2,
        to: 2,
      },
    });
    for (let page = 1; page <= 3; page += 1) {
      expect(fetchOutboundDocuments).toHaveBeenNthCalledWith(page, {
        search: "PX-",
        status: "DRAFT",
        sortOrder: "desc",
        page,
        per_page: 100,
      });
    }
  });

  it("does not replace the backend search with a recipient keyword or re-sort records", async () => {
    const rows = [record("3"), record("1")];
    fetchOutboundDocuments.mockResolvedValue(response(rows, 1, 2));

    const result = await fetchOutboundRowsForRecipient({
      recipientName: "Đại lý A",
      sortOrder: "asc",
    });

    expect(result.data).toEqual(rows);
    expect(fetchOutboundDocuments).toHaveBeenCalledWith({
      search: undefined,
      status: undefined,
      sortOrder: "asc",
      page: 1,
      per_page: 100,
    });
  });

  it("returns accurate empty pagination when the selected recipient has no matches", async () => {
    fetchOutboundDocuments.mockResolvedValue(response([record("1")], 1, 1));
    expect(
      await fetchOutboundRowsForRecipient({ recipientName: "Đại lý B" }),
    ).toEqual({
      data: [],
      meta: {
        current_page: 1,
        per_page: 10,
        total: 0,
        last_page: 1,
        from: 0,
        to: 0,
      },
    });
  });

  it.each([
    { current_page: 2 },
    { per_page: 0 },
    { per_page: 101 },
    { total: undefined },
    { total: -1 },
    { total: 1.5 },
    { last_page: 2 },
    { total: 100001, per_page: 100, last_page: 1001 },
  ])("rejects incomplete or invalid initial pagination %j", async (meta) => {
    const result = response([record("1")], 1, 1);
    result.meta = { ...result.meta, ...meta };
    fetchOutboundDocuments.mockResolvedValue(result);

    await expect(fetchOutboundRecipientIndex()).rejects.toThrow(/đầy đủ/);
    expect(fetchOutboundDocuments).toHaveBeenCalledTimes(1);
  });

  it.each([
    { total: 5, last_page: 3 },
    { per_page: 1, last_page: 4 },
    { current_page: 1 },
    { last_page: 3 },
  ])("rejects changing pagination between pages %j", async (meta) => {
    const next = response([record("3"), record("4")], 2, 4);
    next.meta = { ...next.meta, ...meta };
    fetchOutboundDocuments
      .mockResolvedValueOnce(response([record("1"), record("2")], 1, 4))
      .mockResolvedValueOnce(next);

    await expect(fetchOutboundRecipientIndex()).rejects.toThrow(/đầy đủ/);
    expect(fetchOutboundDocuments).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty intermediate page instead of silently returning a partial index", async () => {
    fetchOutboundDocuments
      .mockResolvedValueOnce(response([record("1"), record("2")], 1, 5))
      .mockResolvedValueOnce(response([], 2, 5));

    await expect(fetchOutboundRecipientIndex()).rejects.toThrow(/đầy đủ/);
    expect(fetchOutboundDocuments).toHaveBeenCalledTimes(2);
  });

  it("rejects a final page that is missing records", async () => {
    fetchOutboundDocuments
      .mockResolvedValueOnce(response([record("1"), record("2")], 1, 4))
      .mockResolvedValueOnce(response([record("3")], 2, 4));

    await expect(fetchOutboundRecipientIndex()).rejects.toThrow(/đầy đủ/);
  });

  it("deduplicates IDs and fails when duplicates hide missing records", async () => {
    fetchOutboundDocuments
      .mockResolvedValueOnce(response([record("1"), record("2")], 1, 4))
      .mockResolvedValueOnce(response([record("2"), record("3")], 2, 4));

    await expect(fetchOutboundRecipientIndex()).rejects.toThrow(/đầy đủ/);
  });

  it("rejects records without an identity", async () => {
    fetchOutboundDocuments.mockResolvedValue(response([record("")], 1, 1));
    await expect(fetchOutboundRecipientIndex()).rejects.toThrow(/đầy đủ/);
  });

  it("propagates server errors and does not return previous pages", async () => {
    const error = new Error("Connection lost");
    fetchOutboundDocuments
      .mockResolvedValueOnce(response([record("1"), record("2")], 1, 3))
      .mockRejectedValueOnce(error);

    await expect(fetchOutboundRecipientIndex()).rejects.toBe(error);
  });

  it("does not fetch when the query was already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchOutboundRecipientIndex(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchOutboundDocuments).not.toHaveBeenCalled();
  });

  it("stops before another API page when cancelled during a request", async () => {
    const controller = new AbortController();
    fetchOutboundDocuments.mockImplementation(async () => {
      controller.abort();
      return response([record("1"), record("2")], 1, 3);
    });

    await expect(
      fetchOutboundRowsForRecipient(
        { recipientName: "Đại lý A" },
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchOutboundDocuments).toHaveBeenCalledTimes(1);
  });

  it.each([{ page: 0 }, { page: 1.5 }, { per_page: 0 }])(
    "rejects invalid UI pagination %j before fetching",
    async (params) => {
      await expect(
        fetchOutboundRowsForRecipient({ recipientName: "Đại lý A", ...params }),
      ).rejects.toThrow(/đầy đủ/);
      expect(fetchOutboundDocuments).not.toHaveBeenCalled();
    },
  );
});
