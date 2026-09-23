import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mvpMasterKeys } from "@/modules/master-data/hooks/use-mvp-master";
import { getMvpSkus } from "@/modules/master-data/services/mvp-master.service";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import { warrantyKeys } from "@/modules/warranty/hooks/use-warranty";
import {
  fetchComponentIssueDocument,
  fetchComponentIssueDocuments,
  type ComponentIssueDocument,
  type ComponentIssueLine,
} from "@/modules/warranty/services/componentIssueService";
import {
  fetchComponentIssueSkuIndex,
  fetchComponentIssueTrackingRows,
  withComponentIssueReadSlot,
  resolveComponentIssueTracking,
} from "./component-issue-list-data";

vi.mock(
  "@/modules/warranty/services/componentIssueService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/warranty/services/componentIssueService")
    >()),
    fetchComponentIssueDocument: vi.fn(),
    fetchComponentIssueDocuments: vi.fn(),
  }),
);
vi.mock(
  "@/modules/master-data/services/mvp-master.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/master-data/services/mvp-master.service")
    >()),
    getMvpSkus: vi.fn(),
  }),
);

function sku(id: string, serial: boolean): SkuRecord {
  return {
    sku_id: id,
    sku_code: `CODE-${id}`,
    sku_name: id,
    sku_type: "COMPONENT",
    is_serial_tracked: serial,
    status: "ACTIVE",
    version: 1,
  };
}
function line(id: string): ComponentIssueLine {
  return {
    id: `line-${id}`,
    sku_id: id,
    sku_code: `CODE-${id}`,
    sku_name: id,
    required_qty: 1,
    scanned_qty: 0,
    items: [],
  };
}
function document(
  id: string,
  lines: ComponentIssueLine[] = [],
): ComponentIssueDocument {
  return {
    id,
    component_issue_no: `CI-${id}`,
    warehouse_id: "warehouse-1",
    warranty_case_id: "case-1",
    document_date: "2026-09-23",
    purpose: "WARRANTY",
    status: "DRAFT",
    version: 1,
    lines,
  };
}

const listMock = vi.mocked(fetchComponentIssueDocuments);
const detailMock = vi.mocked(fetchComponentIssueDocument);
const skuMock = vi.mocked(getMvpSkus);
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});
afterEach(() => client.clear());

describe("resolveComponentIssueTracking", () => {
  it("uses exact SKU IDs and preserves false as quantity tracking before scanning", () => {
    const skus = new Map([
      ["serial", sku("serial", true)],
      ["quantity", sku("quantity", false)],
    ]);
    expect(
      resolveComponentIssueTracking(document("1", [line("serial")]), skus),
    ).toBe("SERIAL");
    expect(
      resolveComponentIssueTracking(document("2", [line("quantity")]), skus),
    ).toBe("QUANTITY");
    expect(
      resolveComponentIssueTracking(
        document("3", [line("serial"), line("quantity")]),
        skus,
      ),
    ).toBe("MIXED");
  });

  it("never interprets empty or unknown lines as quantity and rejects a mismatched map entry", () => {
    const misleading = new Map([["wanted", sku("different", false)]]);
    expect(
      resolveComponentIssueTracking(document("empty"), misleading),
    ).toBeNull();
    expect(
      resolveComponentIssueTracking(
        document("missing", [line("unknown")]),
        misleading,
      ),
    ).toBeNull();
    expect(
      resolveComponentIssueTracking(
        document("wrong", [line("wanted")]),
        misleading,
      ),
    ).toBeNull();
    const scanned = line("unknown");
    scanned.items = [
      { id: "scan", item_id: "item-1", quantity: 1, status: "ACTIVE" },
    ];
    expect(
      resolveComponentIssueTracking(document("scan", [scanned]), new Map()),
    ).toBeNull();
  });
});

describe("fetchComponentIssueTrackingRows", () => {
  it("finds matching and mixed documents on later server pages while preserving search/status", async () => {
    listMock.mockImplementation(async (params) => ({
      data: [document(String(params?.page))],
      meta: { current_page: params?.page, per_page: 1, total: 3, last_page: 3 },
    }));
    detailMock.mockImplementation(async (id) =>
      document(
        id,
        id === "1"
          ? [line("quantity")]
          : id === "2"
            ? [line("serial")]
            : [line("quantity"), line("serial")],
      ),
    );
    skuMock.mockImplementation(async (params) => ({
      data: [
        sku(
          params.keyword === "CODE-serial" ? "serial" : "quantity",
          params.keyword === "CODE-serial",
        ),
      ],
      meta: {},
    }));
    const result = await fetchComponentIssueTrackingRows(client, {
      keyword: "CI",
      status: "DRAFT",
      tracking: "SERIAL",
    });
    expect(result.map((row) => row.id)).toEqual(["2", "3"]);
    expect(listMock).toHaveBeenCalledTimes(3);
    for (const [params] of listMock.mock.calls) {
      expect(params).toMatchObject({
        keyword: "CI",
        status: "DRAFT",
        per_page: 50,
      });
    }
    expect(client.getQueryData(warrantyKeys.componentIssueDetail("2"))).toEqual(
      result[0],
    );
    expect(
      client.getQueryData(
        mvpMasterKeys.skus({ keyword: "CODE-serial", per_page: 50 }),
      ),
    ).toBeDefined();
    const quantity = await fetchComponentIssueTrackingRows(client, {
      keyword: "CI",
      status: "DRAFT",
      tracking: "QUANTITY",
    });
    expect(quantity.map((row) => row.id)).toEqual(["1", "3"]);
    expect(detailMock).toHaveBeenCalledTimes(3);
    expect(skuMock).toHaveBeenCalledTimes(2);
  });

  it("accepts pagination proven by total/per_page when last_page is absent", async () => {
    listMock.mockResolvedValue({
      data: [],
      meta: { current_page: 1, total: 0, per_page: 50 },
    });
    await expect(
      fetchComponentIssueTrackingRows(client, { tracking: "SERIAL" }),
    ).resolves.toEqual([]);
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("accepts last_page pagination without fabricating a total", async () => {
    listMock.mockResolvedValue({ data: [], meta: { last_page: 1 } });
    await expect(
      fetchComponentIssueTrackingRows(client, { tracking: "QUANTITY" }),
    ).resolves.toEqual([]);
  });

  it("resolves the exact SKU on a later master page instead of the first keyword match", async () => {
    listMock.mockResolvedValue({
      data: [document("1")],
      meta: { last_page: 1, total: 1, per_page: 50 },
    });
    detailMock.mockResolvedValue(document("1", [line("wanted")]));
    skuMock.mockImplementation(async (params) => ({
      data: [params.page === 2 ? sku("wanted", true) : sku("wrong", false)],
      meta: {
        current_page: params.page ?? 1,
        last_page: 2,
        total: 2,
        per_page: 1,
      },
    }));
    const result = await fetchComponentIssueTrackingRows(client, {
      tracking: "SERIAL",
    });
    expect(result.map((row) => row.id)).toEqual(["1"]);
    expect(skuMock).toHaveBeenLastCalledWith({
      keyword: "CODE-wanted",
      per_page: 50,
      page: 2,
    });
  });

  it.each([
    { data: [], meta: {} },
    { data: [document("1")], meta: { last_page: 1, total: 2, per_page: 50 } },
    {
      data: [document("1"), document("1")],
      meta: { last_page: 1, total: 2, per_page: 50 },
    },
  ])(
    "rejects missing proof, truncated rows and duplicate IDs: %#",
    async (response) => {
      listMock.mockResolvedValue(response);
      await expect(
        fetchComponentIssueTrackingRows(client, { tracking: "SERIAL" }),
      ).rejects.toThrow("Chưa tải được đầy đủ");
      expect(detailMock).not.toHaveBeenCalled();
    },
  );

  it("rejects changed pagination instead of exposing a partial filtered total", async () => {
    listMock.mockImplementation(async (params) => ({
      data: [document(String(params?.page))],
      meta: {
        current_page: params?.page,
        per_page: 1,
        total: params?.page === 1 ? 2 : 3,
        last_page: params?.page === 1 ? 2 : 3,
      },
    }));
    await expect(
      fetchComponentIssueTrackingRows(client, { tracking: "SERIAL" }),
    ).rejects.toThrow("Chưa tải được đầy đủ");
  });

  it("propagates source failures even when another document could match", async () => {
    listMock.mockResolvedValue({
      data: [document("1"), document("2")],
      meta: { last_page: 1, total: 2, per_page: 50 },
    });
    const failure = new Error("detail unavailable");
    detailMock.mockImplementation(async (id) => {
      if (id === "2") throw failure;
      return document(id, [line("serial")]);
    });
    await expect(
      fetchComponentIssueTrackingRows(client, { tracking: "SERIAL" }),
    ).rejects.toBe(failure);
  });

  it("rejects an unresolved SKU or empty detail rather than silently classifying it", async () => {
    listMock.mockResolvedValue({
      data: [document("1")],
      meta: { last_page: 1 },
    });
    detailMock.mockResolvedValue(document("1", [line("wanted")]));
    skuMock.mockResolvedValue({
      data: [sku("wrong", false)],
      meta: { last_page: 1 },
    });
    await expect(
      fetchComponentIssueTrackingRows(client, { tracking: "QUANTITY" }),
    ).rejects.toThrow("Chưa tải được đầy đủ");
    client.clear();
    detailMock.mockResolvedValue(document("1"));
    await expect(
      fetchComponentIssueTrackingRows(client, { tracking: "QUANTITY" }),
    ).rejects.toThrow("Chưa tải được đầy đủ");
  });

  it("bounds detail requests to five and preserves document order", async () => {
    const documents = Array.from({ length: 12 }, (_, index) =>
      document(String(index)),
    );
    listMock.mockResolvedValue({
      data: documents,
      meta: { last_page: 1, total: 12, per_page: 50 },
    });
    let active = 0;
    let maxActive = 0;
    detailMock.mockImplementation(async (id) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return document(id, [line("serial")]);
    });
    skuMock.mockResolvedValue({ data: [sku("serial", true)], meta: {} });
    const result = await fetchComponentIssueTrackingRows(client, {
      tracking: "SERIAL",
    });
    expect(maxActive).toBe(5);
    expect(result.map((row) => row.id)).toEqual(documents.map((row) => row.id));
    expect(skuMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchComponentIssueSkuIndex", () => {
  it("returns exact IDs from later pages and reuses shared master queries", async () => {
    skuMock.mockImplementation(async (params) => ({
      data: [params.page === 2 ? sku("wanted", false) : sku("fuzzy", true)],
      meta: { current_page: params.page ?? 1, per_page: 1, total: 2 },
    }));
    const documents = [
      document("1", [line("wanted")]),
      document("2", [line("wanted")]),
    ];
    const index = await fetchComponentIssueSkuIndex(client, documents);
    expect(index.size).toBe(1);
    expect(index.get("wanted")?.is_serial_tracked).toBe(false);
    expect(resolveComponentIssueTracking(documents[0], index)).toBe("QUANTITY");
    expect(skuMock).toHaveBeenCalledTimes(2);
    expect(
      client.getQueryData(
        mvpMasterKeys.skus({ keyword: "CODE-wanted", per_page: 50, page: 2 }),
      ),
    ).toBeDefined();
    await fetchComponentIssueSkuIndex(client, documents);
    expect(skuMock).toHaveBeenCalledTimes(2);
  });

  it("rejects missing tracking metadata instead of treating it as quantity", async () => {
    skuMock.mockResolvedValue({
      data: [
        {
          ...sku("wanted", true),
          is_serial_tracked: undefined,
        } as unknown as SkuRecord,
      ],
      meta: {},
    });
    await expect(
      fetchComponentIssueSkuIndex(client, [document("1", [line("wanted")])]),
    ).rejects.toThrow("Chưa tải được đầy đủ");
  });
});

describe("withComponentIssueReadSlot", () => {
  it("shares five slots across callers and releases them after rejections", async () => {
    let active = 0;
    let maxActive = 0;
    const failure = new Error("read failed");
    const jobs = Array.from({ length: 14 }, (_, index) =>
      withComponentIssueReadSlot(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (index === 2 || index === 7) throw failure;
          return index;
        } finally {
          active -= 1;
        }
      }),
    );
    const results = await Promise.allSettled(jobs);
    expect(maxActive).toBe(5);
    expect(active).toBe(0);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(12);
    expect(results[2]).toEqual({ status: "rejected", reason: failure });
    await expect(
      withComponentIssueReadSlot(() => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(
      withComponentIssueReadSlot(async () => "next read"),
    ).resolves.toBe("next read");
  });
});
